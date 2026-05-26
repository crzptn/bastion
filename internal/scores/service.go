package scores

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// Service provides score submission and leaderboard retrieval logic.
type Service struct {
	store Store
}

// NewService constructs a Service backed by the given Store.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// Submit persists a new score for the given user and returns the stored entry.
// userID must be the authenticated caller's ID.
func (s *Service) Submit(
	ctx context.Context,
	userID string,
	in SubmitInput,
) (*Score, error) {
	if userID == "" {
		return nil, fmt.Errorf("%w: user_id required", ErrInvalidInput)
	}

	id, err := newUUID()
	if err != nil {
		return nil, fmt.Errorf("scores: generate id: %w", err)
	}

	score := &Score{
		ID:          id,
		UserID:      userID,
		WaveReached: in.WaveReached,
		BaseHPLeft:  in.BaseHPLeft,
		DurationMs:  in.DurationMs,
		Coop:        in.Coop,
		CreatedAt:   time.Now().UTC(),
	}

	if err := s.store.CreateScore(ctx, score); err != nil {
		return nil, err
	}
	return score, nil
}

// Top returns the top N scores in leaderboard order.
// limit is clamped to [1, 100]; a value of 0 defaults to 10.
func (s *Service) Top(ctx context.Context, limit int) ([]*Score, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	return s.store.TopScores(ctx, limit)
}

// newUUID generates a random UUID v4 formatted with dashes.
func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
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
