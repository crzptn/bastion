package lobby

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

// Sentinel errors returned by Service methods.
var (
	ErrNotFound         = errors.New("lobby: not found")
	ErrFull             = errors.New("lobby: full")
	ErrAlreadyJoined    = errors.New("lobby: already joined")
	ErrNotOpen          = errors.New("lobby: not open")
	ErrPlayerNotInLobby = errors.New("lobby: player not in lobby")
	ErrNotHost          = errors.New("lobby: not host")
	ErrTooFewPlayers    = errors.New("lobby: too few players")
	ErrAlreadyStarted   = errors.New("lobby: already started")
)

// Store is the persistence interface required by Service.
// The pgx-backed implementation lives in store.go.
type Store interface {
	CreateLobby(ctx context.Context, l *Lobby) error
	GetLobby(ctx context.Context, id string) (*Lobby, error)
	ListOpenLobbies(ctx context.Context) ([]*Lobby, error)
	// AddPlayer adds p to the lobby; the store computes the next free slot.
	AddPlayer(ctx context.Context, lobbyID string, p Player) error
	RemovePlayer(ctx context.Context, lobbyID, playerID string) error
	UpdateLobbyStatus(
		ctx context.Context,
		lobbyID string,
		status Status,
		sessionID string,
	) error
}

// CreateInput holds the parameters needed to create a new lobby.
type CreateInput struct {
	Name         string
	HostPlayerID string
	DisplayName  string
	MaxPlayers   int
}

// JoinInput holds the parameters for a player joining a lobby.
type JoinInput struct {
	PlayerID    string
	DisplayName string
}

// Service provides lobby business logic.
type Service struct {
	store Store
}

// NewService constructs a Service backed by the given Store.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// ErrInvalidInput is returned for missing or malformed create/join inputs.
var ErrInvalidInput = errors.New("lobby: invalid input")

// Create creates a new open lobby and adds the host as slot-0 player.
func (s *Service) Create(ctx context.Context, in CreateInput) (*Lobby, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("%w: name required", ErrInvalidInput)
	}
	if in.HostPlayerID == "" {
		return nil, fmt.Errorf("%w: host_player_id required", ErrInvalidInput)
	}
	maxPlayers := in.MaxPlayers
	if maxPlayers <= 0 {
		maxPlayers = 4
	}

	id, err := newUUID()
	if err != nil {
		return nil, fmt.Errorf("lobby: generate id: %w", err)
	}

	now := time.Now().UTC()
	l := &Lobby{
		ID:           id,
		Name:         in.Name,
		HostPlayerID: in.HostPlayerID,
		MaxPlayers:   maxPlayers,
		Status:       StatusOpen,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.store.CreateLobby(ctx, l); err != nil {
		return nil, err
	}

	// Add host as slot-0
	host := Player{
		PlayerID:    in.HostPlayerID,
		DisplayName: in.DisplayName,
		Slot:        0,
		JoinedAt:    now,
	}
	if err := s.store.AddPlayer(ctx, l.ID, host); err != nil {
		return nil, err
	}

	return s.store.GetLobby(ctx, l.ID)
}

// Get retrieves a lobby by ID.
func (s *Service) Get(ctx context.Context, id string) (*Lobby, error) {
	return s.store.GetLobby(ctx, id)
}

// ListOpen returns all lobbies with status 'open'.
func (s *Service) ListOpen(ctx context.Context) ([]*Lobby, error) {
	return s.store.ListOpenLobbies(ctx)
}

// Join adds a player to an open lobby. Returns ErrFull, ErrAlreadyJoined,
// ErrNotFound, or ErrNotOpen on invalid preconditions.
func (s *Service) Join(
	ctx context.Context,
	lobbyID string,
	in JoinInput,
) (*Lobby, error) {
	l, err := s.store.GetLobby(ctx, lobbyID)
	if err != nil {
		return nil, err
	}
	if l.Status != StatusOpen {
		return nil, ErrNotOpen
	}
	// Check already joined
	for _, p := range l.Players {
		if p.PlayerID == in.PlayerID {
			return nil, ErrAlreadyJoined
		}
	}
	// Check capacity
	if len(l.Players) >= l.MaxPlayers {
		return nil, ErrFull
	}

	p := Player{
		PlayerID:    in.PlayerID,
		DisplayName: in.DisplayName,
		JoinedAt:    time.Now().UTC(),
	}
	if err := s.store.AddPlayer(ctx, lobbyID, p); err != nil {
		return nil, err
	}

	return s.store.GetLobby(ctx, lobbyID)
}

// Leave removes a player from a lobby. Returns ErrPlayerNotInLobby if not present.
func (s *Service) Leave(
	ctx context.Context,
	lobbyID, playerID string,
) (*Lobby, error) {
	l, err := s.store.GetLobby(ctx, lobbyID)
	if err != nil {
		return nil, err
	}
	_ = l // validate existence

	if err := s.store.RemovePlayer(ctx, lobbyID, playerID); err != nil {
		return nil, err
	}

	return s.store.GetLobby(ctx, lobbyID)
}

// Start transitions a lobby from open to in_game. Only the host may call this.
// Requires at least 1 player (the host). Generates a session_id UUID.
func (s *Service) Start(
	ctx context.Context,
	lobbyID, callerPlayerID string,
) (*Lobby, error) {
	l, err := s.store.GetLobby(ctx, lobbyID)
	if err != nil {
		return nil, err
	}
	if l.Status != StatusOpen {
		return nil, ErrNotOpen
	}
	if l.HostPlayerID != callerPlayerID {
		return nil, ErrNotHost
	}
	if len(l.Players) < 1 {
		return nil, ErrTooFewPlayers
	}

	sessionID, err := newUUID()
	if err != nil {
		return nil, fmt.Errorf("lobby: generate session_id: %w", err)
	}

	if err := s.store.UpdateLobbyStatus(ctx, lobbyID, StatusInGame, sessionID); err != nil {
		return nil, err
	}

	return s.store.GetLobby(ctx, lobbyID)
}

// newUUID generates a random UUID v4 as a hex string with dashes.
func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	// Set version 4 and variant bits
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	), nil
}
