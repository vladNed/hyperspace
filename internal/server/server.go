package server

import (
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
	v1.POST("/session/", startSessionHandler) // TODO: Deprecate this

	wsV1 := s.engine.Group("/ws/v1")
	wsV1.GET("/session/", wsHandler)

	s.engine.GET("/", indexHandler)
	s.engine.GET("/session/:action", connectHandler)
}

func (s *Server) Run() {
	s.engine.Static("/static", "./web/static")
	s.engine.LoadHTMLGlob("./web/pages/**/*")

	s.RegisterRoutes()

	hub := hub.GetInstance()
	go hub.Run()

	s.engine.Run()
}
