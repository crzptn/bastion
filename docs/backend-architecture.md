# Backend architecture

Bastion organizes Go code **by subsystem (bounded context)**, not by technical layer. Each top-level directory under `internal/` is a domain slice with a flat package layout.

## Layout

```
bastion/
  cmd/api/main.go           # wiring only — env, dependencies, listen
  deps/minmux/              # git submodule (multi-module)
  migrations/               # SQL migrations (#4)
  internal/
    health/                 # pure domain
    http/                   # minmux routes and HTTP adapters
    store/                  # shared DB pool (#4 expands migrate)
  web/                      # Bun + React SPA (#3)
  go.mod
```

## Rules

### Package by subsystem

- Top-level dirs under `internal/` are bounded contexts (e.g. `health`, `lobby`, `game`).
- Prefer **flat packages** with many `.go` files in one directory.
- Add a sub-folder only when a sub-feature has its own vocabulary and roughly **10+ files**.

### Forbidden layered layout

Do **not** introduce:

```
internal/
  controllers/
  services/
  repositories/
  models/
```

### Domain purity

- Domain packages (`internal/<subsystem>/`) contain business logic and types only.
- **No** `net/http` imports in domain packages.
- **No** request/response DTOs tied to HTTP in domain packages.

### HTTP adapters

- All HTTP wiring lives in `internal/http/`.
- One file per subsystem endpoint group: `*_endpoint.go` (e.g. `health_endpoint.go` in #2).
- Routes are registered with **[minmux](https://github.com/JoakimCarlsson/minmux)** (`github.com/joakimcarlsson/minmux/router`).
- `cmd/api/main.go` stays thin: read config, construct `store.Pool`, call `http.NewHandler`, listen.

### Data access

- Per-subsystem SQL lives in `internal/<subsystem>/store.go`, not in a shared `repositories/` tree.
- Shared connection pooling and migration runner live in `internal/store/` (#4).

### Static SPA

- Frontend source is under `web/` (Bun + React, issue #3).
- Built assets go to `web/dist/`.
- The API serves the SPA via `router.SPA()` from `web/dist` once `web/dist/index.html` exists (#3).
- Do **not** mount the SPA until that file is present — the router expects a valid index.

### minmux submodule

- minmux is vendored as a **git submodule** at `deps/minmux`.
- It is a **multi-module** repository; `go.mod` uses per-module `replace` directives:

  ```go
  replace github.com/joakimcarlsson/minmux/router => ./deps/minmux/router
  ```

- After clone: `git submodule update --init --recursive`.

## Adding a new subsystem

1. Create `internal/<name>/` with domain types and logic (no HTTP).
2. Add `internal/<name>/store.go` if the subsystem needs SQL.
3. Add `internal/http/<name>_endpoint.go` to register minmux routes.
4. Wire dependencies in `http.NewHandler` — not in `main.go` beyond construction.

See [issue #5](https://github.com/JoakimCarlsson/bastion/issues/5) for Makefile fmt/lint targets and agent docs.

## Reference: health endpoint

`GET /health` is the template for every subsystem HTTP surface.

| File | Responsibility |
|------|----------------|
| `internal/health/health.go` | Domain logic — `Status()` returns `Result{OK, Version}`; no HTTP imports |
| `internal/http/health_endpoint.go` | HTTP adapter — maps domain result to JSON DTO, registers `r.Get("/health", ...)` |
| `internal/http/handler.go` | Router assembly — global middleware (recover, logging, CORS), calls `registerHealth` |
| `cmd/api/main.go` | Wiring only — env config, `store.Pool`, `http.NewHandler(pool, cfg)` |

Request flow:

```
GET /health
  → router middleware (Recover → logging → CORS)
  → healthHandler (internal/http)
  → health.Status() (internal/health)
  → JSON {"status":"ok","version":"..."}
```

When adding a subsystem, mirror this split: domain package, `*_endpoint.go` registration, wire in `NewHandler`.
