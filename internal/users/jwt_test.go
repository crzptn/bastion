package users_test

import (
	"testing"
	"time"

	"github.com/JoakimCarlsson/bastion/internal/users"
)

func TestJWT_RoundTrip(t *testing.T) {
	secret := []byte("testsecret-32-bytes-long-padding!")
	token, err := users.IssueToken("user-1", "alice", secret, time.Hour)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	claims, err := users.VerifyToken(token, secret)
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Errorf("UserID: got %q want %q", claims.UserID, "user-1")
	}
	if claims.Username != "alice" {
		t.Errorf("Username: got %q want %q", claims.Username, "alice")
	}
}

func TestJWT_TamperedToken(t *testing.T) {
	secret := []byte("testsecret-32-bytes-long-padding!")
	token, err := users.IssueToken("user-1", "alice", secret, time.Hour)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	// flip the last character
	tampered := token[:len(token)-1] + "X"
	if tampered == token {
		tampered = token[:len(token)-1] + "Y"
	}

	_, err = users.VerifyToken(tampered, secret)
	if err == nil {
		t.Fatal("expected error on tampered token, got nil")
	}
}

func TestJWT_ExpiredToken(t *testing.T) {
	secret := []byte("testsecret-32-bytes-long-padding!")
	// issue token that expired 1 second ago
	token, err := users.IssueToken("user-1", "alice", secret, -1*time.Second)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	_, err = users.VerifyToken(token, secret)
	if err == nil {
		t.Fatal("expected error on expired token, got nil")
	}
}

func TestJWT_WrongSecret(t *testing.T) {
	secret := []byte("testsecret-32-bytes-long-padding!")
	token, err := users.IssueToken("user-1", "alice", secret, time.Hour)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	wrongSecret := []byte("completely-different-secret-here!")
	_, err = users.VerifyToken(token, wrongSecret)
	if err == nil {
		t.Fatal("expected error on wrong secret, got nil")
	}
}
