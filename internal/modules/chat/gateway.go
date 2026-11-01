package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	platformRedis "datemate/internal/platform/redis"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zishang520/socket.io/v2/socket"
)

type SocketUserData struct {
	UserID int64
	Email  string
	Role   string
	Rooms  map[string]struct{}
}

type Gateway struct {
	svc      *Service
	cfg      *config.Config
	pool     *pgxpool.Pool
	rdb      *platformRedis.Client
	ioServer *socket.Server
	chatNsp  socket.Namespace
	mu       sync.RWMutex
	userMap  map[socket.SocketId]*SocketUserData
}

func NewGateway(
	svc *Service,
	cfg *config.Config,
	pool *pgxpool.Pool,
	rdb *platformRedis.Client,
) *Gateway {
	opts := socket.DefaultServerOptions()
	opts.SetPingInterval(30 * time.Second)
	opts.SetPingTimeout(25 * time.Second)

	ioServer := socket.NewServer(nil, opts)
	chatNsp := ioServer.Of("/chat", nil)

	gw := &Gateway{
		svc:      svc,
		cfg:      cfg,
		pool:     pool,
		rdb:      rdb,
		ioServer: ioServer,
		chatNsp:  chatNsp,
		userMap:  make(map[socket.SocketId]*SocketUserData),
	}

	gw.setupNamespace()
	return gw
}

func (gw *Gateway) ServeHandler() http.Handler {
	return gw.ioServer.ServeHandler(nil)
}

func (gw *Gateway) setupNamespace() {
	// 1. Handshake Auth Middleware
	gw.chatNsp.Use(func(s *socket.Socket, next func(*socket.ExtendedError)) {
		hs := s.Handshake()
		token := ""

		if hs.Auth != nil {
			if authMap, ok := hs.Auth.(map[string]interface{}); ok {
				if t, ok := authMap["accessToken"].(string); ok && t != "" {
					token = t
				} else if t, ok := authMap["token"].(string); ok && t != "" {
					token = t
				}
			}
		}

		if token == "" && hs.Headers != nil {
			for k, v := range hs.Headers {
				if strings.EqualFold(k, "authorization") && len(v) > 0 {
					parts := strings.SplitN(v[0], " ", 2)
					if len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
						token = strings.Trim(parts[1], `"' `)
					}
					break
				}
			}
		}

		if token == "" {
			next(socket.NewExtendedError("Unauthorized: missing access token", nil))
			return
		}

		// Verify JWT token
		parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(gw.cfg.JWTAccessSecret), nil
		})

		if err != nil || !parsed.Valid {
			next(socket.NewExtendedError("Unauthorized: invalid or expired token", nil))
			return
		}

		claims, ok := parsed.Claims.(jwt.MapClaims)
		if !ok {
			next(socket.NewExtendedError("Unauthorized: invalid token claims", nil))
			return
		}

		sub, err := claims.GetSubject()
		if err != nil || sub == "" {
			next(socket.NewExtendedError("Unauthorized: missing subject claim", nil))
			return
		}

		var uid int64
		_, err = fmt.Sscanf(sub, "%d", &uid)
		if err != nil || uid <= 0 {
			next(socket.NewExtendedError("Unauthorized: invalid user ID in subject", nil))
			return
		}

		email, _ := claims["email"].(string)
		role, _ := claims["role"].(string)

		gw.mu.Lock()
		gw.userMap[s.Id()] = &SocketUserData{
			UserID: uid,
			Email:  email,
			Role:   role,
			Rooms:  make(map[string]struct{}),
		}
		gw.mu.Unlock()

		next(nil)
	})

	// 2. Connection Event
	gw.chatNsp.On("connection", func(args ...any) {
		if len(args) == 0 {
			return
		}
		s, ok := args[0].(*socket.Socket)
		if !ok {
			return
		}

		gw.mu.RLock()
		userData := gw.userMap[s.Id()]
		gw.mu.RUnlock()

		if userData == nil {
			s.Disconnect(true)
			return
		}

		ctx := context.Background()
		_ = gw.svc.SetUserPresence(ctx, userData.UserID, true)

		// On Disconnect
		s.On("disconnect", func(dArgs ...any) {
			gw.mu.Lock()
			uData := gw.userMap[s.Id()]
			delete(gw.userMap, s.Id())
			gw.mu.Unlock()

			if uData != nil {
				go func(uid int64, rooms map[string]struct{}) {
					// 3-second debounce before marking offline
					time.Sleep(3 * time.Second)
					gw.mu.RLock()
					// Check if user reconnected on any other socket
					stillConnected := false
					for _, d := range gw.userMap {
						if d.UserID == uid {
							stillConnected = true
							break
						}
					}
					gw.mu.RUnlock()

					if !stillConnected {
						bgCtx := context.Background()
						_ = gw.svc.SetUserPresence(bgCtx, uid, false)
						lastSeen := time.Now().UTC().Format(time.RFC3339)

						for r := range rooms {
							gw.chatNsp.To(socket.Room(r)).Emit("user.activity", map[string]interface{}{
								"userId":     uid,
								"isOnline":   false,
								"lastSeenAt": lastSeen,
							})
						}
					}
				}(uData.UserID, uData.Rooms)
			}
		})

		// On conversation.join
		s.On("conversation.join", func(eArgs ...any) {
			var ack socket.Ack
			var payload JoinConversationWsDto

			for _, a := range eArgs {
				if fn, ok := a.(socket.Ack); ok {
					ack = fn
				} else if m, ok := a.(map[string]interface{}); ok {
					if id, ok := m["conversationId"].(string); ok {
						payload.ConversationID = id
					}
				} else if b, err := json.Marshal(a); err == nil {
					_ = json.Unmarshal(b, &payload)
				}
			}

			if payload.ConversationID == "" {
				if ack != nil {
					ack([]any{map[string]interface{}{
						"status":  "error",
						"message": "conversationId is required",
						"error":   map[string]string{"type": "BAD_REQUEST", "message": "conversationId is required"},
					}}, nil)
				}
				return
			}

			roomName := "conversation:" + payload.ConversationID
			s.Join(socket.Room(roomName))

			gw.mu.Lock()
			if uData := gw.userMap[s.Id()]; uData != nil {
				uData.Rooms[roomName] = struct{}{}
			}
			gw.mu.Unlock()

			// Broadcast user active in this room
			gw.chatNsp.To(socket.Room(roomName)).Emit("user.activity", map[string]interface{}{
				"userId":         userData.UserID,
				"conversationId": payload.ConversationID,
				"isOnline":       true,
				"lastSeenAt":     nil,
			})

			if ack != nil {
				ack([]any{map[string]interface{}{
					"status":  "success",
					"message": "Joined conversation successfully",
					"data":    map[string]string{"conversationId": payload.ConversationID},
					"error":   nil,
				}}, nil)
			}
		})

		// On conversation.leave
		s.On("conversation.leave", func(eArgs ...any) {
			var ack socket.Ack
			var payload LeaveConversationWsDto

			for _, a := range eArgs {
				if fn, ok := a.(socket.Ack); ok {
					ack = fn
				} else if m, ok := a.(map[string]interface{}); ok {
					if id, ok := m["conversationId"].(string); ok {
						payload.ConversationID = id
					}
				} else if b, err := json.Marshal(a); err == nil {
					_ = json.Unmarshal(b, &payload)
				}
			}

			roomName := "conversation:" + payload.ConversationID
			s.Leave(socket.Room(roomName))

			gw.mu.Lock()
			if uData := gw.userMap[s.Id()]; uData != nil {
				delete(uData.Rooms, roomName)
			}
			gw.mu.Unlock()

			if ack != nil {
				ack([]any{map[string]interface{}{
					"status":  "success",
					"message": "Left conversation successfully",
					"data":    map[string]string{"conversationId": payload.ConversationID},
					"error":   nil,
				}}, nil)
			}
		})

		// On user.activity.get
		s.On("user.activity.get", func(eArgs ...any) {
			var ack socket.Ack
			var targetUserID *int64
			var targetUserIDs []int64

			for _, a := range eArgs {
				if fn, ok := a.(socket.Ack); ok {
					ack = fn
				} else if m, ok := a.(map[string]interface{}); ok {
					if idF, ok := m["userId"].(float64); ok {
						id := int64(idF)
						targetUserID = &id
					}
					if idsArr, ok := m["userIds"].([]interface{}); ok {
						for _, it := range idsArr {
							if idF, ok := it.(float64); ok {
								targetUserIDs = append(targetUserIDs, int64(idF))
							}
						}
					}
				}
			}

			if ack == nil {
				return
			}

			ctx := context.Background()
			if len(targetUserIDs) > 0 {
				activities, err := gw.svc.GetBatchUserActivity(ctx, targetUserIDs)
				if err != nil {
					ack([]any{map[string]interface{}{
						"status":  "error",
						"message": err.Error(),
						"error":   map[string]string{"type": "UNKNOWN_ERROR", "message": err.Error()},
					}}, nil)
					return
				}
				ack([]any{map[string]interface{}{
					"status":  "success",
					"message": "User activities retrieved",
					"data":    map[string]interface{}{"activities": activities},
					"error":   nil,
				}}, nil)
				return
			} else if targetUserID != nil {
				activity, err := gw.svc.GetUserActivity(ctx, *targetUserID)
				if err != nil {
					ack([]any{map[string]interface{}{
						"status":  "error",
						"message": err.Error(),
						"error":   map[string]string{"type": "UNKNOWN_ERROR", "message": err.Error()},
					}}, nil)
					return
				}
				ack([]any{map[string]interface{}{
					"status":  "success",
					"message": "User activity retrieved",
					"data":    activity,
					"error":   nil,
				}}, nil)
				return
			}

			ack([]any{map[string]interface{}{
				"status":  "error",
				"message": "Either userId or userIds must be provided",
				"error":   map[string]string{"type": "BAD_REQUEST", "message": "Either userId or userIds must be provided"},
			}}, nil)
		})

		// On message.send
		s.On("message.send", func(eArgs ...any) {
			var ack socket.Ack
			var dto SendMessageWsDto

			for _, a := range eArgs {
				if fn, ok := a.(socket.Ack); ok {
					ack = fn
				} else if b, err := json.Marshal(a); err == nil {
					_ = json.Unmarshal(b, &dto)
				}
			}

			if dto.ConversationID == "" || dto.ClientMessageID == "" {
				if ack != nil {
					ack([]any{map[string]interface{}{
						"status":  "error",
						"message": "conversationId and clientMessageId are required",
						"error":   map[string]string{"type": "BAD_REQUEST", "message": "conversationId and clientMessageId are required"},
					}}, nil)
				}
				return
			}

			ctx := context.Background()
			res, err := gw.svc.SendMessage(ctx, userData.UserID, dto)
			if err != nil {
				log.Printf("Error sending message: %v", err)
				if ack != nil {
					errType := "BAD_REQUEST"
					if appErr, ok := err.(*common.AppError); ok {
						errType = appErr.Type
					}
					ack([]any{map[string]interface{}{
						"status":  "error",
						"message": err.Error(),
						"error":   map[string]string{"type": errType, "message": err.Error()},
					}}, nil)
				}
				return
			}

			// Broadcast to room members if not duplicate
			if !res.IsDuplicate {
				roomName := "conversation:" + dto.ConversationID
				gw.chatNsp.To(socket.Room(roomName)).Emit("message.created", map[string]interface{}{
					"messageId":       res.Message.MessageID,
					"conversationId":  res.Message.ConversationID,
					"senderId":        res.Message.SenderID,
					"content":         res.Message.Content,
					"createdAt":       res.Message.CreatedAt,
					"clientMessageId": res.Message.ClientMessageID,
					"type":            res.Message.Type,
					"url":             res.Message.Url,
					"duration":        res.Message.Duration,
					"attachment":      res.Message.Attachment,
				})
			}

			if ack != nil {
				ack([]any{map[string]interface{}{
					"status":  "success",
					"message": "Message persisted successfully",
					"data": map[string]interface{}{
						"message": res.Message,
					},
					"error": nil,
				}}, nil)
			}
		})
	})
}
