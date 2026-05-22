package store

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// MigrationsPath returns the migrations directory from MIGRATIONS_PATH or "migrations".
func MigrationsPath() string {
	if p := os.Getenv("MIGRATIONS_PATH"); p != "" {
		return p
	}
	return "migrations"
}

func migrationsSourceURL() (string, error) {
	abs, err := filepath.Abs(MigrationsPath())
	if err != nil {
		return "", fmt.Errorf("store: migrations path: %w", err)
	}
	return "file://" + filepath.ToSlash(abs), nil
}

func newMigrate(databaseURL string) (*migrate.Migrate, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("store: DATABASE_URL is required")
	}

	sourceURL, err := migrationsSourceURL()
	if err != nil {
		return nil, err
	}

	m, err := migrate.New(sourceURL, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("store: migrate init: %w", err)
	}
	return m, nil
}

func closeMigrate(m *migrate.Migrate) {
	if m == nil {
		return
	}
	_, _ = m.Close()
}

// RunUp applies all pending migrations. ErrNoChange is treated as success.
func RunUp(databaseURL string) error {
	m, err := newMigrate(databaseURL)
	if err != nil {
		return err
	}
	defer closeMigrate(m)

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("store: migrate up: %w", err)
	}
	return nil
}

// RunDown rolls back one migration. ErrNoChange is treated as success.
func RunDown(databaseURL string) error {
	m, err := newMigrate(databaseURL)
	if err != nil {
		return err
	}
	defer closeMigrate(m)

	if err := m.Steps(-1); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("store: migrate down: %w", err)
	}
	return nil
}

// MigrationVersion holds the current schema version and dirty flag.
type MigrationVersion struct {
	Version uint
	Dirty   bool
}

// Version returns the current migration version. ErrNilVersion yields version 0.
func Version(databaseURL string) (MigrationVersion, error) {
	m, err := newMigrate(databaseURL)
	if err != nil {
		return MigrationVersion{}, err
	}
	defer closeMigrate(m)

	v, dirty, err := m.Version()
	if err != nil {
		if err == migrate.ErrNilVersion {
			return MigrationVersion{}, nil
		}
		return MigrationVersion{}, fmt.Errorf("store: migrate version: %w", err)
	}
	return MigrationVersion{Version: v, Dirty: dirty}, nil
}
