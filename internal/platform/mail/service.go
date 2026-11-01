package mail

import (
	"context"
	"log"
)

type Mailer interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}

type Service struct {
	host string
	port int
	from string
}

func NewService(host string, port int, from string) *Service {
	return &Service{
		host: host,
		port: port,
		from: from,
	}
}

func (s *Service) SendEmail(ctx context.Context, to, subject, body string) error {
	log.Printf("[MAIL] To: %s | Subject: %s | Body: %s", to, subject, body)
	return nil
}
