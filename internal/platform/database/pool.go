package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse database url: %w", err)
	}

	cfg.MaxConns = 30
	cfg.MinConns = 5
	cfg.MaxConnLifetime = 1 * time.Hour
	cfg.MaxConnIdleTime = 15 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Retry database ping to gracefully tolerate cold container startups
	var lastErr error
	for attempt := 1; attempt <= 10; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		err := pool.Ping(pingCtx)
		cancel()
		if err == nil {
			log.Println("PostgreSQL connection pool established.")
			return pool, nil
		}
		lastErr = err
		log.Printf("Waiting for database connection (attempt %d/10): %v", attempt, err)
		select {
		case <-ctx.Done():
			pool.Close()
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}

	pool.Close()
	return nil, fmt.Errorf("unable to connect to database after retries: %w", lastErr)
}
