// Package users provides types and business logic for user registration and
// authentication.
package users

import (
	"context"
	"errors"
	"time"
)

// Sentinel errors returned by Service methods.
var (
	ErrDuplicateUsername  = errors.New("users: username already taken")
	ErrNotFound           = errors.New("users: not found")
	ErrInvalidCredentials = errors.New("users: invalid credentials")
	ErrInvalidInput       = errors.New("users: invalid input")
)

// User is the aggregate root for an authenticated user.
type User struct {
	ID           string
	Username     string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Store is the persistence interface required by Service.
// The pgx-backed implementation lives in store.go.
type Store interface {
	CreateUser(ctx context.Context, u *User) error
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserByID(ctx context.Context, id string) (*User, error)
}
