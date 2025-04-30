package server

import (
	brotli "github.com/anargu/gin-brotli"
	"github.com/gin-gonic/gin"
	"github.com/vladNed/hyperspace/internal/hub"
	"github.com/vladNed/hyperspace/internal/settings"
)

type Server struct {
	engine *gin.Engine
}

func NewServer() *Server {
	gin.SetMode(gin.ReleaseMode)
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
	s.engine.Static("/public", "./web/public")
	s.engine.StaticFile("/sitemap.xml", "./web/public/sitemap.xml")
	s.engine.StaticFile("/robots.txt", "./web/public/robots.txt")
	s.engine.LoadHTMLGlob("./web/pages/**/*")

	s.engine.Use(brotli.Brotli(brotli.DefaultCompression))
	s.engine.SetTrustedProxies(nil)

	s.RegisterRoutes()

	hub := hub.GetInstance()
	go hub.Run()

	config := settings.GetInstance()
	if config.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}
	s.engine.Run()
}
