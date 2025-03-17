package server

import "encoding/json"

type SessionMessageType string

const (
	Offer  SessionMessageType = "offer"
	Answer SessionMessageType = "answer"
	Error  SessionMessageType = "error"
	Ok     SessionMessageType = "ok"
)

type SessionMessage struct {
	Payload json.RawMessage    `json:"payload"`
	Type    SessionMessageType `json:"type"`
}

type OfferRequest struct {
	SessionId string `json:"sessionId"`
	OfferSDP  string `json:"offerSDP"`
	Timestamp string `json:"timestamp"`
}

type OfferResponse struct {
	Message string `json:"message"`
}

type ErrorResponse struct {
	Message string `json:"message"`
}
