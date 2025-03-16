package utils

import (
	"crypto/sha256"
	"encoding/hex"
)

func GetSessionId(sessionName string) string {
	sessionHash := sha256.Sum256([]byte(sessionName))
	sessionId := hex.EncodeToString(sessionHash[:8])

	return sessionId
}
