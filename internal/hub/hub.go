package hub

import (
	"context"
	"log"

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
		log.Println("Was nil")
		hub = NewHub()
	}

	return hub
}

func (h *Hub) AddSession(conn *websocket.Conn, sessionId string) {
	log.Println("Adding conn for: ", sessionId)
	h.connections[sessionId] = conn
}

func (h *Hub) RemoveSession(conn *websocket.Conn) {
	for key, value := range h.connections {
		if value == conn {
			delete(h.connections, key)
			log.Println("Removed conn for: ", key)
			return
		}
	}
}

func (h *Hub) GetConnections() map[string]*websocket.Conn {
	return h.connections
}

func (h *Hub) GetConnBySessionId(sessionId string) *websocket.Conn {
	log.Println("Getting connection for ", sessionId)
	value, ok := h.connections[sessionId]
	if !ok {
		log.Println("conn for sess not found", sessionId)
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
