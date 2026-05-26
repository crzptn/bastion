// Package scores provides types and business logic for persisting and
// retrieving per-run leaderboard scores.
package scores

import (
	"context"
	"errors"
	"time"
)

// Sentinel errors returned by Service methods.
var (
	ErrInvalidInput = errors.New("scores: invalid input")
	ErrNotFound     = errors.New("scores: not found")
)

// Score is the aggregate root for a single game-run result.
type Score struct {
	ID          string
	UserID      string
	Username    string // joined from users table
	WaveReached int
	BaseHPLeft  int
	DurationMs  int64
	Coop        bool
	CreatedAt   time.Time
}

// SubmitInput carries the caller-supplied fields when persisting a new score.
type SubmitInput struct {
	WaveReached int
	BaseHPLeft  int
	DurationMs  int64
	Coop        bool
}

// Store is the persistence interface required by Service.
// The pgx-backed implementation lives in store.go.
type Store interface {
	// CreateScore persists a new score row. Score.ID and Score.CreatedAt are
	// set by the caller (service layer) before the call.
	CreateScore(ctx context.Context, s *Score) error

	// TopScores returns at most limit scores in leaderboard order:
	// wave_reached DESC, base_hp_left DESC, duration_ms ASC, created_at ASC.
	// Username must be populated via a JOIN to the users table.
	TopScores(ctx context.Context, limit int) ([]*Score, error)
}
