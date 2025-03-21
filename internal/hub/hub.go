package hub

import (
	"context"

	"github.com/gorilla/websocket"
)

var hub *Hub

type Hub struct {
	connections map[string]*websocket.Conn
	broadcast   chan BroadcastPayload
	ctx         context.Context
}

func NewHub() *Hub {
	ctx := context.Background()
	return &Hub{
		connections: make(map[string]*websocket.Conn),
		broadcast:   make(chan BroadcastPayload),
		ctx:         ctx,
	}
}

func GetInstance() *Hub {
	if hub == nil {
		hub = NewHub()
	}

	return hub
}

func (h *Hub) AddSession(conn *websocket.Conn, sessionId string) {
	h.connections[sessionId] = conn
}

func (h *Hub) RemoveSession(conn *websocket.Conn) {
	for key, value := range h.connections {
		if value == conn {
			delete(h.connections, key)
			return
		}
	}
}

func (h *Hub) GetConnections() map[string]*websocket.Conn {
	return h.connections
}

func (h *Hub) GetConnBySessionId(sessionId string) *websocket.Conn {
	value, ok := h.connections[sessionId]
	if !ok {
		return nil
	}
	return value
}

func (h *Hub) BroadcastMessage(payload BroadcastPayload) {
	h.broadcast <- payload
}

func (h *Hub) Run() {
	for {
		select {
		case payload := <-h.broadcast:
			for _, conn := range h.connections {
				conn.WriteJSON(payload.Message)
			}
		case <-h.ctx.Done():
			return
		}
	}
}
