package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/vladNed/hyperspace/internal/cache"
	"github.com/vladNed/hyperspace/internal/hub"
	"github.com/vladNed/hyperspace/internal/settings"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		settings := settings.GetInstance()
		origin := r.Header.Get("Origin")
		if settings.AllowedOrigin == "" {
			return origin != ""
		}
		return origin == settings.AllowedOrigin
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
		resp, err := parseMessage(msgRaw, conn)
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

	hub := hub.GetInstance()
	go hub.RemoveSession(conn)
}

func parseMessage(rawMsg SessionMessage, conn *websocket.Conn) (any, error) {
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

		hub := hub.GetInstance()
		hub.AddSession(conn, offerPayload.SessionId)

		return resp, nil
	case GetOffer:
		var getOfferPayload SessionRequest
		err := json.Unmarshal(rawMsg.Payload, &getOfferPayload)
		if err != nil {
			return nil, err
		}

		cacheClient := cache.NewRedis()
		sessionData, err := cacheClient.Get(getOfferPayload.SessionId)
		if err != nil {
			return nil, fmt.Errorf("Session not found")
		}

		var offerRequest OfferRequest
		err = json.Unmarshal([]byte(sessionData), &offerRequest)
		if err != nil {
			log.Println("Cannot unmarshal offer request:", err)
			return nil, fmt.Errorf("A server error ocurred")
		}

		getOfferResp := &SessionResponse{OfferSDP: offerRequest.OfferSDP, PubKey: offerRequest.PubKey}
		return getOfferResp, nil
	case Answer:
		var answerPayload AnswerRequest
		err := json.Unmarshal(rawMsg.Payload, &answerPayload)
		if err != nil {
			return nil, err
		}

		hubInstance := hub.GetInstance()
		peerConnect := hubInstance.GetConnBySessionId(answerPayload.SessionId)
		if peerConnect == nil {
			return nil, fmt.Errorf("Peer connection not found")
		}

		broadcastPayload := &hub.BroadcastPayload{
			Conn:    peerConnect,
			Message: rawMsg.Payload,
		}

		hubInstance.BroadcastMessage(*broadcastPayload)

		answerSendResp := &AnswerResponse{Message: "Ok"}
		return answerSendResp, nil
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
