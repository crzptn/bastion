package scores

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgxStore is the PostgreSQL-backed implementation of Store.
type PgxStore struct {
	pool *pgxpool.Pool
}

// NewPgxStore constructs a PgxStore backed by pool.
func NewPgxStore(pool *pgxpool.Pool) *PgxStore {
	return &PgxStore{pool: pool}
}

// CreateScore inserts a new score row. Score.Username is not stored in the
// scores table (it lives in users); the caller need not populate it here.
func (s *PgxStore) CreateScore(ctx context.Context, sc *Score) error {
	_, err := s.pool.Exec(
		ctx,
		`INSERT INTO scores (id, user_id, wave_reached, base_hp_left, duration_ms, coop, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		sc.ID,
		sc.UserID,
		sc.WaveReached,
		sc.BaseHPLeft,
		sc.DurationMs,
		sc.Coop,
		sc.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("scores store: create: %w", err)
	}
	return nil
}

// TopScores returns the top limit scores joined with the username from users.
// Results are ordered wave_reached DESC, base_hp_left DESC, duration_ms ASC,
// created_at ASC — matching the leaderboard index.
func (s *PgxStore) TopScores(ctx context.Context, limit int) ([]*Score, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT s.id, s.user_id, u.username, s.wave_reached, s.base_hp_left,
		        s.duration_ms, s.coop, s.created_at
		 FROM scores s
		 JOIN users u ON u.id = s.user_id
		 ORDER BY s.wave_reached DESC, s.base_hp_left DESC, s.duration_ms ASC, s.created_at ASC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("scores store: top: %w", err)
	}
	defer rows.Close()

	var out []*Score
	for rows.Next() {
		var sc Score
		if err := rows.Scan(
			&sc.ID, &sc.UserID, &sc.Username,
			&sc.WaveReached, &sc.BaseHPLeft,
			&sc.DurationMs, &sc.Coop, &sc.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scores store: scan: %w", err)
		}
		out = append(out, &sc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scores store: rows: %w", err)
	}
	if out == nil {
		return []*Score{}, nil
	}
	return out, nil
}

