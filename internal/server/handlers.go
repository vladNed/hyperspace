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

func connectHandler(c *gin.Context) {
	actionParam := c.Param("action")
	switch actionParam {
	case "start":
		c.HTML(http.StatusOK, "session-start.html", gin.H{
			"title":       "Hyperspace",
			"description": "Hyperspace is p2p secure file sharing application",
			"sessionId":   utils.GetSessionId(),
		})
		break
	case "join":
		c.HTML(http.StatusOK, "session-join.html", gin.H{
			"title":       "Hyperspace",
			"description": "Hyperspace is p2p secure file sharing application",
			"sessionId":   utils.GetSessionId(),
		})
		break
	default:
		c.HTML(http.StatusNotFound, "not-found.html", gin.H{})
		break
	}
}

func sessionCommonHandler(c *gin.Context) {
	sessionParam := c.Param("sessionId")
	c.HTML(http.StatusOK, "session-common.html", gin.H{
		"sessionId": sessionParam,
	})
}
