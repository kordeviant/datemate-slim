package test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/gorilla/websocket"
	"github.com/zishang520/socket.io/v2/socket"

	"datemate/internal/middleware"
)

func TestSocketIOPathHandshakeAndUpgrade(t *testing.T) {
	opts := socket.DefaultServerOptions()
	opts.SetPingInterval(30 * time.Second)
	opts.SetPingTimeout(25 * time.Second)
	ioServer := socket.NewServer(nil, opts)
	_ = ioServer.Of("/chat", nil)
	socketHandler := ioServer.ServeHandler(nil)

	r := chi.NewRouter()
	r.Use(chiMiddleware.CleanPath)
	r.Use(chiMiddleware.StripSlashes)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.TransformEnvelope())

	r.Mount("/socket.io", socketHandler)
	r.Mount("/chat", socketHandler)

	ts := httptest.NewServer(r)
	defer ts.Close()

	u, _ := url.Parse(ts.URL)

	// 1. Polling handshake on /socket.io
	pollResp, err := http.Get(ts.URL + "/socket.io/?EIO=4&transport=polling")
	if err != nil {
		t.Fatalf("polling /socket.io failed: %v", err)
	}
	defer pollResp.Body.Close()
	if pollResp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for polling /socket.io, got %d", pollResp.StatusCode)
	}

	// 2. WebSocket upgrade on /socket.io
	wsURL := "ws://" + u.Host + "/socket.io/?EIO=4&transport=websocket"
	wsConn, wsResp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial /socket.io failed: %v (status=%v)", err, wsResp)
	}
	defer wsConn.Close()

	if wsResp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("expected 101 Switching Protocols for /socket.io, got %d", wsResp.StatusCode)
	}

	// 3. WebSocket upgrade on /chat/socket.io (backward-compat)
	chatWsURL := "ws://" + u.Host + "/chat/socket.io/?EIO=4&transport=websocket"
	chatWsConn, chatWsResp, err := websocket.DefaultDialer.Dial(chatWsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial /chat/socket.io failed: %v", err)
	}
	defer chatWsConn.Close()

	if chatWsResp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("expected 101 Switching Protocols for /chat/socket.io, got %d", chatWsResp.StatusCode)
	}
}
