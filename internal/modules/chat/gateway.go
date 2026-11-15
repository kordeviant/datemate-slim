package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	platformRedis "datemate/internal/platform/redis"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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

	gw.attachNamespaceHandlers(chatNsp)
	gw.attachNamespaceHandlers(ioServer.Sockets())
	return gw
}

func (gw *Gateway) ServeHandler() http.Handler {
	return gw.ioServer.ServeHandler(nil)
}

func (gw *Gateway) attachNamespaceHandlers(nsp socket.Namespace) {
	// 1. Handshake Auth Middleware
	nsp.Use(func(s *socket.Socket, next func(*socket.ExtendedError)) {
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

		if strings.HasPrefix(strings.ToLower(token), "bearer ") {
			token = strings.TrimSpace(token[7:])
		}
		token = strings.Trim(token, `"' `)

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

		var uid int64
		if subVal, hasSub := claims["sub"]; hasSub && subVal != nil {
			switch v := subVal.(type) {
			case float64:
				uid = int64(v)
			case int64:
				uid = v
			case int:
				uid = int64(v)
			case string:
				_, _ = fmt.Sscanf(v, "%d", &uid)
			default:
				_, _ = fmt.Sscanf(fmt.Sprintf("%v", v), "%d", &uid)
			}
		}

		if uid <= 0 {
			next(socket.NewExtendedError("Unauthorized: invalid user ID in subject", nil))
			return
		}

		email, _ := claims["email"].(string)
		role, _ := claims["role"].(string)

		userData := &SocketUserData{
			UserID: uid,
			Email:  email,
			Role:   role,
			Rooms:  make(map[string]struct{}),
		}
		s.SetData(userData)

		gw.mu.Lock()
		gw.userMap[s.Id()] = userData
		gw.mu.Unlock()

		next(nil)
	})

	// 2. Connection Event
	nsp.On("connection", func(args ...any) {
		log.Printf("[DEBUG WS] connection event triggered with %d args", len(args))
		if len(args) == 0 {
			return
		}
		s, ok := args[0].(*socket.Socket)
		if !ok {
			return
		}

		var userData *SocketUserData
		if d := s.Data(); d != nil {
			if ud, ok := d.(*SocketUserData); ok {
				userData = ud
			}
		}
		if userData == nil {
			gw.mu.RLock()
			userData = gw.userMap[s.Id()]
			gw.mu.RUnlock()
		}

		if userData == nil {
			s.Disconnect(true)
			return
		}

		ctx := context.Background()
		_ = gw.svc.SetUserPresence(ctx, userData.UserID, true)

		// Automatically join personal user room so direct messages and conversation updates
		// are delivered in real-time even when not in the specific conversation room.
		userRoom := fmt.Sprintf("user:%d", userData.UserID)
		s.Join(socket.Room(userRoom))
		gw.mu.Lock()
		if uData := gw.userMap[s.Id()]; uData != nil {
			uData.Rooms[userRoom] = struct{}{}
		}
		gw.mu.Unlock()

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
							nsp.To(socket.Room(r)).Emit("user.activity", map[string]interface{}{
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
			log.Printf("[DEBUG WS] conversation.join called with %d args: %#v", len(eArgs), eArgs)
			var ack socket.Ack
			var payload JoinConversationWsDto

			for _, a := range eArgs {
				if fn, ok := a.(socket.Ack); ok {
					ack = fn
				} else if fn, ok := a.(func([]any, error)); ok {
					ack = fn
				} else if m, ok := a.(map[string]interface{}); ok {
					if id, ok := m["conversationId"].(string); ok && id != "" {
						payload.ConversationID = id
					} else if id, ok := m["id"].(string); ok && id != "" {
						payload.ConversationID = id
					} else if id, ok := m["conversation_id"].(string); ok && id != "" {
						payload.ConversationID = id
					}
				} else if b, err := json.Marshal(a); err == nil {
					_ = json.Unmarshal(b, &payload)
				}
			}

			if payload.ConversationID == "" {
				if payload.ID != "" {
					payload.ConversationID = payload.ID
				} else if payload.ConversationIdSnake != "" {
					payload.ConversationID = payload.ConversationIdSnake
				}
			}

			if payload.ConversationID == "" {
				if ack != nil {
					ack([]any{map[string]interface{}{
						"success": false,
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
			nsp.To(socket.Room(roomName)).Emit("user.activity", map[string]interface{}{
				"userId":         userData.UserID,
				"conversationId": payload.ConversationID,
				"isOnline":       true,
				"lastSeenAt":     nil,
			})

			if ack != nil {
				ack([]any{map[string]interface{}{
					"success": true,
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
					if id, ok := m["conversationId"].(string); ok && id != "" {
						payload.ConversationID = id
					} else if id, ok := m["id"].(string); ok && id != "" {
						payload.ConversationID = id
					} else if id, ok := m["conversation_id"].(string); ok && id != "" {
						payload.ConversationID = id
					}
				} else if b, err := json.Marshal(a); err == nil {
					_ = json.Unmarshal(b, &payload)
				}
			}

			if payload.ConversationID == "" {
				if payload.ID != "" {
					payload.ConversationID = payload.ID
				} else if payload.ConversationIdSnake != "" {
					payload.ConversationID = payload.ConversationIdSnake
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
					"success": true,
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
						"success": false,
						"status":  "error",
						"message": err.Error(),
						"error":   map[string]string{"type": "UNKNOWN_ERROR", "message": err.Error()},
					}}, nil)
					return
				}
				ack([]any{map[string]interface{}{
					"success": true,
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
						"success": false,
						"status":  "error",
						"message": err.Error(),
						"error":   map[string]string{"type": "UNKNOWN_ERROR", "message": err.Error()},
					}}, nil)
					return
				}
				ack([]any{map[string]interface{}{
					"success": true,
					"status":  "success",
					"message": "User activity retrieved",
					"data":    activity,
					"error":   nil,
				}}, nil)
				return
			}

			ack([]any{map[string]interface{}{
				"success": false,
				"status":  "error",
				"message": "Either userId or userIds must be provided",
				"error":   map[string]string{"type": "BAD_REQUEST", "message": "Either userId or userIds must be provided"},
			}}, nil)
		})

		// On message.send
		s.On("message.send", func(eArgs ...any) {
			log.Printf("[DEBUG WS] message.send called with %d args: %#v", len(eArgs), eArgs)
			var ack socket.Ack
			var dto SendMessageWsDto

			for _, a := range eArgs {
				if fn, ok := a.(socket.Ack); ok {
					ack = fn
				} else if fn, ok := a.(func([]any, error)); ok {
					ack = fn
				} else if m, ok := a.(map[string]interface{}); ok {
					// Handle string duration gracefully before unmarshal
					if dStr, ok := m["duration"].(string); ok && dStr != "" {
						if dF, err := strconv.ParseFloat(dStr, 64); err == nil {
							m["duration"] = dF
						}
					}
					if att, ok := m["attachment"].(map[string]interface{}); ok {
						if dStr, ok := att["duration"].(string); ok && dStr != "" {
							if dF, err := strconv.ParseFloat(dStr, 64); err == nil {
								att["duration"] = dF
							}
						}
					}
					if b, err := json.Marshal(m); err == nil {
						_ = json.Unmarshal(b, &dto)
					}
				} else if b, err := json.Marshal(a); err == nil {
					_ = json.Unmarshal(b, &dto)
				}
			}

			// Fallback: extract url/type/duration from attachment if root fields are empty
			if dto.Url == "" && dto.Attachment != nil && dto.Attachment.Url != "" {
				dto.Url = dto.Attachment.Url
			}
			if dto.Type == "" && dto.Attachment != nil && dto.Attachment.Type != "" {
				dto.Type = dto.Attachment.Type
			}
			if dto.Duration == nil && dto.Attachment != nil && dto.Attachment.Duration != nil {
				dto.Duration = dto.Attachment.Duration
			}

			if dto.ConversationID == "" {
				if ack != nil {
					ack([]any{map[string]interface{}{
						"success": false,
						"status":  "error",
						"message": "conversationId is required",
						"error":   map[string]string{"type": "BAD_REQUEST", "message": "conversationId is required"},
					}}, nil)
				}
				return
			}

			if dto.ClientMessageID == "" {
				dto.ClientMessageID = uuid.NewString()
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
						"success": false,
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
				msgPayload := map[string]interface{}{
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
				}
				// 1. Broadcast to conversation room members
				nsp.To(socket.Room(roomName)).Emit("message.created", msgPayload)

				// 2. Broadcast to each recipient's personal user room
				// Guarantees real-time delivery even when the recipient is on the inbox, feed, or navigating
				for _, rID := range res.RecipientUserIDs {
					if rID != userData.UserID {
						recipientRoom := fmt.Sprintf("user:%d", rID)
						nsp.To(socket.Room(recipientRoom)).Emit("message.created", msgPayload)
						nsp.To(socket.Room(recipientRoom)).Emit("conversation.updated", map[string]interface{}{
							"conversationId": dto.ConversationID,
							"lastMessage":    msgPayload,
						})
					}
				}

				// 3. Sender confirmation
				s.Emit("message.sent", msgPayload)
			}

			if ack != nil {
				ack([]any{map[string]interface{}{
					"success": true,
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
