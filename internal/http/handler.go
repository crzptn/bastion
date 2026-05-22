package http

import (
	"log"
	"net/http"
	"time"

	"github.com/joakimcarlsson/minmux/cors"
	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/health"
	"github.com/JoakimCarlsson/bastion/internal/store"
)

// Config holds HTTP handler options.
type Config struct {
	CORSOrigin string
	Version    string
}

// NewHandler returns the API HTTP handler wired with minmux.
//
// SPA static assets from web/dist are mounted in issue #3 via router.SPA.
// Do not call router.SPA() until web/dist/index.html exists.
func NewHandler(_ *store.Pool, cfg Config) http.Handler {
	if cfg.Version != "" {
		health.Version = cfg.Version
	}

	r := router.New()
	r.Use(router.Recover())
	r.Use(requestLogging())
	if cfg.CORSOrigin != "" {
		r.Use(cors.New(cors.Options{
			AllowOrigins: []string{cfg.CORSOrigin},
			AllowHeaders: []string{"*"},
		}))
	} else {
		r.Use(cors.Default())
	}

	registerHealth(r)

	return r
}

func requestLogging() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
		})
	}
}
