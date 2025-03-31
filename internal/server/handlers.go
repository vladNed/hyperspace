package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vladNed/hyperspace/internal/cache"
	"github.com/vladNed/hyperspace/internal/settings"
	"github.com/vladNed/hyperspace/internal/utils"
)

func pingHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "pong",
	})
}

func indexHandler(c *gin.Context) {
	c.Header("Content-Type", "text/html")
	c.Header("X-Cache", "HIT")
	c.HTML(http.StatusOK, "index.html", gin.H{
		"title":       "SafeFiles",
		"description": "SafeFiles is p2p secure file sharing application",
		"sessionId":   utils.GetSessionId(),
	})
}

func connectHandler(c *gin.Context) {
	actionParam := c.Param("action")
	settings := settings.GetInstance()
	action, err := GetActionParameter(actionParam)
	if err != nil {
		c.HTML(http.StatusNotFound, "not-found-page.html", gin.H{})
		return
	}

	c.Header("Content-Type", "text/html")
	switch action {
	case StartAction:
		cacheInstance := cache.NewRedis()
		var sessionId string
		for range 5 {
			sessionId = utils.GetSessionId()
			if _, err := cacheInstance.Get(sessionId); err != nil {
				break
			}
		}
		c.HTML(http.StatusOK, "session-start.html", gin.H{
			"title":       "SafeFiles",
			"description": "SafeFiles is p2p secure file sharing application",
			"sessionId":   sessionId,
			"wsURL":       settings.WSOrigin + "/ws/v1/session/",
		})
		break
	case JoinAction:
		c.HTML(http.StatusOK, "session-join.html", gin.H{
			"title":       "SafeFiles",
			"description": "SafeFiles is p2p secure file sharing application",
			"wsURL":       settings.WSOrigin + "/ws/v1/session/",
		})
		break
	default:
		c.HTML(http.StatusNotFound, "not-found.html", gin.H{})
		break
	}
}

func sessionCommonHandler(c *gin.Context) {
	sessionParam := c.Param("sessionId")
	c.Header("Content-Type", "text/html")
	cacheClient := cache.NewRedis()
	if _, err := cacheClient.Get(sessionParam); err != nil {
		c.HTML(http.StatusNotFound, "not-found.html", gin.H{})
		return
	}
	c.HTML(http.StatusOK, "session-common.html", gin.H{
		"sessionId": sessionParam,
	})
}

func connectingHandler(c *gin.Context) {
	sessionParam := c.Param("sessionId")
	c.Header("Content-Type", "text/html")
	cacheClient := cache.NewRedis()
	if _, err := cacheClient.Get(sessionParam); err != nil {
		c.HTML(http.StatusNotFound, "not-found-page.html", gin.H{})
		return
	}
	c.HTML(http.StatusOK, "session-connecting.html", gin.H{
		"sessionId": sessionParam,
	})
}

func sessionPinHandler(c *gin.Context) {
	actionParam := c.Param("action")
	c.Header("Content-Type", "text/html")
	action, err := GetActionParameter(actionParam)
	if err != nil {
		c.HTML(http.StatusNotFound, "not-found.html", gin.H{})
		return
	}
	switch action {
	case StartAction:
		c.HTML(http.StatusOK, "pin-start.html", gin.H{})
	case JoinAction:
		c.HTML(http.StatusOK, "pin-join.html", gin.H{})
	default:
		c.HTML(http.StatusNotFound, "not-found.html", gin.H{})
	}
}
