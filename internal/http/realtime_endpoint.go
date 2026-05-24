package http

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

const (
	wsPingInterval = 30 * time.Second
	wsReadDeadline = 60 * time.Second
	wsMaxMsgBytes  = 32 * 1024
)

// connCounter provides monotonically increasing client IDs without external deps.
var connCounter atomic.Uint64

func newConnID() string {
	return fmt.Sprintf("conn-%d", connCounter.Add(1))
}

// registerRealtime mounts the WebSocket upgrade endpoint at GET /api/ws.
func registerRealtime(r *router.Router, hub *realtime.Hub) {
	r.HandleFunc(
		http.MethodGet,
		"/api/ws",
		func(w http.ResponseWriter, req *http.Request) {
			roomID := req.URL.Query().Get("room")
			if roomID == "" {
				http.Error(
					w,
					`{"error":"room query parameter required"}`,
					http.StatusBadRequest,
				)
				return
			}

			conn, err := websocket.Accept(w, req, &websocket.AcceptOptions{
				InsecureSkipVerify: true, // origin checking is a non-goal for M3
			})
			if err != nil {
				// Accept already wrote the HTTP error response.
				log.Printf("ws: accept: %v", err)
				return
			}
			conn.SetReadLimit(wsMaxMsgBytes)

			serveWSConn(req.Context(), conn, hub, roomID)
		},
	)
}

// wsClient wraps a *websocket.Conn and implements realtime.Client.
type wsClient struct {
	id   string
	conn *websocket.Conn
}

func (c *wsClient) ID() string { return c.id }

func (c *wsClient) Send(msg realtime.Message) error {
	data, err := msg.Encode()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return c.conn.Write(ctx, websocket.MessageText, data)
}

func (c *wsClient) Close() error {
	return c.conn.Close(websocket.StatusNormalClosure, "")
}

// serveWSConn drives the lifecycle of one WebSocket connection.
//
// Ping loop: keep-alive every wsPingInterval; cancels ctx on failure.
// Read loop: parse incoming frames and act on opcode.
// On any error or ctx cancel: hub.Leave + conn.CloseNow to release resources.
func serveWSConn(
	parentCtx context.Context,
	conn *websocket.Conn,
	hub *realtime.Hub,
	roomID string,
) {
	ctx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	clientID := newConnID()
	client := &wsClient{id: clientID, conn: conn}

	hub.Join(roomID, client)
	defer hub.Leave(roomID, client)

	// Send join-ack so the client knows which room it landed in.
	joinAck := realtime.Message{
		Type: realtime.OpJoinAck,
		Payload: json.RawMessage(
			`{"room":"` + roomID + `","client_id":"` + clientID + `"}`,
		),
	}
	if err := client.Send(joinAck); err != nil {
		log.Printf("ws: join-ack %s: %v", clientID, err)
		_ = conn.CloseNow()
		return
	}

	// Announce join to the room.
	hub.Broadcast(roomID, realtime.Message{
		Type: realtime.OpBroadcast,
		Payload: json.RawMessage(
			`{"event":"join","client_id":"` + clientID + `"}`,
		),
	})

	// Ping goroutine — cancelled when read loop exits or parentCtx is done.
	pingDone := make(chan struct{})
	go func() {
		defer close(pingDone)
		ticker := time.NewTicker(wsPingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				pingCtx, pingCancel := context.WithTimeout(ctx, 5*time.Second)
				err := conn.Ping(pingCtx)
				pingCancel()
				if err != nil {
					log.Printf("ws: ping %s: %v", clientID, err)
					cancel()
					return
				}
			}
		}
	}()

	// Read loop.
readLoop:
	for {
		readCtx, readCancel := context.WithTimeout(ctx, wsReadDeadline)
		_, data, err := conn.Read(readCtx)
		readCancel()
		if err != nil {
			if ctx.Err() == nil {
				log.Printf("ws: read %s: %v", clientID, err)
			}
			break
		}

		msg, err := realtime.Decode(data)
		if err != nil {
			log.Printf("ws: decode %s: %v", clientID, err)
			continue
		}

		switch msg.Type {
		case realtime.OpPing:
			pong := realtime.Message{Type: realtime.OpPong}
			if sendErr := client.Send(pong); sendErr != nil {
				log.Printf("ws: pong %s: %v", clientID, sendErr)
				cancel()
				break readLoop
			}
		case realtime.OpBroadcast:
			hub.Broadcast(roomID, msg)
		default:
			// Unknown opcodes are silently dropped.
		}
	}

	cancel()
	<-pingDone
	_ = conn.CloseNow()
}
