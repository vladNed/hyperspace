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
	"github.com/vladNed/hyperspace/internal/utils"
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
		if err := conn.ReadJSON(&msgRaw); err != nil {
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
		if err = conn.WriteJSON(payload); err != nil {
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
		if err := json.Unmarshal(rawMsg.Payload, &offerPayload); err != nil {
			return nil, err
		}

		hubInstance := hub.GetInstance()
		if hubInstance.CheckConnHasActiveSession(conn) {
			return nil, fmt.Errorf("Already has an active session")
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
		if err := json.Unmarshal(rawMsg.Payload, &getOfferPayload); err != nil {
			return nil, err
		}
		return handleGetOffer(getOfferPayload)
	case Answer:
		var answerPayload AnswerRequest
		if err := json.Unmarshal(rawMsg.Payload, &answerPayload); err != nil {
			return nil, err
		}
		return handleNewAnswer(answerPayload, rawMsg.Payload)
	case GetAnswer:
		var getAnswerRequest GetAnswerRequest
		if err := json.Unmarshal(rawMsg.Payload, &getAnswerRequest); err != nil {
			return nil, err
		}

		return handleGetAnswerRequest(getAnswerRequest)
	default:
		return nil, fmt.Errorf("Unknown message type: %s", rawMsg.Type)
	}
}

func handleNewOffer(msg OfferRequest) (*OfferResponse, error) {
	cacheClient := cache.NewRedis()
	config := settings.GetInstance()

	msgRaw, _ := json.Marshal(msg)
	if err := cacheClient.Set(msg.SessionId, msgRaw, config.RedisTTL); err != nil {
		log.Println("Cannot save the offer:", err)
		return nil, fmt.Errorf("Cannot save the offer")
	}

	resp := &OfferResponse{Message: "Ok"}
	return resp, nil
}

func handleNewAnswer(msg AnswerRequest, raw json.RawMessage) (*AnswerResponse, error) {
	hubInstance := hub.GetInstance()
	pinManager := utils.GetPinManagerInstance()
	cacheClient := cache.NewRedis()
	config := settings.GetInstance()

	peerConnect := hubInstance.GetConnBySessionId(msg.SessionId)
	if peerConnect == nil {
		return nil, fmt.Errorf("Peer connection not found")
	}

	pin, err := pinManager.GeneratePIN()
	if err != nil {
		// TODO: Invalidate sessions on both ends
		return nil, fmt.Errorf("Cannot generate PIN")
	}

	if err := cacheClient.Set(fmt.Sprintf("%s-pin", msg.SessionId), pin, config.RedisTTL); err != nil {
		// TODO: Invalidate sessions on both ends
		return nil, fmt.Errorf("Cannot save the PIN")
	}

	if err := cacheClient.Set(msg.SessionId, string(raw), config.RedisTTL); err != nil {
		// TODO: Invalidate sessions on both ends
		return nil, fmt.Errorf("Cannot save the answer")
	}
	answerSendResp := &AnswerResponse{Message: "Ok", Pin: pin}
	peerConnectPayload := &SessionMessage{
		Type:    ConfirmConnection,
		Payload: json.RawMessage([]byte("{}")),
	}

	rawPayload, _ := json.Marshal(peerConnectPayload)
	hubInstance.BroadcastMessage(hub.BroadcastPayload{
		Conn:    peerConnect,
		Message: rawPayload,
	})

	return answerSendResp, nil
}

func handleGetOffer(msg SessionRequest) (*SessionResponse, error) {
	cacheClient := cache.NewRedis()
	sessionData, err := cacheClient.Get(msg.SessionId)
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
}

func handleGetAnswerRequest(msg GetAnswerRequest) (*AnswerRequest, error) {
	cacheClient := cache.NewRedis()
	if cachePin, err := cacheClient.Get(fmt.Sprintf("%s-pin", msg.SessionId)); err != nil || cachePin != msg.Pin {
		return nil, fmt.Errorf("Invalid PIN")
	}

	answerRaw, err := cacheClient.Get(msg.SessionId)
	if err != nil {
		return nil, fmt.Errorf("Answer not found")
	}

	var answer AnswerRequest
	json.Unmarshal([]byte(answerRaw), &answer)

	return &answer, nil
}
