package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/lobby"
)

// fakeLobbyService is a minimal in-memory implementation of lobbyService for HTTP tests.
type fakeLobbyService struct {
	lobbies map[string]*lobby.Lobby
}

func newFakeLobbyService() *fakeLobbyService {
	return &fakeLobbyService{lobbies: make(map[string]*lobby.Lobby)}
}

func (f *fakeLobbyService) Create(
	_ context.Context,
	in lobby.CreateInput,
) (*lobby.Lobby, error) {
	maxPlayers := in.MaxPlayers
	if maxPlayers <= 0 {
		maxPlayers = 4
	}
	now := time.Now().UTC()
	l := &lobby.Lobby{
		ID:           "test-lobby-id",
		Name:         in.Name,
		HostPlayerID: in.HostPlayerID,
		MaxPlayers:   maxPlayers,
		Status:       lobby.StatusOpen,
		Players: []lobby.Player{
			{
				PlayerID:    in.HostPlayerID,
				DisplayName: in.DisplayName,
				Slot:        0,
				JoinedAt:    now,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	f.lobbies[l.ID] = l
	return l, nil
}

func (f *fakeLobbyService) Get(
	_ context.Context,
	id string,
) (*lobby.Lobby, error) {
	l, ok := f.lobbies[id]
	if !ok {
		return nil, lobby.ErrNotFound
	}
	return l, nil
}

func (f *fakeLobbyService) ListOpen(_ context.Context) ([]*lobby.Lobby, error) {
	var result []*lobby.Lobby
	for _, l := range f.lobbies {
		if l.Status == lobby.StatusOpen {
			result = append(result, l)
		}
	}
	return result, nil
}

func (f *fakeLobbyService) Join(
	_ context.Context,
	lobbyID string,
	in lobby.JoinInput,
) (*lobby.Lobby, error) {
	l, ok := f.lobbies[lobbyID]
	if !ok {
		return nil, lobby.ErrNotFound
	}
	if l.Status != lobby.StatusOpen {
		return nil, lobby.ErrNotOpen
	}
	for _, p := range l.Players {
		if p.PlayerID == in.PlayerID {
			return nil, lobby.ErrAlreadyJoined
		}
	}
	if len(l.Players) >= l.MaxPlayers {
		return nil, lobby.ErrFull
	}
	// Find next free slot
	used := make(map[int]bool)
	for _, p := range l.Players {
		used[p.Slot] = true
	}
	slot := 0
	for used[slot] {
		slot++
	}
	l.Players = append(l.Players, lobby.Player{
		PlayerID:    in.PlayerID,
		DisplayName: in.DisplayName,
		Slot:        slot,
		JoinedAt:    time.Now().UTC(),
	})
	return l, nil
}

func (f *fakeLobbyService) Leave(
	_ context.Context,
	lobbyID, playerID string,
) (*lobby.Lobby, error) {
	l, ok := f.lobbies[lobbyID]
	if !ok {
		return nil, lobby.ErrNotFound
	}
	for i, p := range l.Players {
		if p.PlayerID == playerID {
			l.Players = append(l.Players[:i], l.Players[i+1:]...)
			return l, nil
		}
	}
	return nil, lobby.ErrPlayerNotInLobby
}

func (f *fakeLobbyService) Start(
	_ context.Context,
	lobbyID, callerPlayerID string,
) (*lobby.Lobby, error) {
	l, ok := f.lobbies[lobbyID]
	if !ok {
		return nil, lobby.ErrNotFound
	}
	if l.Status != lobby.StatusOpen {
		return nil, lobby.ErrNotOpen
	}
	if l.HostPlayerID != callerPlayerID {
		return nil, lobby.ErrNotHost
	}
	l.Status = lobby.StatusInGame
	l.SessionID = "test-session-id"
	return l, nil
}

// newFakeHandler constructs a router with registerLobby wired to a fake service.
// It returns both the handler and the fake so tests can inspect/mutate state.
func newFakeHandler(t *testing.T) (http.Handler, *fakeLobbyService) {
	t.Helper()
	svc := newFakeLobbyService()
	r := router.New()
	registerLobby(r, svc)
	return r, svc
}

// helpers

func postJSON(
	t *testing.T,
	handler http.Handler,
	path string,
	body any,
) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func getJSON(
	t *testing.T,
	handler http.Handler,
	path string,
) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

// --- AC1: Create lobby returns id; second player can join ---

func TestCreateLobby_Returns201WithID(t *testing.T) {
	handler, _ := newFakeHandler(t)

	rec := postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Test Lobby",
		"host_player_id": "player-1",
		"max_players":    4,
	})

	if rec.Code != http.StatusCreated {
		t.Fatalf(
			"status: got %d want 201, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}

	var resp lobbyResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.ID == "" {
		t.Error("expected non-empty id")
	}
	if resp.Name != "Test Lobby" {
		t.Errorf("name: got %q want %q", resp.Name, "Test Lobby")
	}
	if len(resp.Players) != 1 {
		t.Errorf("players: got %d want 1", len(resp.Players))
	}
}

func TestJoinLobby_SecondPlayerReturns200With2Players(t *testing.T) {
	handler, _ := newFakeHandler(t)

	// Create first
	rec := postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Test Lobby",
		"host_player_id": "player-1",
		"max_players":    4,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create: got %d, body: %s", rec.Code, rec.Body.String())
	}

	rec2 := postJSON(
		t,
		handler,
		"/api/lobbies/test-lobby-id/join",
		map[string]any{
			"player_id":    "player-2",
			"display_name": "Player Two",
		},
	)

	if rec2.Code != http.StatusOK {
		t.Fatalf(
			"join status: got %d want 200, body: %s",
			rec2.Code,
			rec2.Body.String(),
		)
	}

	var resp lobbyResponse
	if err := json.NewDecoder(rec2.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Players) != 2 {
		t.Errorf("players after join: got %d want 2", len(resp.Players))
	}
}

// --- AC2: Join full lobby returns 409 ---

func TestJoinFullLobby_Returns409(t *testing.T) {
	handler, _ := newFakeHandler(t)

	// Create with max 2
	postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Small Lobby",
		"host_player_id": "player-1",
		"max_players":    2,
	})

	// Fill slot 1
	postJSON(t, handler, "/api/lobbies/test-lobby-id/join", map[string]any{
		"player_id": "player-2",
	})

	// Third joiner
	rec := postJSON(
		t,
		handler,
		"/api/lobbies/test-lobby-id/join",
		map[string]any{
			"player_id": "player-3",
		},
	)

	if rec.Code != http.StatusConflict {
		t.Fatalf(
			"status: got %d want 409, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}

	var errResp errorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if errResp.Error != "lobby_full" {
		t.Errorf("error: got %q want %q", errResp.Error, "lobby_full")
	}
}

// --- AC3: Leave and list endpoints work ---

func TestLeaveLobby_Returns200WithDecrementedPlayers(t *testing.T) {
	handler, _ := newFakeHandler(t)

	postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Test Lobby",
		"host_player_id": "player-1",
		"max_players":    4,
	})
	postJSON(t, handler, "/api/lobbies/test-lobby-id/join", map[string]any{
		"player_id": "player-2",
	})

	rec := postJSON(
		t,
		handler,
		"/api/lobbies/test-lobby-id/leave",
		map[string]any{
			"player_id": "player-2",
		},
	)

	if rec.Code != http.StatusOK {
		t.Fatalf(
			"leave status: got %d want 200, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}

	var resp lobbyResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Players) != 1 {
		t.Errorf("players after leave: got %d want 1", len(resp.Players))
	}
}

func TestListLobbies_OmitsStartedLobbies(t *testing.T) {
	handler, svc := newFakeHandler(t)

	// Create open lobby
	postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Open Lobby",
		"host_player_id": "player-1",
		"max_players":    4,
	})

	// Manually transition lobby to in_game
	if l, ok := svc.lobbies["test-lobby-id"]; ok {
		l.Status = lobby.StatusInGame
	}

	rec := getJSON(t, handler, "/api/lobbies")

	if rec.Code != http.StatusOK {
		t.Fatalf(
			"list status: got %d want 200, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}

	var lobbies []lobbyResponse
	if err := json.NewDecoder(rec.Body).Decode(&lobbies); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(lobbies) != 0 {
		t.Errorf(
			"expected 0 open lobbies (lobby is in_game), got %d",
			len(lobbies),
		)
	}
}

func TestGetLobby_Returns200(t *testing.T) {
	handler, _ := newFakeHandler(t)

	postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Test Lobby",
		"host_player_id": "player-1",
		"max_players":    4,
	})

	rec := getJSON(t, handler, "/api/lobbies/test-lobby-id")

	if rec.Code != http.StatusOK {
		t.Fatalf(
			"get status: got %d want 200, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}
}

func TestGetLobby_NotFound_Returns404(t *testing.T) {
	handler, _ := newFakeHandler(t)

	rec := getJSON(t, handler, "/api/lobbies/nonexistent")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: got %d want 404", rec.Code)
	}
}

func TestStartLobby_ByNonHost_Returns403(t *testing.T) {
	handler, _ := newFakeHandler(t)

	postJSON(t, handler, "/api/lobbies", map[string]any{
		"name":           "Test Lobby",
		"host_player_id": "player-1",
		"max_players":    4,
	})
	postJSON(t, handler, "/api/lobbies/test-lobby-id/join", map[string]any{
		"player_id": "player-2",
	})

	rec := postJSON(
		t,
		handler,
		"/api/lobbies/test-lobby-id/start",
		map[string]any{
			"player_id": "player-2",
		},
	)

	if rec.Code != http.StatusForbidden {
		t.Fatalf(
			"status: got %d want 403, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}
}

func TestCreateLobby_MissingFields_Returns400(t *testing.T) {
	handler, _ := newFakeHandler(t)

	rec := postJSON(t, handler, "/api/lobbies", map[string]any{
		"name": "No Host",
	})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf(
			"status: got %d want 400, body: %s",
			rec.Code,
			rec.Body.String(),
		)
	}
}
