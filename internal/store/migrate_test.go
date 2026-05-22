package store

import (
	"path/filepath"
	"testing"
)

func TestMigrationsPathDefault(t *testing.T) {
	t.Setenv("MIGRATIONS_PATH", "")
	if got := MigrationsPath(); got != "migrations" {
		t.Errorf("MigrationsPath() = %q, want migrations", got)
	}
}

func TestMigrationsPathFromEnv(t *testing.T) {
	t.Setenv("MIGRATIONS_PATH", "/custom/migrations")
	if got := MigrationsPath(); got != "/custom/migrations" {
		t.Errorf("MigrationsPath() = %q, want /custom/migrations", got)
	}
}

func TestMigrationsSourceURL(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("MIGRATIONS_PATH", dir)

	url, err := migrationsSourceURL()
	if err != nil {
		t.Fatalf("migrationsSourceURL: %v", err)
	}

	abs, err := filepath.Abs(dir)
	if err != nil {
		t.Fatalf("filepath.Abs: %v", err)
	}
	want := "file://" + filepath.ToSlash(abs)
	if url != want {
		t.Errorf("migrationsSourceURL() = %q, want %q", url, want)
	}
}

func TestRunUpRequiresDatabaseURL(t *testing.T) {
	if err := RunUp(""); err == nil {
		t.Fatal("RunUp(\"\"): expected error")
	}
}

func TestRunDownRequiresDatabaseURL(t *testing.T) {
	if err := RunDown(""); err == nil {
		t.Fatal("RunDown(\"\"): expected error")
	}
}

func TestVersionRequiresDatabaseURL(t *testing.T) {
	if _, err := Version(""); err == nil {
		t.Fatal("Version(\"\"): expected error")
	}
}
