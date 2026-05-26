package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	bhttp "github.com/JoakimCarlsson/bastion/internal/http"
	"github.com/JoakimCarlsson/bastion/internal/lobby"
	"github.com/JoakimCarlsson/bastion/internal/realtime"
	"github.com/JoakimCarlsson/bastion/internal/session"
	"github.com/JoakimCarlsson/bastion/internal/store"
)

func main() {
	addr := os.Getenv("API_ADDR")
	if addr == "" {
		if port := os.Getenv("HTTP_PORT"); port != "" {
			addr = ":" + port
		} else {
			addr = ":8080"
		}
	}

	ctx := context.Background()

	databaseURL := os.Getenv("DATABASE_URL")
	pool, err := store.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer pool.Close()

	if databaseURL != "" {
		if err := store.RunUp(databaseURL); err != nil {
			log.Fatalf("migrate: %v", err)
		}
		if err := pool.Ping(ctx); err != nil {
			log.Fatalf("store: ping: %v", err)
		}
	}

	hub := realtime.NewHub()
	defer hub.Close()

	sessionMgr := session.NewManager()
	sessionMgr.SetBroadcaster(func(sessionID string, msg realtime.Message) {
		hub.Broadcast(sessionID, msg)
	})
	defer sessionMgr.Close()

	var lobbySvc *lobby.Service
	if pool.DB() != nil {
		lobbyStore := lobby.NewPgxStore(pool.DB())
		lobbySvc = lobby.NewService(lobbyStore)
	}

	// Wire the SessionStarter callback so lobby.Start launches a session.
	if lobbySvc != nil {
		lobbySvc.SetSessionStarter(func(sessionID string, playerIDs []string) {
			if err := sessionMgr.Start(sessionID, playerIDs); err != nil {
				log.Printf("session: start %s: %v", sessionID, err)
			}
		})
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	version := os.Getenv("API_VERSION")
	if version == "" {
		version = os.Getenv("VERSION")
	}

	handler := bhttp.NewHandler(pool, bhttp.Config{
		CORSOrigin: corsOrigin,
		Version:    version,
		WebDist:    os.Getenv("WEB_DIST"),
	}, hub, lobbySvc, sessionMgr)

	srv := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	go func() {
		log.Printf("listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
}
