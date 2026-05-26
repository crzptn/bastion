package users

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    = 3
	argonMemory  = 1 << 16
	argonThreads = 4
	argonKeyLen  = 32
)

// Service provides user registration and authentication business logic.
type Service struct {
	store Store
}

// NewService constructs a Service backed by the given Store.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// Register creates a new user with an argon2id-hashed password.
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

	hash, err := hashPassword(password)
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
		Username:     strings.ToLower(username), // store username as lowercase.
		PasswordHash: hash,
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

	if err := verifyPassword(password, u.PasswordHash); err != nil {
		return nil, ErrInvalidCredentials
	}
	return u, nil
}

// GetByID returns a user by their ID.
func (s *Service) GetByID(ctx context.Context, id string) (*User, error) {
	return s.store.GetUserByID(ctx, id)
}

// hashPassword returns an argon2id PHC string:
// $argon2id$v=19$m=<memory>,t=<time>,p=<threads>$<base64-salt>$<base64-hash>
func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}

	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory, argonTime, argonThreads, b64Salt, b64Hash), nil
}

// verifyPassword checks a password against an argon2id PHC hash string.
func verifyPassword(password, encodedHash string) error {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return ErrInvalidCredentials
	}

	var memory, time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return ErrInvalidCredentials
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return ErrInvalidCredentials
	}

	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return ErrInvalidCredentials
	}

	expectedHash := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(hash)))

	if subtle.ConstantTimeCompare(expectedHash, hash) != 1 {
		return ErrInvalidCredentials
	}

	return nil
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
