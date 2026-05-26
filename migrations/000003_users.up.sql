CREATE TABLE users (
    id           TEXT        PRIMARY KEY,
    username     TEXT        NOT NULL,
    password_hash TEXT       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique index on username.
CREATE UNIQUE INDEX users_lower_username_uidx ON users (lower(username));
