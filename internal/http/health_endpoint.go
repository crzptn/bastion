package http

import (
	"net/http"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/health"
)

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func registerHealth(r *router.Router) {
	r.Get("/health", healthHandler)
}

func healthHandler(c *router.Context) {
	result := health.Status()
	status := "ok"
	if !result.OK {
		status = "error"
	}
	c.JSON(http.StatusOK, healthResponse{
		Status:  status,
		Version: result.Version,
	})
}
