package settings

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Settings struct {
	Env           string
	AllowedOrigin string
	RedisAddr     string
	RedisPort     string
	RedisTTL      int
	WSOrigin      string
}

var instance *Settings

func GetInstance() *Settings {
	if instance == nil {
		instance = &Settings{}
		instance.loadEnvVars()
	}
	return instance
}

func (s *Settings) loadEnvVars() {
	env := os.Getenv("ENV")
	if env != "prod" {
		err := godotenv.Load()
		if err != nil {
			log.Fatalln("cannot load env variables")
		}
	}
	s.Env = env
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		log.Fatalln("REDIS_ADDR is not set")
	}
	s.RedisAddr = redisAddr

	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		log.Fatalln("REDIS_PORT is not set")
	}
	s.RedisPort = redisPort
	s.AllowedOrigin = os.Getenv("ALLOWED_ORIGIN")
	s.RedisTTL = 300

	if env == "prod" {
		s.WSOrigin = strings.ReplaceAll(s.AllowedOrigin, "https", "wss")
	} else {
		s.WSOrigin = "ws://localhost:8080"
	}

}
