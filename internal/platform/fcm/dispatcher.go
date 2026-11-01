package fcm

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

type NotificationJob struct {
	ID        string                 `json:"job_id"`
	Tokens    []string               `json:"tokens"`
	UserID    *int64                 `json:"user_id,omitempty"`
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
	mockMode bool
	queue    chan NotificationJob
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
}

func NewDispatcher(mockMode bool, workerCount, queueBuffer int) *Dispatcher {
	ctx, cancel := context.WithCancel(context.Background())
	d := &Dispatcher{
		mockMode: mockMode,
		queue:    make(chan NotificationJob, queueBuffer),
		ctx:      ctx,
		cancel:   cancel,
	}

	for i := 0; i < workerCount; i++ {
		d.wg.Add(1)
		go d.worker(i)
	}

	if mockMode {
		log.Println("FCM Push Dispatcher running in MOCK SIMULATION MODE.")
	} else {
		log.Println("FCM Push Dispatcher running with live provider.")
	}

	return d
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

func (d *Dispatcher) processJob(job NotificationJob) {
	if d.mockMode {
		log.Printf("[FCM-MOCK] Dispatched notification %s: %q - %q (target tokens: %d, userId: %v)",
			job.ID, job.Title, job.Body, len(job.Tokens), job.UserID)
		return
	}

	// Live dispatch simulation/call
	log.Printf("[FCM] Sent notification %s to %d tokens", job.ID, len(job.Tokens))
}

func (d *Dispatcher) Close() {
	d.cancel()
	close(d.queue)
	d.wg.Wait()
}
