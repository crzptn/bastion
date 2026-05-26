package users

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

// CreateUser inserts a new user row.
// Maps PostgreSQL unique-violation code 23505 → ErrDuplicateUsername.
func (s *PgxStore) CreateUser(ctx context.Context, u *User) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO users (id, username, password_hash, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		u.ID, u.Username, u.PasswordHash, u.CreatedAt, u.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrDuplicateUsername
		}
		return fmt.Errorf("users store: create: %w", err)
	}
	return nil
}

// GetUserByUsername retrieves a user by their username (case-insensitive).
func (s *PgxStore) GetUserByUsername(
	ctx context.Context,
	username string,
) (*User, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, username, password_hash, created_at, updated_at
		 FROM users WHERE lower(username) = lower($1)`,
		username,
	)
	return scanUser(row)
}

// GetUserByID retrieves a user by their primary key.
func (s *PgxStore) GetUserByID(ctx context.Context, id string) (*User, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, username, password_hash, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	)
	return scanUser(row)
}

func scanUser(row pgx.Row) (*User, error) {
	var u User
	if err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("users store: scan: %w", err)
	}
	return &u, nil
}
