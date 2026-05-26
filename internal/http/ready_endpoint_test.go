package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

func TestReadyEndpointNilPool(t *testing.T) {
	handler := NewHandler(nil, Config{}, realtime.NewHub(), nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want %d", rec.Code, http.StatusOK)
	}

	var body readyResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode JSON: %v", err)
	}
	if body.Status != "ready" {
		t.Errorf("status: got %q, want %q", body.Status, "ready")
	}
}
