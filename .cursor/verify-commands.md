# Verification commands

Run from the repository root unless noted.

## Submodule

```bash
git submodule update --init --recursive
```

**Expected:** `deps/minmux` is populated (e.g. `deps/minmux/router/go.mod` exists).

## Go build

```bash
go build ./cmd/api
go build ./cmd/migrate
```

**Expected:** exits 0; produces `api` and `migrate` binaries (or `.exe` on Windows) in the current directory.

Optional:

```bash
go build -o bin/api ./cmd/api
go build -o bin/migrate ./cmd/migrate
```

## Go test

```bash
go test ./...
```

**Expected:** all unit tests pass without Docker.

Optional integration (requires live Postgres and `DATABASE_URL`):

```bash
go test -tags=integration ./internal/store/...
```

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

**Expected:**

- `db` service becomes healthy (`pg_isready` passes).
- `api` service starts, applies migrations, and logs `listening on :8080`.
- API port `${API_PORT:-8080}` is reachable on the host.

Stop with `Ctrl+C`, then:

```bash
docker compose down
```

Optional database check while compose is up:

```bash
docker compose exec db pg_isready -U bastion -d bastion
docker compose exec db psql -U bastion -d bastion -c '\dt'
```

**Expected:** `pg_isready` reports `accepting connections`; `\dt` lists `schema_migrations` and `bastion_schema_marker`.

## Migrations (Makefile)

Export `DATABASE_URL` first (use `localhost` as host when running from the host against compose `db`):

```bash
# bash
set -a; source .env; set +a
# then override host for host-side commands:
export DATABASE_URL=postgres://bastion:bastion@localhost:5432/bastion?sslmode=disable

make migrate-version
make migrate-up
```

**Expected:** `migrate-version` prints `version: 1 dirty: false` (or higher if already migrated); `migrate-up` succeeds with no pending migrations.

Dev-only rollback:

```bash
make migrate-down
make migrate-up
```

**Expected:** down removes `bastion_schema_marker`; up restores it.

## Layout checks

```bash
# internal/ must not contain layered dirs
test ! -d internal/controllers
test ! -d internal/services
test ! -d internal/repositories
test ! -d internal/models
```

**Expected:** all commands succeed (exit 0).

Required stubs:

```bash
test -d internal/health
test -d internal/http
test -d internal/store
test -f docs/backend-architecture.md
test -f .env.example
```

**Expected:** all paths exist.

## Makefile

```bash
make help
make migrate-version
```

**Expected:** `help` lists migration targets; `migrate-version` requires `DATABASE_URL` and prints version/dirty (see Migrations section).

## Frontend (web/)

From `web/` after `bun install`:

```bash
cd web
bun run build
bun run lint
bun run typecheck
```

**Expected:** build writes `dist/index.html` and assets; lint and typecheck exit 0.

With API running and `web/dist` built:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
curl -s http://localhost:8080/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ready
curl -s http://localhost:8080/ready
```

**Expected:** `/` returns 200 (HTML); `/health` returns JSON `{"status":"ok",...}`; `/ready` returns HTTP 200 with `{"status":"ready"}` when the database is up.
