# bastion

Tower-defense game backend and SPA monorepo.

## Prerequisites

- [Go](https://go.dev/dl/) 1.25+
- [Bun](https://bun.sh/) 1.1+ (frontend tooling)
- [Docker](https://www.docker.com/) and Docker Compose
- [Git](https://git-scm.com/)

## Clone and submodules

```bash
git clone https://github.com/JoakimCarlsson/bastion.git
cd bastion
git submodule update --init --recursive
```

The [minmux](https://github.com/JoakimCarlsson/minmux) router is vendored at `deps/minmux` as a git submodule. Bastion's `go.mod` uses `replace` directives so `github.com/joakimcarlsson/minmux/*` modules resolve to `./deps/minmux/<module>`.

## Configuration

Copy the example environment file and adjust if needed:

```bash
cp .env.example .env
```

Variables are documented in `.env.example`. Inside Docker Compose, the API uses hostname `db` for PostgreSQL; for a local `go run` against a compose database, point `DATABASE_URL` at `localhost`.

## Docker Compose (API + PostgreSQL)

```bash
docker compose up --build
```

- **api** — Go API on [http://localhost:8080](http://localhost:8080) (port configurable via `API_PORT`)
- **db** — PostgreSQL 16 with a health check

Both services should reach a healthy state. Verify the API with:

```bash
curl -s http://localhost:8080/health
```

Expected JSON: `{"status":"ok","version":"dev"}` (version follows `API_VERSION` or `VERSION` when set). With a built frontend (`web/dist`), the same origin also serves the React SPA at `/`.

Readiness (database connectivity):

```bash
curl -s http://localhost:8080/ready
```

Expected JSON when the database is reachable: `{"status":"ready"}` (HTTP 200). Returns HTTP 503 with `{"status":"not_ready"}` when `store.Ping` fails.

On startup the API applies pending migrations automatically when `DATABASE_URL` is set, then verifies connectivity before listening.

## Database migrations

Migrations are managed with [go-migrate](https://github.com/golang-migrate/migrate) (`github.com/golang-migrate/migrate/v4`). SQL files live in `migrations/` using the sequential naming convention (`000001_init.up.sql` / `000001_init.down.sql`).

| Target | Purpose |
|--------|---------|
| `make migrate-up` | Apply all pending migrations |
| `make migrate-down` | Roll back one migration (**dev only** — can drop schema objects) |
| `make migrate-version` | Print current version and dirty flag |
| `make migrate-create NAME=...` | Create a new migration pair via the official migrate CLI |

All Makefile migration targets require `DATABASE_URL` in the environment.

**Hostname:** Inside Docker Compose the API connects to PostgreSQL at host `db`. For local `go run` or `make migrate-*` against a compose database, set `DATABASE_URL` to use `localhost` instead (see `.env.example`).

**PowerShell (export env from `.env`):**

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') { Set-Item -Path "Env:$($matches[1].Trim())" -Value $matches[2].Trim() }
}
```

**Bash:**

```bash
set -a; source .env; set +a
```

**Integration tests:** `go test -tags=integration ./internal/store/...` runs migrate up/down when `DATABASE_URL` points at a live database; skipped otherwise.

**Container path:** The Docker image copies migrations to `/migrations` and sets `MIGRATIONS_PATH=/migrations`.

## Frontend (Bun + React + Vite + Tailwind 4)

The SPA lives under `web/`. Linting uses **ESLint**; formatting uses **Prettier** (see scripts below).

```bash
cd web
bun install
```

### Development

Run the Go API (see [Local build](#local-build)), then start Vite on port 5173:

```bash
cd web
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `GET /health` to the API (`http://localhost:8080` by default). Optionally set `VITE_API_URL=http://localhost:8080` in `web/.env` to fetch the API directly instead of via the proxy.

Set `CORS_ORIGIN=http://localhost:5173` in the root `.env` when using the dev server (already in `.env.example`).

### Production build

```bash
cd web
bun run build
```

Produces `web/dist/`. When `web/dist/index.html` exists, `go run ./cmd/api` serves the SPA from `/` (override path with `WEB_DIST`).

| Script | Purpose |
|--------|---------|
| `bun run dev` | Vite dev server with API proxy |
| `bun run build` | Typecheck + production bundle to `dist/` |
| `bun run lint` | ESLint |
| `bun run format` | Prettier write |
| `bun run format:check` | Prettier check (CI-friendly) |
| `bun run typecheck` | TypeScript project references |

### API URL modes

- **Production / same-origin:** leave `VITE_API_URL` unset; the app fetches `/health` on the API host.
- **Vite dev:** rely on the proxy, or set `VITE_API_URL` to the API base (e.g. `http://localhost:8080`).

## Local build

After submodule init:

```bash
go build ./cmd/api
go build ./cmd/migrate
```

## Architecture

Backend packaging rules (subsystem-oriented layout, minmux, domain purity) are documented in [docs/backend-architecture.md](docs/backend-architecture.md).

## Makefile

Run `make help` for available targets. Migration targets (`migrate-up`, `migrate-down`, `migrate-version`, `migrate-create`) require `DATABASE_URL`. Full fmt/lint/dev targets are planned in [issue #5](https://github.com/JoakimCarlsson/bastion/issues/5).

## License

MIT — see [LICENSE](LICENSE).
