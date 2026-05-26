package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
	"github.com/JoakimCarlsson/bastion/internal/session"
)

// TestSessionSnapshotEndpoint_NotFound verifies 404 for an unknown session.
func TestSessionSnapshotEndpoint_NotFound(t *testing.T) {
	mgr := session.NewManager()
	t.Cleanup(mgr.Close)

	handler := NewHandler(nil, Config{}, realtime.NewHub(), nil, mgr, nil, nil)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/sessions/does-not-exist/snapshot",
		nil,
	)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: got %d, want 404", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["error"] != "session_not_found" {
		t.Errorf("error: got %q, want %q", body["error"], "session_not_found")
	}
}

// TestSessionSnapshotEndpoint_Found verifies 200 with correct fields for an
// active session.
func TestSessionSnapshotEndpoint_Found(t *testing.T) {
	hub := realtime.NewHub()
	t.Cleanup(hub.Close)

	mgr := session.NewManager()
	mgr.SetBroadcaster(func(_ string, _ realtime.Message) {})
	t.Cleanup(mgr.Close)

	const sessID = "endpoint-snap-test"
	if err := mgr.Start(sessID, []string{"p1"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	handler := NewHandler(nil, Config{}, hub, nil, mgr, nil, nil)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/sessions/"+sessID+"/snapshot",
		nil,
	)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if body["id"] != sessID {
		t.Errorf("id: got %v, want %q", body["id"], sessID)
	}
	if phase, ok := body["phase"].(string); !ok || phase == "" {
		t.Errorf("phase: expected non-empty string, got %v", body["phase"])
	}
}
