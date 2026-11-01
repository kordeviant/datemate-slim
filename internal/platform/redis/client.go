package redis

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb *redis.Client

	// Swipe Lua Script SHA
	swipeScriptSHA string

	// In-memory debounce timers for presence
	debounceMu sync.Mutex
	debounces  map[int64]*time.Timer
}

const swipeLuaScript = `
local pairKey = KEYS[1]
local fromUser = ARGV[1]
local toUser = ARGV[2]
local direction = ARGV[3]
local ttl = tonumber(ARGV[4])

-- Record swipe in user pair hash
redis.call('HSET', pairKey, fromUser, direction)
redis.call('EXPIRE', pairKey, ttl)

-- Add to swiped set for fast deduplication
redis.call('SADD', 'swiped:' .. fromUser, toUser)

-- Check for mutual RIGHT swipe (Match)
if direction == 'RIGHT' then
    local otherDirection = redis.call('HGET', pairKey, toUser)
    if otherDirection == 'RIGHT' then
        return 1
    end
end

return 0
`

func NewClient(ctx context.Context, host, port, password string) (*Client, error) {
	addr := fmt.Sprintf("%s:%s", host, port)
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           0,
		PoolSize:     20,
		MinIdleConns: 5,
	})

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return nil, fmt.Errorf("unable to ping redis: %w", err)
	}

	sha, err := rdb.ScriptLoad(ctx, swipeLuaScript).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to load swipe lua script: %w", err)
	}

	log.Println("Redis client connected and Swipe Lua script loaded.")

	return &Client{
		rdb:            rdb,
		swipeScriptSHA: sha,
		debounces:      make(map[int64]*time.Timer),
	}, nil
}

func (c *Client) Raw() *redis.Client {
	return c.rdb
}

// RecordSwipeAtomic executes the Lua script atomically:
// returns true if this swipe resulted in a mutual match.
func (c *Client) RecordSwipeAtomic(ctx context.Context, fromUserID, toUserID int64, direction string) (bool, error) {
	minID := fromUserID
	maxID := toUserID
	if minID > maxID {
		minID, maxID = toUserID, fromUserID
	}
	pairKey := fmt.Sprintf("swipe:%d:%d", minID, maxID)
	ttlSeconds := 2592000 // 30 days

	res, err := c.rdb.EvalSha(ctx, c.swipeScriptSHA, []string{pairKey},
		strconv.FormatInt(fromUserID, 10),
		strconv.FormatInt(toUserID, 10),
		direction,
		ttlSeconds,
	).Int()

	if err != nil {
		// Fallback if script was flushed
		res, err = c.rdb.Eval(ctx, swipeLuaScript, []string{pairKey},
			strconv.FormatInt(fromUserID, 10),
			strconv.FormatInt(toUserID, 10),
			direction,
			ttlSeconds,
		).Int()
		if err != nil {
			return false, err
		}
	}

	return res == 1, nil
}

// GetSwipedUserIDs returns set of target user IDs already swiped by fromUserID
func (c *Client) GetSwipedUserIDs(ctx context.Context, fromUserID int64) ([]int64, error) {
	key := fmt.Sprintf("swiped:%d", fromUserID)
	members, err := c.rdb.SMembers(ctx, key).Result()
	if err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(members))
	for _, m := range members {
		if id, err := strconv.ParseInt(m, 10, 64); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

// RateLimitSlidingWindow checks sliding window request counter for a key.
// Returns (allowed, remaining, retryAfterSeconds, error)
func (c *Client) RateLimitSlidingWindow(ctx context.Context, key string, limit int, window time.Duration) (bool, int, int, error) {
	now := time.Now().UnixNano()
	clearBefore := now - window.Nanoseconds()

	pipe := c.rdb.Pipeline()
	pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(clearBefore, 10))
	countCmd := pipe.ZCard(ctx, key)
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return true, limit, 0, err
	}

	count := int(countCmd.Val())
	if count >= limit {
		retryAfter := int(window.Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, 0, retryAfter, nil
	}

	remaining := limit - count - 1
	if remaining < 0 {
		remaining = 0
	}
	return true, remaining, 0, nil
}

// Cache Get / Set for Recommended Candidates
func (c *Client) GetRecommendedCache(ctx context.Context, userID int64) (string, error) {
	key := fmt.Sprintf("recommended:pool:%d", userID)
	return c.rdb.Get(ctx, key).Result()
}

func (c *Client) SetRecommendedCache(ctx context.Context, userID int64, jsonPayload string, ttl time.Duration) error {
	key := fmt.Sprintf("recommended:pool:%d", userID)
	return c.rdb.Set(ctx, key, jsonPayload, ttl).Err()
}

func (c *Client) InvalidateRecommendedCache(ctx context.Context, userID int64) error {
	key := fmt.Sprintf("recommended:pool:%d", userID)
	return c.rdb.Del(ctx, key).Err()
}

// User Presence tracking
func (c *Client) SetUserOnline(ctx context.Context, userID int64) error {
	c.debounceMu.Lock()
	if timer, ok := c.debounces[userID]; ok {
		timer.Stop()
		delete(c.debounces, userID)
	}
	c.debounceMu.Unlock()

	key := fmt.Sprintf("presence:%d", userID)
	return c.rdb.HMSet(ctx, key, map[string]interface{}{
		"isOnline":   "true",
		"lastSeenAt": time.Now().UTC().Format(time.RFC3339),
	}).Err()
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

func (c *Client) ScheduleUserOffline(userID int64, debounce time.Duration, onConfirmOffline func(userID int64, lastSeen time.Time)) {
	c.debounceMu.Lock()
	defer c.debounceMu.Unlock()

	if timer, ok := c.debounces[userID]; ok {
		timer.Stop()
	}

	c.debounces[userID] = time.AfterFunc(debounce, func() {
		ctx := context.Background()
		now := time.Now().UTC()
		key := fmt.Sprintf("presence:%d", userID)
		_ = c.rdb.HMSet(ctx, key, map[string]interface{}{
			"isOnline":   "false",
			"lastSeenAt": now.Format(time.RFC3339),
		}).Err()

		c.debounceMu.Lock()
		delete(c.debounces, userID)
		c.debounceMu.Unlock()

		if onConfirmOffline != nil {
			onConfirmOffline(userID, now)
		}
	})
}
