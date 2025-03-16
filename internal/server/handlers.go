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
	// Check the session request
	sessionName := c.DefaultPostForm("sessionName", "")
	if sessionName == "" {
		c.HTML(http.StatusUnprocessableEntity, "invalid-request.html", gin.H{
			"error": "Session name is required",
		})
		return
	}

	// Get a session id
	sessionId := utils.GetSessionId(sessionName)

	c.Header("HX-Location", "/session/"+sessionId)
	c.JSON(http.StatusCreated, gin.H{"sessionId": sessionId})
}

func indexHandler(c *gin.Context) {
	c.HTML(http.StatusOK, "index.html", gin.H{
		"title":       "Hyperspace",
		"description": "Hyperspace is p2p secure file sharing application",
	})
}

func sessionHandler(c *gin.Context) {
	sessionId := c.Param("id")
	c.HTML(http.StatusOK, "session.html", gin.H{
		"title":       "Hyperspace | " + sessionId,
		"description": "Hyperspace is p2p secure file sharing application",
	})
}
