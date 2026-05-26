package users_test

import (
	"context"
	"strings"
	"testing"

	"github.com/JoakimCarlsson/bastion/internal/users"
)

// --- fake Store ---

type fakeStore struct {
	byUsername map[string]*users.User
	byID       map[string]*users.User
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		byUsername: make(map[string]*users.User),
		byID:       make(map[string]*users.User),
	}
}

func (s *fakeStore) CreateUser(_ context.Context, u *users.User) error {
	key := lowerKey(u.Username)
	if _, exists := s.byUsername[key]; exists {
		return users.ErrDuplicateUsername
	}
	// store a copy
	cp := *u
	s.byUsername[key] = &cp
	s.byID[u.ID] = &cp
	return nil
}

func (s *fakeStore) GetUserByUsername(
	_ context.Context,
	username string,
) (*users.User, error) {
	u, ok := s.byUsername[lowerKey(username)]
	if !ok {
		return nil, users.ErrNotFound
	}
	cp := *u
	return &cp, nil
}

func (s *fakeStore) GetUserByID(
	_ context.Context,
	id string,
) (*users.User, error) {
	u, ok := s.byID[id]
	if !ok {
		return nil, users.ErrNotFound
	}
	cp := *u
	return &cp, nil
}

func lowerKey(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		b[i] = c
	}
	return string(b)
}

// --- AC1 tests ---

func TestService_Register_Success(t *testing.T) {
	svc := users.NewService(newFakeStore())
	u, err := svc.Register(context.Background(), "alice", "hunter2")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if u.ID == "" {
		t.Error("expected non-empty ID")
	}
	if u.Username != "alice" {
		t.Errorf("username: got %q want %q", u.Username, "alice")
	}
}

func TestService_Register_Duplicate(t *testing.T) {
	svc := users.NewService(newFakeStore())
	_, err := svc.Register(context.Background(), "alice", "hunter2")
	if err != nil {
		t.Fatalf("first Register: %v", err)
	}
	_, err = svc.Register(context.Background(), "alice", "other")
	if err == nil {
		t.Fatal("expected error on duplicate, got nil")
	}
	if !isDuplicateUsername(err) {
		t.Errorf("expected ErrDuplicateUsername, got %v", err)
	}
}

func TestService_Register_DuplicateCaseInsensitive(t *testing.T) {
	svc := users.NewService(newFakeStore())
	_, err := svc.Register(context.Background(), "Alice", "hunter2")
	if err != nil {
		t.Fatalf("first Register: %v", err)
	}
	_, err = svc.Register(context.Background(), "alice", "other")
	if err == nil {
		t.Fatal("expected error on case-insensitive duplicate, got nil")
	}
	if !isDuplicateUsername(err) {
		t.Errorf("expected ErrDuplicateUsername, got %v", err)
	}
}

// --- AC2 tests ---

func TestService_Authenticate_Success(t *testing.T) {
	svc := users.NewService(newFakeStore())
	_, err := svc.Register(context.Background(), "bob", "secret123")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	u, err := svc.Authenticate(context.Background(), "bob", "secret123")
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if u.Username != "bob" {
		t.Errorf("username: got %q want %q", u.Username, "bob")
	}
}

func TestService_Authenticate_WrongPassword(t *testing.T) {
	svc := users.NewService(newFakeStore())
	_, err := svc.Register(context.Background(), "bob", "secret123")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	_, err = svc.Authenticate(context.Background(), "bob", "wrongpassword")
	if err == nil {
		t.Fatal("expected error on wrong password, got nil")
	}
	if !isInvalidCredentials(err) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestService_Authenticate_UnknownUser(t *testing.T) {
	svc := users.NewService(newFakeStore())
	_, err := svc.Authenticate(context.Background(), "nobody", "pass")
	if err == nil {
		t.Fatal("expected error for unknown user, got nil")
	}
	if !isInvalidCredentials(err) {
		t.Errorf(
			"expected ErrInvalidCredentials (not ErrNotFound), got %v",
			err,
		)
	}
}

// --- AC4 tests ---

func TestService_StoresOnlyHash(t *testing.T) {
	store := newFakeStore()
	svc := users.NewService(store)
	plaintext := "mysupersecret"
	u, err := svc.Register(context.Background(), "charlie", plaintext)
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	// Must be an argon2id PHC string
	if !strings.HasPrefix(u.PasswordHash, "$argon2id$") {
		t.Errorf("PasswordHash does not look like argon2id: %q", u.PasswordHash)
	}

	// Verify via authentication using the stored hash
	if _, err := svc.Authenticate(context.Background(), "charlie", plaintext); err != nil {
		t.Errorf("Authenticate failed with stored hash: %v", err)
	}

	// plaintext must not be stored anywhere in the hash
	if u.PasswordHash == plaintext {
		t.Error("plaintext password stored as hash — CRITICAL")
	}
}

// helpers to avoid importing errors in test and keep it readable

func isDuplicateUsername(err error) bool {
	return isErr(err, users.ErrDuplicateUsername)
}

func isInvalidCredentials(err error) bool {
	return isErr(err, users.ErrInvalidCredentials)
}

func isErr(err, target error) bool {
	if err == nil {
		return false
	}
	// unwrap chain
	for e := err; e != nil; {
		if e == target {
			return true
		}
		type unwrapper interface{ Unwrap() error }
		if u, ok := e.(unwrapper); ok {
			e = u.Unwrap()
		} else {
			break
		}
	}
	return false
}
