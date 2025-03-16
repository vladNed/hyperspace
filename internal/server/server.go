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

	index := s.engine.Group("/")
	index.GET("/", indexHandler)

}

func (s *Server) Run() {
	s.engine.Static("/static", "web/static")
	s.engine.LoadHTMLGlob("web/pages/*.html")

	s.engine.Run()
}
