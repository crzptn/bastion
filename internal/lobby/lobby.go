// Package lobby provides types and business logic for pre-game lobbies.
package lobby

import "time"

// Status represents the lifecycle state of a lobby.
type Status string

const (
	StatusOpen     Status = "open"
	StatusStarting Status = "starting"
	StatusInGame   Status = "in_game"
	StatusClosed   Status = "closed"
)

// Player is a participant in a lobby.
type Player struct {
	PlayerID    string
	DisplayName string
	Slot        int
	JoinedAt    time.Time
}

// Lobby is the aggregate root for a pre-game room.
type Lobby struct {
	ID           string
	Name         string
	HostPlayerID string
	MaxPlayers   int
	Status       Status
	SessionID    string // non-empty after Start()
	Players      []Player
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
