package server

import (
	"github.com/gin-gonic/gin"
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
	v1.POST("/session/", startSessionHandler)

	s.engine.GET("/", indexHandler)
	s.engine.GET("/session/:id", sessionHandler)

}

func (s *Server) Run() {
	s.engine.Static("/static", "./web/static")
	s.engine.LoadHTMLGlob("./web/pages/**/*")

	s.RegisterRoutes()

	s.engine.Run()
}
