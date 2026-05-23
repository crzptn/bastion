# AGENTS.md — Bastion contributor and agent contract

Read this document **first** before planning, implementing, or reviewing Bastion work. It is the canonical source for architecture rules and mandatory verification.

## Project summary

Bastion is a **co-op tower defense** game: a **Go API** (minmux router, PostgreSQL) and a **Bun + React SPA** under `web/`. The API serves JSON endpoints and, when built, static assets from `web/dist`.

## Hard rules — verification (non-negotiable)

1. **Everything observable must be verified end-to-end.** Unit tests alone are not enough for HTTP APIs or running services.
2. **New or changed API endpoints:** start the API (`go run ./cmd/api`, `docker compose up`, or equivalent), then **`curl` every new/changed route** — assert status code and response body match acceptance criteria.
3. **Delivery agents** follow `.cursor/rules/subagents.mdc` and `.cursor/verify-commands.md` for project-specific commands.
4. **Coder** must list every new/changed route in `HANDOFF:IMPLEMENTATION` → `smoke_endpoints` with concrete `expect` values.
5. **Smoke-tester** must not mark pass without live endpoint evidence when the issue touches HTTP.

### Smoke example

Start the API (database optional for `/health`; required for `/ready`):

```bash
go run ./cmd/api
# or: docker compose up --build
```

Verify health and readiness:

```bash
curl -s http://localhost:8080/health
curl -s http://localhost:8080/ready
```

Expected: `/health` returns `{"status":"ok","version":"..."}` (HTTP 200). `/ready` returns `{"status":"ready"}` (HTTP 200) when the database is reachable, or HTTP 503 with `{"status":"not_ready"}` otherwise.

## Hard rules — architecture (Go)

Package **by subsystem (bounded context)**, not by technical layer. Top-level directories under `internal/` are domain slices. Prefer **flat packages** with many `.go` files; add sub-folders only when a sub-feature has its own vocabulary and roughly **10+ files**.

**Do not introduce:**

```
internal/
  controllers/
  services/
  repositories/
  models/
```

Full detail, health-endpoint template, and minmux notes: **[docs/backend-architecture.md](docs/backend-architecture.md)**.

| Rule | Detail |
|------|--------|
| Domain purity | `internal/<subsystem>/` — business logic only; no `net/http`, no HTTP request DTOs |
| HTTP | `internal/http/*_endpoint.go` per subsystem; routes via [minmux](https://github.com/JoakimCarlsson/minmux) |
| SQL | `internal/<subsystem>/store.go` — not `internal/repositories/` |
| Shared DB | `internal/store/` — pool and migration runner only |
| `main.go` | Wiring only — env, pool, `http.NewHandler`, listen |

When adding a subsystem: domain package → optional `store.go` → `http/<name>_endpoint.go` → wire in `NewHandler`. Mirror `internal/health` + `health_endpoint.go`.

## Repo layout

| Path | Purpose |
|------|---------|
| `cmd/api/` | API entrypoint |
| `cmd/migrate/` | Migration CLI |
| `internal/` | Go subsystems (health, http, store, …) |
| `web/` | Bun + React SPA (all frontend source) |
| `deps/minmux/` | minmux git submodule (multi-module) |
| `migrations/` | SQL migrations (go-migrate) |
| `docker-compose.yml` | Local API + PostgreSQL |
| `docs/backend-architecture.md` | Backend architecture reference |

## Clone and submodule

```bash
git clone https://github.com/JoakimCarlsson/bastion.git
cd bastion
git submodule update --init --recursive
```

minmux is consumed via `go.mod` `replace` directives pointing at `./deps/minmux/<module>`.

## How to run

### Docker Compose (API + PostgreSQL)

```bash
cp .env.example .env
docker compose up --build
```

- API: [http://localhost:8080](http://localhost:8080) (`API_PORT` overrides)
- PostgreSQL: hostname `db` inside compose; use `localhost` in `DATABASE_URL` when running tools from the host

### Local Go API

```bash
go run ./cmd/api
```

- Listens on `:8080` by default (`API_PORT`)
- `DATABASE_URL` optional for `/health`; set for migrations and `/ready`
- Set `CORS_ORIGIN=http://localhost:5173` when using the Vite dev server (see `.env.example`)

### Frontend dev server

```bash
cd web
bun install
bun run dev
```

Vite runs on [http://localhost:5173](http://localhost:5173) and proxies `/health` to the API.

## Dev tooling (Makefile)

Run **`make install` once** before `make lint` (installs golangci-lint v2, goimports, golines into `$(go env GOPATH)/bin`).

| Target | Purpose |
|--------|---------|
| `make install` | Install Go lint/format tools (once) |
| `make workspace` | Copy `go.work.example` → `go.work` if missing |
| `make fmt` | `goimports` + `golines` on `cmd/` and `internal/` |
| `make lint` | `go vet ./...` + `golangci-lint run ./...` |
| `make web-install` | `bun install` in `web/` |
| `make web-fmt` | Prettier write in `web/` |
| `make web-lint` | ESLint in `web/` |
| `make check` | `lint` + `web-lint` + `go test -short ./...` |
| `make help` | List all targets |

Migration targets (`migrate-up`, `migrate-down`, `migrate-version`, `migrate-create`) are defined in the Makefile and require `DATABASE_URL`; see README and `.cursor/verify-commands.md`.

golangci-lint uses **v2** config (`.golangci.yml`, `version: "2"`). The vendored `deps/minmux` submodule is excluded from lint scope.

## Agent workflow

Delivery pipeline: **planner → coder → smoke-tester → reviewer** (see `.cursor/rules/subagents.mdc`).

| Resource | Purpose |
|----------|---------|
| `.cursor/agents/` | Agent role definitions (coder, planner, smoke-tester, reviewer) |
| `.cursor/verify-commands.md` | Runnable verification commands for smoke-tester |
| `.cursor/agents/_bastion-conventions.md` | Short conventions summary for agents |

## Security

Do **not** commit secrets, `.env` files with real credentials, or API keys. Use `.env.example` for documented placeholders.

## Quick reference

```bash
make install          # once
make workspace
make fmt && make lint
make web-install && make web-lint
make check
go test ./...
```
