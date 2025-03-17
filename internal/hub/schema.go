package hub

import (
	"encoding/json"

	"github.com/gorilla/websocket"
)

type BroadcastPayload struct {
	Conn    *websocket.Conn
	Message json.RawMessage
}
