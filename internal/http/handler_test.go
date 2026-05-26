package http

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

func TestSPAIndexServed(t *testing.T) {
	dist := t.TempDir()
	if err := os.WriteFile(filepath.Join(dist, "index.html"), []byte("<!doctype html><title>Bastion</title>"), 0o644); err != nil {
		t.Fatalf("write index.html: %v", err)
	}

	handler := NewHandler(
		nil,
		Config{WebDist: dist},
		realtime.NewHub(),
		nil,
		nil,
		nil,
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET / status: got %d, want %d", rec.Code, http.StatusOK)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("Content-Type: got %q, want text/html; charset=utf-8", ct)
	}
}

func TestHealthWithoutSPA(t *testing.T) {
	handler := NewHandler(
		nil,
		Config{WebDist: t.TempDir()},
		realtime.NewHub(),
		nil,
		nil,
		nil,
	)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /health status: got %d, want %d", rec.Code, http.StatusOK)
	}
}
