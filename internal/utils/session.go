package utils

import (
	"github.com/google/uuid"
)

func GetSessionId() string {
	return uuid.New().String()
}
