package users

import (
	"strings"
	"testing"
)

func TestHashPassword_ReturnsValidPHCString(t *testing.T) {
	encoded, err := hashPassword("hunter2")
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}

	parts := strings.Split(encoded, "$")
	if len(parts) != 6 {
		t.Fatalf("expected 6 PHC segments, got %d: %q", len(parts), encoded)
	}

	if parts[1] != "argon2id" {
		t.Errorf("expected argon2id algorithm, got %q", parts[1])
	}

	if len(parts[4]) == 0 || len(parts[5]) == 0 {
		t.Error("salt or hash segment is empty")
	}
}

func TestHashPassword_UniqueSalt(t *testing.T) {
	h1, _ := hashPassword("hunter2")
	h2, _ := hashPassword("hunter2")
	if h1 == h2 {
		t.Error("expected different hashes due to random salt, got identical")
	}
}

func TestVerifyPassword_Success(t *testing.T) {
	encoded, err := hashPassword("hunter2")
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}

	if err := verifyPassword("hunter2", encoded); err != nil {
		t.Errorf("verifyPassword failed: %v", err)
	}
}

func TestVerifyPassword_WrongPassword(t *testing.T) {
	encoded, err := hashPassword("hunter2")
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}

	if err := verifyPassword("wrong", encoded); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_InvalidPrefix(t *testing.T) {
	if err := verifyPassword("hunter2", "$2a$10$abc"); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_WrongAlgorithm(t *testing.T) {
	if err := verifyPassword("hunter2", "$argon2i$v=19$m=65536,t=1,p=4$c2FsdA$eGhhc2g"); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_TooFewSegments(t *testing.T) {
	if err := verifyPassword("hunter2", "$argon2id$abc"); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_InvalidBase64Salt(t *testing.T) {
	encoded := "$argon2id$v=19$m=65536,t=1,p=4$!!!invalid-b64!!!$YQ"
	if err := verifyPassword("hunter2", encoded); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_InvalidBase64Hash(t *testing.T) {
	encoded := "$argon2id$v=19$m=65536,t=1,p=4$c2FsdA$!!!invalid-b64!!!"
	if err := verifyPassword("hunter2", encoded); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_InvalidParams(t *testing.T) {
	encoded := "$argon2id$v=19$not-valid-params$c2FsdA$YQ"
	if err := verifyPassword("hunter2", encoded); err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestVerifyPassword_EmptyPassword(t *testing.T) {
	encoded, err := hashPassword("")
	if err != nil {
		t.Fatalf("hashPassword empty: %v", err)
	}

	if err := verifyPassword("", encoded); err != nil {
		t.Errorf("verifyPassword empty password failed: %v", err)
	}
}
