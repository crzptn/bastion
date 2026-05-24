package lobby_test

import (
	"context"
	"testing"
	"time"

	"github.com/JoakimCarlsson/bastion/internal/lobby"
)

// --- in-memory fake Store ---

type fakeLobby struct {
	l       *lobby.Lobby
	players []lobby.Player
}

type fakeStore struct {
	lobbies map[string]*fakeLobby
}

func newFakeStore() *fakeStore {
	return &fakeStore{lobbies: make(map[string]*fakeLobby)}
}

func (s *fakeStore) CreateLobby(ctx context.Context, l *lobby.Lobby) error {
	s.lobbies[l.ID] = &fakeLobby{l: l}
	return nil
}

func (s *fakeStore) GetLobby(
	ctx context.Context,
	id string,
) (*lobby.Lobby, error) {
	fl, ok := s.lobbies[id]
	if !ok {
		return nil, lobby.ErrNotFound
	}
	out := *fl.l
	out.Players = append([]lobby.Player(nil), fl.players...)
	return &out, nil
}

func (s *fakeStore) ListOpenLobbies(
	ctx context.Context,
) ([]*lobby.Lobby, error) {
	var result []*lobby.Lobby
	for _, fl := range s.lobbies {
		if fl.l.Status == lobby.StatusOpen {
			out := *fl.l
			out.Players = append([]lobby.Player(nil), fl.players...)
			result = append(result, &out)
		}
	}
	return result, nil
}

func (s *fakeStore) AddPlayer(
	ctx context.Context,
	lobbyID string,
	p lobby.Player,
) error {
	fl, ok := s.lobbies[lobbyID]
	if !ok {
		return lobby.ErrNotFound
	}
	// compute next free slot
	used := make(map[int]bool)
	for _, existing := range fl.players {
		used[existing.Slot] = true
	}
	slot := 0
	for used[slot] {
		slot++
	}
	p.Slot = slot
	fl.players = append(fl.players, p)
	return nil
}

func (s *fakeStore) RemovePlayer(
	ctx context.Context,
	lobbyID, playerID string,
) error {
	fl, ok := s.lobbies[lobbyID]
	if !ok {
		return lobby.ErrNotFound
	}
	for i, p := range fl.players {
		if p.PlayerID == playerID {
			fl.players = append(fl.players[:i], fl.players[i+1:]...)
			return nil
		}
	}
	return lobby.ErrPlayerNotInLobby
}

func (s *fakeStore) UpdateLobbyStatus(
	ctx context.Context,
	lobbyID string,
	status lobby.Status,
	sessionID string,
) error {
	fl, ok := s.lobbies[lobbyID]
	if !ok {
		return lobby.ErrNotFound
	}
	fl.l.Status = status
	fl.l.SessionID = sessionID
	fl.l.UpdatedAt = time.Now()
	return nil
}

// --- tests ---

func TestCreate_ReturnsIDAndHostAsSlot0(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "test-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if l.ID == "" {
		t.Error("expected non-empty ID")
	}
	if l.HostPlayerID != "player-1" {
		t.Errorf("host: got %q want %q", l.HostPlayerID, "player-1")
	}
	if len(l.Players) != 1 {
		t.Fatalf("players count: got %d want 1", len(l.Players))
	}
	if l.Players[0].Slot != 0 {
		t.Errorf("host slot: got %d want 0", l.Players[0].Slot)
	}
}

func TestJoin_SecondPlayerJoins(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "test-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	l2, err := svc.Join(context.Background(), l.ID, lobby.JoinInput{
		PlayerID:    "player-2",
		DisplayName: "Player Two",
	})
	if err != nil {
		t.Fatalf("Join: %v", err)
	}
	if len(l2.Players) != 2 {
		t.Errorf("players after join: got %d want 2", len(l2.Players))
	}
}

func TestJoin_FullLobbyReturnsErrFull(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "full-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   2,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Fill the remaining slot
	_, err = svc.Join(
		context.Background(),
		l.ID,
		lobby.JoinInput{PlayerID: "player-2"},
	)
	if err != nil {
		t.Fatalf("Join player-2: %v", err)
	}

	// Third joiner should get ErrFull
	_, err = svc.Join(
		context.Background(),
		l.ID,
		lobby.JoinInput{PlayerID: "player-3"},
	)
	if err != lobby.ErrFull {
		t.Errorf("expected ErrFull, got %v", err)
	}
}

func TestJoin_AlreadyJoinedReturnsErrAlreadyJoined(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "test-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	_, err = svc.Join(
		context.Background(),
		l.ID,
		lobby.JoinInput{PlayerID: "player-1"},
	)
	if err != lobby.ErrAlreadyJoined {
		t.Errorf("expected ErrAlreadyJoined, got %v", err)
	}
}

func TestLeave_RemovesPlayer(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "test-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	_, err = svc.Join(
		context.Background(),
		l.ID,
		lobby.JoinInput{PlayerID: "player-2"},
	)
	if err != nil {
		t.Fatalf("Join: %v", err)
	}

	updated, err := svc.Leave(context.Background(), l.ID, "player-2")
	if err != nil {
		t.Fatalf("Leave: %v", err)
	}
	if len(updated.Players) != 1 {
		t.Errorf("players after leave: got %d want 1", len(updated.Players))
	}
}

func TestLeave_NotInLobbyReturnsErrPlayerNotInLobby(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "test-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	_, err = svc.Leave(context.Background(), l.ID, "ghost-player")
	if err != lobby.ErrPlayerNotInLobby {
		t.Errorf("expected ErrPlayerNotInLobby, got %v", err)
	}
}

func TestListOpen_ExcludesNonOpen(t *testing.T) {
	store := newFakeStore()
	svc := lobby.NewService(store)

	_, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "open-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create open: %v", err)
	}

	l2, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "started-lobby",
		HostPlayerID: "player-2",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create started: %v", err)
	}
	// Manually mark as in_game via store
	_ = store.UpdateLobbyStatus(
		context.Background(),
		l2.ID,
		lobby.StatusInGame,
		"session-abc",
	)

	open, err := svc.ListOpen(context.Background())
	if err != nil {
		t.Fatalf("ListOpen: %v", err)
	}
	if len(open) != 1 {
		t.Errorf("ListOpen count: got %d want 1", len(open))
	}
	if open[0].Name != "open-lobby" {
		t.Errorf("expected open-lobby, got %q", open[0].Name)
	}
}

func TestStart_TransitionsToInGame(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "start-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	started, err := svc.Start(context.Background(), l.ID, "player-1")
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	if started.Status != lobby.StatusInGame {
		t.Errorf("status: got %q want in_game", started.Status)
	}
	if started.SessionID == "" {
		t.Error("expected non-empty session_id after start")
	}
}

func TestStart_NotHostReturnsErrNotHost(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "start-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	_, err = svc.Join(
		context.Background(),
		l.ID,
		lobby.JoinInput{PlayerID: "player-2"},
	)
	if err != nil {
		t.Fatalf("Join: %v", err)
	}

	_, err = svc.Start(context.Background(), l.ID, "player-2")
	if err != lobby.ErrNotHost {
		t.Errorf("expected ErrNotHost, got %v", err)
	}
}

func TestStart_NonOpenLobbyReturnsErrNotOpen(t *testing.T) {
	svc := lobby.NewService(newFakeStore())
	l, err := svc.Create(context.Background(), lobby.CreateInput{
		Name:         "start-lobby",
		HostPlayerID: "player-1",
		MaxPlayers:   4,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Start it once
	_, err = svc.Start(context.Background(), l.ID, "player-1")
	if err != nil {
		t.Fatalf("first Start: %v", err)
	}

	// Starting again should fail
	_, err = svc.Start(context.Background(), l.ID, "player-1")
	if err != lobby.ErrNotOpen {
		t.Errorf("expected ErrNotOpen, got %v", err)
	}
}
