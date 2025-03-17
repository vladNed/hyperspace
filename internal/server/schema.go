package server

import "encoding/json"

type SessionMessageType string

const (
	Offer    SessionMessageType = "offer"
	GetOffer SessionMessageType = "get_offer"
	Answer   SessionMessageType = "answer"
	Error    SessionMessageType = "error"
	Ok       SessionMessageType = "ok"
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

type SessionRequest struct {
	SessionId string `json:"sessionId"`
}

type SessionResponse struct {
	OfferSDP string `json:"offerSDP"`
}

type AnswerRequest struct {
	SessionId string `json:"sessionId"`
	AnswerSDP string `json:"answerSDP"`
	Timestamp string `json:"timestamp"`
}

type AnswerResponse struct {
	Message string `json:"message"`
}
