package users

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Service provides user registration and authentication business logic.
type Service struct {
	store Store
}

// NewService constructs a Service backed by the given Store.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// Register creates a new user with a bcrypt-hashed password.
// Returns ErrDuplicateUsername if the username (case-insensitive) is taken.
// Returns ErrInvalidInput if username or password is empty.
func (s *Service) Register(
	ctx context.Context,
	username, password string,
) (*User, error) {
	if username == "" {
		return nil, fmt.Errorf("%w: username required", ErrInvalidInput)
	}
	if password == "" {
		return nil, fmt.Errorf("%w: password required", ErrInvalidInput)
	}

	hash, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, fmt.Errorf("users: hash password: %w", err)
	}

	id, err := newUUID()
	if err != nil {
		return nil, fmt.Errorf("users: generate id: %w", err)
	}

	now := time.Now().UTC()
	u := &User{
		ID:           id,
		Username:     username,
		PasswordHash: string(hash),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.store.CreateUser(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// Authenticate verifies the username and password pair.
// Returns ErrInvalidCredentials for unknown username or wrong password
// (intentionally unified to avoid user enumeration).
func (s *Service) Authenticate(
	ctx context.Context,
	username, password string,
) (*User, error) {
	u, err := s.store.GetUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	return u, nil
}

// GetByID returns a user by their ID.
func (s *Service) GetByID(ctx context.Context, id string) (*User, error) {
	return s.store.GetUserByID(ctx, id)
}

// newUUID generates a random UUID v4 as a hex string with dashes.
func newUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	// Set version 4 and variant bits.
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
