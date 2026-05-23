package http

import (
	"context"
	"net/http"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/store"
)

type readyResponse struct {
	Status string `json:"status"`
}

func registerReady(r *router.Router, pool *store.Pool) {
	r.Get("/ready", readyHandler(pool))
}

func readyHandler(pool *store.Pool) func(*router.Context) {
	return func(c *router.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		status := "ready"
		code := http.StatusOK
		if err := pool.Ping(ctx); err != nil {
			status = "not_ready"
			code = http.StatusServiceUnavailable
		}

		c.JSON(code, readyResponse{Status: status})
	}
}
