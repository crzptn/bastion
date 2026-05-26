CREATE TABLE scores (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wave_reached INT  NOT NULL,
    base_hp_left INT  NOT NULL,
    duration_ms  BIGINT NOT NULL,
    coop         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX scores_leaderboard_idx ON scores
    (wave_reached DESC, base_hp_left DESC, duration_ms ASC, created_at ASC);

CREATE INDEX scores_user_id_idx ON scores (user_id);
