package lobby

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
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

// CreateLobby inserts a new lobby row.
func (s *PgxStore) CreateLobby(ctx context.Context, l *Lobby) error {
	_, err := s.pool.Exec(
		ctx,
		`INSERT INTO lobbies (id, name, host_player_id, max_players, status, session_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		l.ID,
		l.Name,
		l.HostPlayerID,
		l.MaxPlayers,
		string(l.Status),
		nullableString(l.SessionID),
		l.CreatedAt,
		l.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("lobby store: create: %w", err)
	}
	return nil
}

// GetLobby retrieves a lobby and its players by ID.
func (s *PgxStore) GetLobby(ctx context.Context, id string) (*Lobby, error) {
	row := s.pool.QueryRow(
		ctx,
		`SELECT id, name, host_player_id, max_players, status, COALESCE(session_id,''), created_at, updated_at
		 FROM lobbies WHERE id = $1`,
		id,
	)

	var l Lobby
	var statusStr string
	if err := row.Scan(
		&l.ID, &l.Name, &l.HostPlayerID, &l.MaxPlayers,
		&statusStr, &l.SessionID, &l.CreatedAt, &l.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("lobby store: get: %w", err)
	}
	l.Status = Status(statusStr)

	players, err := s.getPlayers(ctx, id)
	if err != nil {
		return nil, err
	}
	l.Players = players
	return &l, nil
}

// ListOpenLobbies returns all lobbies with status='open' and their players.
func (s *PgxStore) ListOpenLobbies(ctx context.Context) ([]*Lobby, error) {
	rows, err := s.pool.Query(
		ctx,
		`SELECT id, name, host_player_id, max_players, status, COALESCE(session_id,''), created_at, updated_at
		 FROM lobbies WHERE status = 'open' ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("lobby store: list open: %w", err)
	}
	defer rows.Close()

	var lobbies []*Lobby
	for rows.Next() {
		var l Lobby
		var statusStr string
		if err := rows.Scan(
			&l.ID, &l.Name, &l.HostPlayerID, &l.MaxPlayers,
			&statusStr, &l.SessionID, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("lobby store: list open scan: %w", err)
		}
		l.Status = Status(statusStr)
		lobbies = append(lobbies, &l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lobby store: list open rows: %w", err)
	}

	// Attach players to each lobby
	for _, l := range lobbies {
		players, err := s.getPlayers(ctx, l.ID)
		if err != nil {
			return nil, err
		}
		l.Players = players
	}
	return lobbies, nil
}

// AddPlayer inserts a player into a lobby. The slot is computed as the
// lowest non-negative integer not already occupied in the lobby.
func (s *PgxStore) AddPlayer(
	ctx context.Context,
	lobbyID string,
	p Player,
) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("lobby store: add player begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Find used slots
	rows, err := tx.Query(
		ctx,
		`SELECT slot FROM lobby_players WHERE lobby_id = $1 FOR UPDATE`,
		lobbyID,
	)
	if err != nil {
		return fmt.Errorf("lobby store: add player query slots: %w", err)
	}
	used := make(map[int]bool)
	for rows.Next() {
		var slot int
		if err := rows.Scan(&slot); err != nil {
			rows.Close()
			return fmt.Errorf("lobby store: add player scan slot: %w", err)
		}
		used[slot] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("lobby store: add player rows err: %w", err)
	}

	// Compute next free slot
	slot := 0
	for used[slot] {
		slot++
	}

	_, err = tx.Exec(
		ctx,
		`INSERT INTO lobby_players (lobby_id, player_id, display_name, slot, joined_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		lobbyID,
		p.PlayerID,
		p.DisplayName,
		slot,
		p.JoinedAt,
	)
	if err != nil {
		return fmt.Errorf("lobby store: add player insert: %w", err)
	}

	return tx.Commit(ctx)
}

// RemovePlayer removes a player from a lobby. Returns ErrPlayerNotInLobby if not present.
func (s *PgxStore) RemovePlayer(
	ctx context.Context,
	lobbyID, playerID string,
) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM lobby_players WHERE lobby_id = $1 AND player_id = $2`,
		lobbyID, playerID,
	)
	if err != nil {
		return fmt.Errorf("lobby store: remove player: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrPlayerNotInLobby
	}
	return nil
}

// UpdateLobbyStatus sets the status and optionally the session_id on a lobby.
func (s *PgxStore) UpdateLobbyStatus(
	ctx context.Context,
	lobbyID string,
	status Status,
	sessionID string,
) error {
	tag, err := s.pool.Exec(ctx,
		`UPDATE lobbies SET status = $1, session_id = $2, updated_at = NOW()
		 WHERE id = $3`,
		string(status), nullableString(sessionID), lobbyID,
	)
	if err != nil {
		return fmt.Errorf("lobby store: update status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *PgxStore) getPlayers(
	ctx context.Context,
	lobbyID string,
) ([]Player, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT player_id, display_name, slot, joined_at
		 FROM lobby_players WHERE lobby_id = $1 ORDER BY slot`, lobbyID)
	if err != nil {
		return nil, fmt.Errorf("lobby store: get players: %w", err)
	}
	defer rows.Close()

	var players []Player
	for rows.Next() {
		var p Player
		if err := rows.Scan(&p.PlayerID, &p.DisplayName, &p.Slot, &p.JoinedAt); err != nil {
			return nil, fmt.Errorf("lobby store: get players scan: %w", err)
		}
		players = append(players, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lobby store: get players rows: %w", err)
	}
	return players, nil
}

// nullableString converts an empty string to nil for nullable SQL columns.
func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
