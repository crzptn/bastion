package http

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
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
	WebDist    string
}

// NewHandler returns the API HTTP handler wired with minmux.
func NewHandler(pool *store.Pool, cfg Config) http.Handler {
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
	registerReady(r, pool)
	mountSPA(r, cfg.WebDist)

	return r
}

func mountSPA(r *router.Router, webDist string) {
	if webDist == "" {
		webDist = "web/dist"
	}

	indexPath := filepath.Join(webDist, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		if !os.IsNotExist(err) {
			log.Printf("spa: stat %s: %v", indexPath, err)
		}
		return
	}

	if err := r.SPA(os.DirFS(webDist)); err != nil {
		log.Printf("spa: mount %s: %v", webDist, err)
	}
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
