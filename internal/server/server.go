package server

import (
	brotli "github.com/anargu/gin-brotli"
	"github.com/gin-gonic/gin"
	"github.com/vladNed/hyperspace/internal/hub"
)

type Server struct {
	engine *gin.Engine
}

func NewServer() *Server {
	return &Server{
		engine: gin.Default(),
	}
}

func (s *Server) RegisterRoutes() {
	v1 := s.engine.Group("/api/v1")
	v1.GET("/ping/", pingHandler)

	wsV1 := s.engine.Group("/ws/v1")
	wsV1.GET("/session/", wsHandler)

	s.engine.GET("/", indexHandler)
	s.engine.GET("/session/:action", connectHandler)
	s.engine.GET("/session/connect/:sessionId/", sessionCommonHandler)
	s.engine.GET("/session/pin/:action/", sessionPinHandler)
	s.engine.GET("/connect/:sessionId/", connectingHandler)
}

func (s *Server) Run() {
	s.engine.Static("/static", "./web/static")
	s.engine.LoadHTMLGlob("./web/pages/**/*")

	s.engine.Use(brotli.Brotli(brotli.DefaultCompression))
	s.engine.SetTrustedProxies(nil)

	s.RegisterRoutes()

	hub := hub.GetInstance()
	go hub.Run()

	s.engine.Run()
}
