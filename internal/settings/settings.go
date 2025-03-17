package settings

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Settings struct {
	RedisAddr string
	RedisPort string
	RedisTTL  int
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
	err := godotenv.Load()
	if err != nil {
		log.Fatalln("cannot load env variables")
	}

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

	s.RedisTTL = 300
}
