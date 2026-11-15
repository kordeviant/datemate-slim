package fcm

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"datemate/internal/platform/database/db"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/api/option"
)

type NotificationJob struct {
	ID        string                 `json:"job_id"`
	Tokens    []string               `json:"tokens"`
	UserID    *int64                 `json:"user_id,omitempty"`
	Topic     string                 `json:"topic,omitempty"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Priority  string                 `json:"priority,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}

type DispatchResult struct {
	JobID         string   `json:"job_id"`
	Status        string   `json:"status"`
	SuccessCount  int      `json:"success_count"`
	FailureCount  int      `json:"failure_count"`
	InvalidTokens []string `json:"invalid_tokens,omitempty"`
}

type Dispatcher struct {
	pool     *pgxpool.Pool
	queries  *db.Queries
	mockMode bool
	client   *messaging.Client
	queue    chan NotificationJob
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
}

func NewDispatcher(pool *pgxpool.Pool, mockMode bool, workerCount, queueBuffer int, creds ...string) *Dispatcher {
	ctx, cancel := context.WithCancel(context.Background())
	var q *db.Queries
	if pool != nil {
		q = db.New(pool)
	}

	d := &Dispatcher{
		pool:     pool,
		queries:  q,
		mockMode: mockMode,
		queue:    make(chan NotificationJob, queueBuffer),
		ctx:      ctx,
		cancel:   cancel,
	}

	// Resolve credentials
	var credPath, credJSON string
	if len(creds) > 0 {
		credPath = creds[0]
	}
	if len(creds) > 1 {
		credJSON = creds[1]
	}

	if credPath == "" {
		credPath = os.Getenv("FIREBASE_CREDENTIALS_PATH")
	}
	if credJSON == "" {
		credJSON = os.Getenv("FIREBASE_SERVICE_ACCOUNT")
		if credJSON == "" {
			credJSON = os.Getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
		}
	}

	if !mockMode {
		d.initFirebase(credPath, credJSON)
	}

	for i := 0; i < workerCount; i++ {
		d.wg.Add(1)
		go d.worker(i)
	}

	if d.mockMode {
		log.Println("[FCM] Push Dispatcher running in MOCK SIMULATION MODE.")
	} else {
		log.Println("[FCM] Push Dispatcher running with LIVE Firebase Cloud Messaging provider.")
	}

	return d
}

func (d *Dispatcher) initFirebase(credPath, credJSON string) {
	var opt option.ClientOption
	source := ""

	trimmedJSON := strings.TrimSpace(credJSON)
	if strings.HasPrefix(trimmedJSON, "{") && strings.Contains(trimmedJSON, "project_id") {
		opt = option.WithCredentialsJSON([]byte(trimmedJSON))
		source = "environment JSON string"
	} else {
		// Look up file paths
		candidates := []string{
			credPath,
			"firebase-service-account.json",
			"./firebase-service-account.json",
			"/app/firebase-service-account.json",
			"../push_notification_service/firebase-service-account.json",
		}

		for _, candidate := range candidates {
			if candidate == "" {
				continue
			}
			clean := filepath.Clean(candidate)
			if stat, err := os.Stat(clean); err == nil && !stat.IsDir() {
				opt = option.WithCredentialsFile(clean)
				source = clean
				break
			}
		}
	}

	if opt == nil {
		log.Println("[FCM] [ERROR] No valid Firebase credentials found! Set FIREBASE_CREDENTIALS_PATH or place firebase-service-account.json in the working directory. Falling back to MOCK SIMULATION MODE.")
		d.mockMode = true
		return
	}

	app, err := firebase.NewApp(d.ctx, nil, opt)
	if err != nil {
		log.Printf("[FCM] [ERROR] Failed to initialize Firebase App with %s: %v. Falling back to MOCK SIMULATION MODE.", source, err)
		d.mockMode = true
		return
	}

	client, err := app.Messaging(d.ctx)
	if err != nil {
		log.Printf("[FCM] [ERROR] Failed to initialize Firebase Messaging client: %v. Falling back to MOCK SIMULATION MODE.", err)
		d.mockMode = true
		return
	}

	d.client = client
	log.Printf("[FCM] Firebase successfully initialized via %s", source)
}

func (d *Dispatcher) Enqueue(job NotificationJob) string {
	if job.ID == "" {
		job.ID = uuid.NewString()
	}
	if job.CreatedAt.IsZero() {
		job.CreatedAt = time.Now().UTC()
	}

	select {
	case d.queue <- job:
		return job.ID
	default:
		// Queue full: spawn ephemeral goroutine to avoid dropping push notification
		go d.processJob(job)
		return job.ID
	}
}

func (d *Dispatcher) worker(id int) {
	defer d.wg.Done()
	for {
		select {
		case <-d.ctx.Done():
			return
		case job, ok := <-d.queue:
			if !ok {
				return
			}
			d.processJob(job)
		}
	}
}

func (d *Dispatcher) getUserTokens(ctx context.Context, userID int64) []string {
	var tokens []string
	if d.pool != nil {
		rows, err := d.pool.Query(ctx, `
			SELECT DISTINCT fcm_token 
			FROM user_sessions 
			WHERE user_id = $1 AND fcm_token IS NOT NULL AND fcm_token != ''
		`, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var tok string
				if err := rows.Scan(&tok); err == nil && strings.TrimSpace(tok) != "" {
					tokens = append(tokens, strings.TrimSpace(tok))
				}
			}
		} else {
			log.Printf("[FCM] [WARN] Error querying user_sessions tokens for user %d: %v", userID, err)
		}
	}

	if len(tokens) == 0 && d.queries != nil {
		tokenRow, err := d.queries.GetUserDeviceToken(ctx, int32(userID))
		if err == nil && tokenRow.FcmToken.Valid && strings.TrimSpace(tokenRow.FcmToken.String) != "" {
			tokens = append(tokens, strings.TrimSpace(tokenRow.FcmToken.String))
		}
	}

	return tokens
}

func (d *Dispatcher) removeInvalidToken(ctx context.Context, token string) {
	if d.pool != nil && token != "" {
		_, _ = d.pool.Exec(ctx, `UPDATE user_sessions SET fcm_token = NULL WHERE fcm_token = $1`, token)
	}
}

func maskToken(token string) string {
	if len(token) <= 12 {
		return token
	}
	return token[:6] + "..." + token[len(token)-6:]
}

func (d *Dispatcher) processJob(job NotificationJob) {
	// 1. Resolve tokens from user ID if tokens slice is empty
	if len(job.Tokens) == 0 && job.UserID != nil {
		job.Tokens = d.getUserTokens(d.ctx, *job.UserID)
	}

	// 2. Validate target presence
	if len(job.Tokens) == 0 && job.Topic == "" {
		if job.UserID != nil {
			log.Printf("[FCM] [FAILED] Notification %s (Title: %q, Body: %q) failed: user ID %d has no active device token in user_sessions database.",
				job.ID, job.Title, job.Body, *job.UserID)
		} else {
			log.Printf("[FCM] [FAILED] Notification %s (Title: %q, Body: %q) failed: no device tokens or topic target provided.",
				job.ID, job.Title, job.Body)
		}
		return
	}

	// 3. Mock mode handling
	if d.mockMode || d.client == nil {
		log.Printf("[FCM-MOCK] Dispatched notification %s: %q - %q (target tokens: %d, userId: %v, topic: %q)",
			job.ID, job.Title, job.Body, len(job.Tokens), job.UserID, job.Topic)
		return
	}

	// 4. Prepare data payload (Firebase data values must be strings)
	strData := make(map[string]string)
	for k, v := range job.Data {
		if v != nil {
			strData[k] = fmt.Sprintf("%v", v)
		}
	}

	// 5. Topic delivery
	if job.Topic != "" {
		msg := &messaging.Message{
			Topic: job.Topic,
			Notification: &messaging.Notification{
				Title: job.Title,
				Body:  job.Body,
			},
			Data: strData,
			Android: &messaging.AndroidConfig{
				Priority: "high",
				Notification: &messaging.AndroidNotification{
					Sound: "default",
				},
			},
			APNS: &messaging.APNSConfig{
				Headers: map[string]string{
					"apns-priority": "10",
				},
				Payload: &messaging.APNSPayload{
					Aps: &messaging.Aps{
						Sound: "default",
						Alert: &messaging.ApsAlert{
							Title: job.Title,
							Body:  job.Body,
						},
					},
				},
			},
		}

		msgID, err := d.client.Send(d.ctx, msg)
		if err != nil {
			log.Printf("[FCM] [FAILED] Failed to send topic notification %s to topic %q: %v", job.ID, job.Topic, err)
		} else {
			log.Printf("[FCM] Successfully dispatched topic notification %s to %q: Message ID %s", job.ID, job.Topic, msgID)
		}
		return
	}

	// 6. Device Multicast (chunks of up to 500 tokens)
	const batchSize = 500
	for i := 0; i < len(job.Tokens); i += batchSize {
		end := i + batchSize
		if end > len(job.Tokens) {
			end = len(job.Tokens)
		}
		batch := job.Tokens[i:end]

		multicastMsg := &messaging.MulticastMessage{
			Tokens: batch,
			Notification: &messaging.Notification{
				Title: job.Title,
				Body:  job.Body,
			},
			Data: strData,
			Android: &messaging.AndroidConfig{
				Priority: "high",
				Notification: &messaging.AndroidNotification{
					Sound:       "default",
					ChannelID:   "default",
					ClickAction: "FLUTTER_NOTIFICATION_CLICK",
				},
			},
			APNS: &messaging.APNSConfig{
				Headers: map[string]string{
					"apns-priority": "10",
				},
				Payload: &messaging.APNSPayload{
					Aps: &messaging.Aps{
						Sound: "default",
						Alert: &messaging.ApsAlert{
							Title: job.Title,
							Body:  job.Body,
						},
					},
				},
			},
		}

		resp, err := d.client.SendEachForMulticast(d.ctx, multicastMsg)
		if err != nil {
			log.Printf("[FCM] [FAILED] Firebase SendEachForMulticast error for job %s (Title: %q): %v", job.ID, job.Title, err)
			continue
		}

		log.Printf("[FCM] Dispatched notification %s (Title: %q): %d succeeded, %d failed (targets: %d)",
			job.ID, job.Title, resp.SuccessCount, resp.FailureCount, len(batch))

		if resp.FailureCount > 0 {
			for idx, r := range resp.Responses {
				if !r.Success {
					tok := batch[idx]
					log.Printf("[FCM] [FAILED] Device token delivery failed for token %q (user: %v): %v",
						maskToken(tok), job.UserID, r.Error)

					if messaging.IsRegistrationTokenNotRegistered(r.Error) || messaging.IsInvalidArgument(r.Error) {
						log.Printf("[FCM] Cleaning up unregistered/invalid device token from database: %s", maskToken(tok))
						d.removeInvalidToken(d.ctx, tok)
					}
				}
			}
		}
	}
}

func (d *Dispatcher) Close() {
	d.cancel()
	close(d.queue)
	d.wg.Wait()
}
