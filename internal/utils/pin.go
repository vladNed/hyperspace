package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sync"
	"time"
)

type PINManager struct {
	// TODO: If this becomes unmanageable, use a cache like redis
	active map[string]time.Time
	mutex  sync.Mutex
}

var (
	pinManagerInstance *PINManager
	once               sync.Once
)

const (
	MAX_PIN_SIZE          = 1000000
	MAX_GENERATE_ATTEMPTS = 10
	EXPIRATION_TIME       = 5 * time.Minute
)

func GetPinManagerInstance() *PINManager {
	once.Do(func() {
		pinManagerInstance = &PINManager{
			active: make(map[string]time.Time),
		}

		go pinManagerInstance.cleanupExpiredPINs()
	})

	return pinManagerInstance
}

func (pm *PINManager) GeneratePIN() (string, error) {
	max := big.NewInt(MAX_PIN_SIZE)

	for range MAX_GENERATE_ATTEMPTS {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}

		pin := fmt.Sprintf("%06d", n)

		pm.mutex.Lock()
		expiryTime, exists := pm.active[pin]
		pm.mutex.Unlock()

		if exists || time.Now().Before(expiryTime) {
			continue
		}

		pm.mutex.Lock()
		pm.active[pin] = time.Now().Add(EXPIRATION_TIME)
		pm.mutex.Unlock()

		return pin, nil
	}

	return "", fmt.Errorf("Cannot generate a unique PIN")
}

func (pm *PINManager) RemovePIN(pin string) {
	pm.mutex.Lock()
	delete(pm.active, pin)
	pm.mutex.Unlock()
}

// Cleanup expired PINs every 5 minutes
func (pm *PINManager) cleanupExpiredPINs() {
	ticker := time.NewTicker(EXPIRATION_TIME)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		pm.mutex.Lock()
		for pin, exp := range pm.active {
			if now.After(exp) {
				delete(pm.active, pin)
			}
		}
		pm.mutex.Unlock()
	}
}
