CREATE TABLE IF NOT EXISTS lobbies (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    host_player_id TEXT NOT NULL,
    max_players INT  NOT NULL DEFAULT 4,
    status      TEXT NOT NULL DEFAULT 'open',
    session_id  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lobby_players (
    lobby_id    TEXT NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    player_id   TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    slot        INT  NOT NULL,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (lobby_id, player_id),
    UNIQUE (lobby_id, slot)
);
