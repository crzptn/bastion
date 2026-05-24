package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/JoakimCarlsson/bastion/internal/health"
	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

func TestHealthEndpoint(t *testing.T) {
	prev := health.Version
	t.Cleanup(func() { health.Version = prev })

	health.Version = "test-1.0"
	handler := NewHandler(nil, Config{}, realtime.NewHub())

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}

	var body healthResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode JSON: %v", err)
	}
	if body.Status != "ok" {
		t.Errorf("status: got %q, want %q", body.Status, "ok")
	}
	if body.Version != "test-1.0" {
		t.Errorf("version: got %q, want %q", body.Version, "test-1.0")
	}
}
