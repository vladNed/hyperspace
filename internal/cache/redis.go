package cache

import (
	"crypto/tls"
	"crypto/x509"
	"io/ioutil"
	"log"
	"time"

	"github.com/go-redis/redis"
	"github.com/vladNed/hyperspace/internal/settings"
)

type Redis struct {
	client *redis.Client
}

func NewRedis() *Redis {
	config := settings.GetInstance()

	// Load CA cert
	caCert, err := ioutil.ReadFile("./certs/ca.crt")
	if err != nil {
		panic(err)
	}

	certPool := x509.NewCertPool()
	if ok := certPool.AppendCertsFromPEM(caCert); !ok {
		panic("Failed to append CA cert")
	}

	clientCert, err := tls.LoadX509KeyPair("./certs/client.crt", "./certs/client.key")
	if err != nil {
		panic(err)
	}

	// TODO: Read certificates once adn store in settings or in memory somewhere
	client := redis.NewClient(&redis.Options{
		Addr: config.RedisAddr + ":" + config.RedisPort,
		TLSConfig: &tls.Config{
			InsecureSkipVerify: true,
			MinVersion:         tls.VersionTLS12,
			RootCAs:            certPool,
			ClientCAs:          certPool,
			Certificates:       []tls.Certificate{clientCert},
		},
	})

	pong, err := client.Ping().Result()
	if err != nil {
		panic(err)
	}

	log.Println("RDB pong:", pong)

	return &Redis{
		client: client,
	}
}

func (rdb *Redis) Set(key string, value any, ttl int) error {
	return rdb.client.Set(key, value, time.Duration(ttl)*time.Second).Err()
}

func (rdb *Redis) Get(key string) (string, error) {
	return rdb.client.Get(key).Result()
}

func (rdb *Redis) Del(key string) error {
	return rdb.client.Del(key).Err()
}
