//go:build integration

package store

import (
	"os"
	"testing"
)

func TestMigrateUpDownIntegration(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set")
	}

	if err := RunUp(databaseURL); err != nil {
		t.Fatalf("RunUp: %v", err)
	}

	v, err := Version(databaseURL)
	if err != nil {
		t.Fatalf("Version: %v", err)
	}
	if v.Version < 1 {
		t.Fatalf("Version = %d, want >= 1", v.Version)
	}
	if v.Dirty {
		t.Fatal("dirty flag set after RunUp")
	}

	if err := RunDown(databaseURL); err != nil {
		t.Fatalf("RunDown: %v", err)
	}

	if err := RunUp(databaseURL); err != nil {
		t.Fatalf("RunUp after down: %v", err)
	}
}
