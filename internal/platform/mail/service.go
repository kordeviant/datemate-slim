package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type Mailer interface {
	SendEmail(ctx context.Context, to, subject, body string) error
}

type Service struct {
	host   string
	port   int
	user   string
	pass   string
	from   string
	secure bool
}

func NewService(host string, port int, user, pass, from string, secure bool) *Service {
	if from == "" {
		from = "DateMate <noreply@datemate.app>"
	}
	return &Service{
		host:   host,
		port:   port,
		user:   user,
		pass:   pass,
		from:   from,
		secure: secure,
	}
}

func (s *Service) SendEmail(ctx context.Context, to, subject, body string) error {
	to = strings.TrimSpace(to)
	if to == "" {
		return fmt.Errorf("recipient email is required")
	}

	log.Printf("[MAIL] Preparing to send email to=%s subject=%q host=%s:%d user=%s secure=%v",
		to, subject, s.host, s.port, s.user, s.secure)

	// If no host configured, operate in simulation/mock mode
	if s.host == "" {
		log.Printf("[MAIL MOCK] To: %s | Subject: %s | Body: %s", to, subject, body)
		return nil
	}

	fromAddr := s.from
	if parsed, err := mail.ParseAddress(s.from); err == nil && parsed.Address != "" {
		fromAddr = parsed.Address
	}

	// Prepare RFC 5322 MIME message
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: %s\r\n", s.from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")

	isHTML := strings.Contains(body, "<html") || strings.Contains(body, "<div") || strings.Contains(body, "<p")
	if isHTML {
		msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
	} else {
		msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	}
	msg.WriteString(body)

	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	var auth smtp.Auth
	if s.user != "" && s.pass != "" {
		auth = smtp.PlainAuth("", s.user, s.pass, s.host)
	}

	// Execute with timeout
	errChan := make(chan error, 1)
	go func() {
		errChan <- s.send(addr, auth, fromAddr, to, []byte(msg.String()))
	}()

	select {
	case <-ctx.Done():
		log.Printf("[MAIL ERROR] Send timed out or context cancelled for %s", to)
		return ctx.Err()
	case err := <-errChan:
		if err != nil {
			log.Printf("[MAIL ERROR] Failed to deliver email to %s via %s: %v", to, addr, err)
			// If in mock or localhost without credentials, don't fail hard
			if s.user == "" && (s.host == "localhost" || s.host == "127.0.0.1") {
				log.Printf("[MAIL FALLBACK] Local SMTP unavailable, logged code fallback for %s", to)
				return nil
			}
			return err
		}
		log.Printf("[MAIL SUCCESS] Email delivered successfully to %s", to)
		return nil
	}
}

func (s *Service) send(addr string, auth smtp.Auth, from string, to string, msg []byte) error {
	tlsConfig := &tls.Config{
		ServerName:         s.host,
		InsecureSkipVerify: false,
	}

	// Direct SSL/TLS on port 465 or if secure is explicitly true
	if s.secure || s.port == 465 {
		dialer := &net.Dialer{Timeout: 10 * time.Second}
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("tls dial failed: %w", err)
		}
		defer conn.Close()

		c, err := smtp.NewClient(conn, s.host)
		if err != nil {
			return fmt.Errorf("smtp client creation failed: %w", err)
		}
		defer c.Close()

		if auth != nil {
			if ok, _ := c.Extension("AUTH"); ok {
				if err := c.Auth(auth); err != nil {
					return fmt.Errorf("smtp auth failed: %w", err)
				}
			}
		}

		if err := c.Mail(from); err != nil {
			return fmt.Errorf("smtp mail from failed: %w", err)
		}
		if err := c.Rcpt(to); err != nil {
			return fmt.Errorf("smtp rcpt to failed: %w", err)
		}
		w, err := c.Data()
		if err != nil {
			return fmt.Errorf("smtp data failed: %w", err)
		}
		if _, err := w.Write(msg); err != nil {
			return fmt.Errorf("smtp write message failed: %w", err)
		}
		if err := w.Close(); err != nil {
			return fmt.Errorf("smtp close data writer failed: %w", err)
		}
		return c.Quit()
	}

	// Standard STARTTLS connection on port 587 or 25
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("tcp dial failed: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("smtp client creation failed: %w", err)
	}
	defer c.Close()

	// Upgrade via STARTTLS if supported
	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("starttls upgrade failed: %w", err)
		}
	}

	// Authenticate if credentials provided
	if auth != nil {
		if ok, _ := c.Extension("AUTH"); ok {
			if err := c.Auth(auth); err != nil {
				return fmt.Errorf("smtp auth failed: %w", err)
			}
		}
	}

	if err := c.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from failed: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to failed: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data failed: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("smtp write message failed: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close data writer failed: %w", err)
	}
	return c.Quit()
}

// FormatVerificationEmail renders an elegant, mobile-friendly HTML email containing the OTP code.
func FormatVerificationEmail(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DateMate Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f9; margin: 0; padding: 24px; }
    .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; }
    .brand { font-size: 28px; font-weight: 800; color: #ff3366; letter-spacing: -0.5px; margin-bottom: 20px; }
    .heading { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; }
    .desc { font-size: 15px; color: #666666; line-height: 1.5; margin-bottom: 28px; }
    .code-container { background: #fff5f7; border: 2px dashed #ff3366; border-radius: 12px; padding: 18px 24px; margin: 0 auto 28px auto; display: inline-block; }
    .code { font-size: 36px; font-weight: 800; color: #ff3366; letter-spacing: 8px; font-family: 'SF Mono', Monaco, Consolas, monospace; }
    .expiry { font-size: 13px; color: #888888; margin-bottom: 24px; }
    .footer { font-size: 12px; color: #aaaaaa; border-top: 1px solid #f0f0f0; padding-top: 20px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">DateMate</div>
    <div class="heading">Verify Your Account</div>
    <div class="desc">Welcome to DateMate! Use the verification code below to complete your registration:</div>
    <div class="code-container">
      <div class="code">%s</div>
    </div>
    <div class="expiry">This code is valid for 10 minutes. If you didn't request this code, you can safely ignore this email.</div>
    <div class="footer">
      &copy; DateMate Inc. All rights reserved.<br>
      This is an automated security message. Please do not reply.
    </div>
  </div>
</body>
</html>`, code)
}

// FormatPasswordResetEmail renders an elegant, mobile-friendly HTML email containing the reset OTP code.
func FormatPasswordResetEmail(code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DateMate Password Reset</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f9; margin: 0; padding: 24px; }
    .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; }
    .brand { font-size: 28px; font-weight: 800; color: #ff3366; letter-spacing: -0.5px; margin-bottom: 20px; }
    .heading { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; }
    .desc { font-size: 15px; color: #666666; line-height: 1.5; margin-bottom: 28px; }
    .code-container { background: #fff5f7; border: 2px dashed #ff3366; border-radius: 12px; padding: 18px 24px; margin: 0 auto 28px auto; display: inline-block; }
    .code { font-size: 36px; font-weight: 800; color: #ff3366; letter-spacing: 8px; font-family: 'SF Mono', Monaco, Consolas, monospace; }
    .expiry { font-size: 13px; color: #888888; margin-bottom: 24px; }
    .footer { font-size: 12px; color: #aaaaaa; border-top: 1px solid #f0f0f0; padding-top: 20px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">DateMate</div>
    <div class="heading">Reset Your Password</div>
    <div class="desc">We received a request to reset your password. Use the code below to set a new password:</div>
    <div class="code-container">
      <div class="code">%s</div>
    </div>
    <div class="expiry">This code is valid for 10 minutes. If you did not make this request, please secure your account.</div>
    <div class="footer">
      &copy; DateMate Inc. All rights reserved.<br>
      This is an automated security message. Please do not reply.
    </div>
  </div>
</body>
</html>`, code)
}
