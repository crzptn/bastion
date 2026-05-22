package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool wraps a PostgreSQL connection pool. Migrations arrive in issue #4.
type Pool struct {
	pool *pgxpool.Pool
}

// New opens a connection pool when databaseURL is non-empty.
func New(ctx context.Context, databaseURL string) (*Pool, error) {
	if databaseURL == "" {
		return &Pool{}, nil
	}

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("store: connect: %w", err)
	}

	return &Pool{pool: pool}, nil
}

// Ping verifies the database is reachable.
func (p *Pool) Ping(ctx context.Context) error {
	if p.pool == nil {
		return nil
	}
	return p.pool.Ping(ctx)
}

// Close releases pool resources.
func (p *Pool) Close() {
	if p.pool != nil {
		p.pool.Close()
	}
}
