package http

import (
	"net/http"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/store"
)

// NewHandler returns the API HTTP handler wired with minmux.
//
// SPA static assets from web/dist are mounted in issue #3 via router.SPA.
// Do not call router.SPA() until web/dist/index.html exists.
func NewHandler(_ *store.Pool) http.Handler {
	r := router.New()
	// Routes (e.g. GET /health) are registered in issue #2.
	return r
}
