package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/vladNed/hyperspace/internal/cache"
	"github.com/vladNed/hyperspace/internal/settings"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return false
		}
		return true
	},
}

func wsHandler(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot upgrade the connection"})
		return
	}
	defer conn.Close()

	for {
		var msgRaw SessionMessage
		err := conn.ReadJSON(&msgRaw)
		if err != nil {
			log.Println("Error reading message:", err)
			break
		}
		resp, err := parseMessage(msgRaw)
		if err != nil {
			newError := ErrorResponse{Message: err.Error()}
			payloadBytes, _ := json.Marshal(newError)
			conn.WriteJSON(SessionMessage{Payload: payloadBytes, Type: Error})
			continue
		}

		respBytes, _ := json.Marshal(resp)
		payload := SessionMessage{Payload: respBytes, Type: Ok}
		err = conn.WriteJSON(payload)
		if err != nil {
			break
		}
	}
}

func parseMessage(rawMsg SessionMessage) (any, error) {
	switch rawMsg.Type {
	case Offer:
		var offerPayload OfferRequest
		err := json.Unmarshal(rawMsg.Payload, &offerPayload)
		if err != nil {
			return nil, err
		}

		resp, err := handleNewOffer(offerPayload)
		if err != nil {
			return nil, err
		}

		return resp, nil
	default:
		return nil, fmt.Errorf("Unknown message type: %s", rawMsg.Type)
	}
}

func handleNewOffer(msg OfferRequest) (*OfferResponse, error) {
	cacheClient := cache.NewRedis()
	config := settings.GetInstance()

	msgRaw, _ := json.Marshal(msg)
	err := cacheClient.Set(msg.SessionId, msgRaw, config.RedisTTL)
	if err != nil {
		log.Println("Cannot save the offer:", err)
		return nil, fmt.Errorf("Cannot save the offer")
	}

	resp := &OfferResponse{Message: "Ok"}
	return resp, nil
}
