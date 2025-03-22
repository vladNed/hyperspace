package server

import (
	"encoding/json"
	"errors"
)

type SessionMessageType string

const (
	Offer    SessionMessageType = "offer"
	GetOffer SessionMessageType = "get_offer"
	Answer   SessionMessageType = "answer"
	Error    SessionMessageType = "error"
	Ok       SessionMessageType = "ok"
)

type ActionParameter string

const (
	StartAction ActionParameter = "start"
	JoinAction  ActionParameter = "join"
)

func GetActionParameter(value string) (ActionParameter, error) {
	switch value {
	case string(StartAction):
		return StartAction, nil
	case string(JoinAction):
		return JoinAction, nil
	default:
		return "", errors.New("invalid action parameter")
	}
}

type SessionMessage struct {
	Payload json.RawMessage    `json:"payload"`
	Type    SessionMessageType `json:"type"`
}

type OfferRequest struct {
	SessionId string `json:"sessionId"`
	OfferSDP  string `json:"offerSDP"`
	PubKey    string `json:"pubKey"`
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
	PubKey   string `json:"pubKey"`
}

type AnswerRequest struct {
	SessionId string `json:"sessionId"`
	AnswerSDP string `json:"answerSDP"`
	PubKey    string `json:"pubKey"`
	Timestamp string `json:"timestamp"`
}

type AnswerResponse struct {
	Message string `json:"message"`
}
