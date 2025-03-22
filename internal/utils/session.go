package utils

import (
	"crypto/rand"
	"encoding/base64"
)

func GetSessionId() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)

	return base64.URLEncoding.EncodeToString(bytes)[:8]
}
