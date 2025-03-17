package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vladNed/hyperspace/internal/utils"
)

func pingHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "pong",
	})
}

func startSessionHandler(c *gin.Context) {
	newSessionId := utils.GetSessionId()
	c.HTML(http.StatusCreated, "session-id.html", gin.H{"sessionId": newSessionId})
}

func indexHandler(c *gin.Context) {
	c.HTML(http.StatusOK, "index.html", gin.H{
		"title":       "Hyperspace",
		"description": "Hyperspace is p2p secure file sharing application",
		"sessionId":   utils.GetSessionId(),
	})
}

func sessionStartHandler(c *gin.Context) {
	actionParam := c.Param("action")

	switch actionParam {
	case "start":
		newSessionId := utils.GetSessionId()
		c.HTML(http.StatusOK, "sess-start.html", gin.H{
			"sessionId": newSessionId,
		})
	case "join":
		c.HTML(http.StatusOK, "sess-join.html", gin.H{})
	default:
		c.HTML(http.StatusNotFound, "not-found.html", gin.H{})
	}
}
