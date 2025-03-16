package main

import (
	"github.com/vladNed/hyperspace/internal/server"
)

func main() {
	server := server.NewServer()
	server.Run()
}
