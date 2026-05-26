# Verification commands

Run from the repository root unless noted.

> **Note on DB-required routes:** Routes marked **(DB)** require a running
> PostgreSQL instance (set `DATABASE_URL`). When the database is down or
> unreachable, those routes return 5xx even though they are registered
> (LEARNINGS #66). Routes marked **(no DB)** work without a database.

## Prerequisites

Before running any verification command, ensure these tools are installed:

| Tool | Minimum version | Install hint |
|------|-----------------|--------------|
| Go | 1.22+ | https://go.dev/dl/ |
| Bun | 1.1+ | https://bun.sh |
| Docker (with Compose v2) | any recent | https://docs.docker.com/get-docker/ |
| `gh` CLI | any recent | https://cli.github.com |

Clone the repository and initialise the submodule:

```bash
git clone https://github.com/JoakimCarlsson/bastion.git
cd bastion
git submodule update --init --recursive
```

**Expected:** `deps/minmux/router/go.mod` exists after the submodule step.

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

## Makefile

Run **`make install` once** before `make lint` (installs golangci-lint v2, goimports, golines).

```bash
make help
make install
make workspace
make fmt
make lint
make web-install
make web-fmt
make web-lint
make check
make migrate-version
```

**Expected:**

- `help` lists dev, web, and migration targets.
- `install` exits 0 and places tools in `$(go env GOPATH)/bin`.
- `workspace` creates `go.work` from `go.work.example` when missing.
- `fmt`, `lint`, `web-lint`, and `check` exit 0 on a clean tree.
- `migrate-version` requires `DATABASE_URL` and prints version/dirty (see Migrations section).

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

## Migrations

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

## Frontend (web/)

From `web/` after `bun install`:

```bash
cd web
bun run build
bun run lint
bun run typecheck
bun run test
```

**Expected:** build writes `dist/index.html` and assets; lint, typecheck, and test all exit 0. Test output should show 4 test files, 83+ tests passed.

With API running and `web/dist` built:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
curl -s http://localhost:8080/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ready
curl -s http://localhost:8080/ready
```

**Expected:** `/` returns 200 (HTML); `/health` returns JSON `{"status":"ok",...}`; `/ready` returns HTTP 200 with `{"status":"ready"}` when the database is up.

## HTTP smoke

Start the server first. For routes marked **(DB)** you need a running database:

```bash
# With database (Docker Compose):
cp .env.example .env && docker compose up --build -d

# Without database (no-DB routes only):
go run ./cmd/api
```

### Health and readiness

```bash
# GET /health — no DB
curl -s http://localhost:8080/health
```
**Expected:** HTTP 200, body contains `{"status":"ok",...}`.

```bash
# GET /ready — DB
curl -s http://localhost:8080/ready
```
**Expected:** HTTP 200 `{"status":"ready"}` when DB is up; HTTP 503 `{"status":"not_ready"}` when DB is down.

### Auth routes (DB)

```bash
# POST /api/auth/register → 201 {user_id, username}
curl -s -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"smokeuser","password":"smokepass123"}'
```
**Expected:** HTTP 201, body `{"user_id":"<uuid>","username":"smokeuser"}`.

```bash
# POST /api/auth/login → 200 {token, user{id,username,created_at}}
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"smokeuser","password":"smokepass123"}'
```
**Expected:** HTTP 200, body `{"token":"<jwt>","user":{"id":...,"username":"smokeuser","created_at":...}}`.

Store the token for subsequent calls:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"smokeuser","password":"smokepass123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

```bash
# GET /api/auth/me — DB; requires valid Bearer token
curl -s http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** HTTP 200, body `{"id":"<uuid>","username":"smokeuser","created_at":"..."}`. Without a token: HTTP 401.

### Lobby routes (DB)

```bash
# POST /api/lobbies → 201 lobbyResponse
curl -s -X POST http://localhost:8080/api/lobbies \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke-lobby","host_player_id":"player-1","display_name":"Smoke","max_players":2}'
```
**Expected:** HTTP 201, body contains `{"id":"<uuid>","name":"smoke-lobby","status":"open",...}`.

Store the lobby ID:

```bash
LOBBY_ID=$(curl -s -X POST http://localhost:8080/api/lobbies \
  -H 'Content-Type: application/json' \
  -d '{"name":"smoke-lobby2","host_player_id":"player-1","display_name":"Smoke","max_players":2}' \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
```

```bash
# GET /api/lobbies → 200 [lobbyResponse]
curl -s http://localhost:8080/api/lobbies
```
**Expected:** HTTP 200, JSON array of open lobbies.

```bash
# GET /api/lobbies/{id} → 200 | 404
curl -s http://localhost:8080/api/lobbies/$LOBBY_ID
curl -s http://localhost:8080/api/lobbies/nonexistent-id
```
**Expected:** first returns HTTP 200 with lobby details; second returns HTTP 404.

```bash
# POST /api/lobbies/{id}/join → 200 | 4xx
curl -s -X POST http://localhost:8080/api/lobbies/$LOBBY_ID/join \
  -H 'Content-Type: application/json' \
  -d '{"player_id":"player-2","display_name":"Player2"}'
```
**Expected:** HTTP 200, updated lobbyResponse with both players.

```bash
# POST /api/lobbies/{id}/leave → 200 | 4xx
curl -s -X POST http://localhost:8080/api/lobbies/$LOBBY_ID/leave \
  -H 'Content-Type: application/json' \
  -d '{"player_id":"player-2"}'
```
**Expected:** HTTP 200, lobbyResponse with player-2 removed.

```bash
# POST /api/lobbies/{id}/start → 200 with session_id (needs ≥2 players)
# First re-add player-2, then start:
curl -s -X POST http://localhost:8080/api/lobbies/$LOBBY_ID/join \
  -H 'Content-Type: application/json' \
  -d '{"player_id":"player-2","display_name":"Player2"}'

curl -s -X POST http://localhost:8080/api/lobbies/$LOBBY_ID/start \
  -H 'Content-Type: application/json' \
  -d '{"player_id":"player-1"}'
```
**Expected:** HTTP 200, lobbyResponse with `"status":"in_game"` and a non-empty `"session_id"`.

### Session snapshot (no DB — in-memory)

```bash
# GET /api/sessions/{id}/snapshot → 200 | 404
SESSION_ID=<session_id from start response>
curl -s http://localhost:8080/api/sessions/$SESSION_ID/snapshot
curl -s http://localhost:8080/api/sessions/nonexistent/snapshot
```
**Expected:** first returns HTTP 200 with snapshot fields (`id`, `gold`, `base_hp`, `wave_index`, `phase`, `towers`, `enemies`, `tick`); second returns HTTP 404.

### Scores and leaderboard (DB)

```bash
# POST /api/scores → 201 (requires Bearer token)
curl -s -X POST http://localhost:8080/api/scores \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"wave_reached":3,"base_hp_left":15,"duration_ms":120000,"coop":false}'
```
**Expected:** HTTP 201, scoreDTO body with `id`, `user_id`, `username`, `wave_reached`, `base_hp_left`, `duration_ms`, `coop`, `created_at`. Without token: HTTP 401.

```bash
# GET /api/leaderboard → 200 [scoreDTO]
curl -s http://localhost:8080/api/leaderboard
curl -s "http://localhost:8080/api/leaderboard?limit=5"
```
**Expected:** HTTP 200, JSON array of score DTOs ordered by score descending.

## WebSocket smoke

The WebSocket endpoint is `GET /api/ws`. The `?room=<id>` query parameter is
required; `?session=<id>` is optional and associates the connection with a
running game session. No token parameter is used; origin checking is disabled
(`InsecureSkipVerify=true`).

Use a curl HTTP-upgrade handshake probe to confirm the endpoint is alive:

```bash
curl -i -N \
  -H 'Connection: Upgrade' \
  -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  "http://localhost:8080/api/ws?room=smoke"
```

**Expected:** HTTP 101 Switching Protocols. The server upgrades the connection,
and the first data frame (informational — not verified by this probe) is a
join-ack JSON message:

```json
{"type":"join_ack","payload":{"room":"smoke","client_id":"conn-1"}}
```

Missing `?room`: expect HTTP 400 `{"error":"room query parameter required"}`.

```bash
curl -s "http://localhost:8080/api/ws"
```
**Expected:** HTTP 400.

## Manual play smoke (/play)

Run with `bun run dev` in `web/` (and optionally `go run ./cmd/api` for health status):

1. Open http://localhost:5173/play in a browser.
2. Confirm HUD shows: Wave 1/3, Gold 100, Base HP 20, Phase prep.
3. Click **New game** — verify state resets (gold back to 100, waveIndex back to 0, phase back to prep).
4. Select the **Archer** tower from the tower bar.
5. Click a buildable cell on the map — confirm a tower appears on the canvas and gold decreases by 25.
6. Click **Start wave** — button should become disabled; Phase changes to combat; enemies appear and begin moving.
7. Watch enemies move along the path. When towers fire and kill enemies, gold should increase (10g per goblin kill).
8. After all enemies die, phase returns to **prep**; wave counter advances to 2/3.
9. Repeat steps 5–8 for waves 2 and 3.
10. After clearing wave 3: a **Victory** overlay appears over the canvas showing "You cleared all 3 waves!". Confirm Start wave button is disabled.
11. Click **Restart** in the overlay — confirm state resets (gold 100, baseHp 20, phase prep, wave 1/3, canvas clears).
12. Alternative loss path: place no towers (or few), start a wave, let goblins reach the end — Base HP drops. When it hits 0, a **Game Over** overlay appears showing the wave reached and a **Restart** button.
13. Click **Restart** — state resets cleanly.
14. Open the **How to play** collapsible at the bottom — confirm it lists controls for placing towers, starting waves, earning gold, and the game-over condition.
15. From the home page (http://localhost:5173/), confirm a "Start a single-player run →" link navigates to /play.
16. Verify no console errors throughout.

## Co-op two-browser smoke

Tests the full co-op flow: two players register, create a lobby, join, start a
session, and both enter the live game via the WebSocket (`/api/ws?room=<id>&session=<id>`).
The frontend routes player state through `useSessionMirror.ts`.

**Setup:** API running with DB (`docker compose up --build`), Vite dev server
running (`cd web && bun run dev`). Two separate browser windows (or a normal
window + a private/incognito window) — both pointing to http://localhost:5173.

### Steps

1. **Window A — Register Player A**
   - Navigate to http://localhost:5173/register.
   - Register a new account (e.g. username `playerA`, password `secretA`).
   - Confirm redirect to the home page with Player A's username visible.

2. **Window B — Register Player B**
   - Navigate to http://localhost:5173/register.
   - Register a new account (e.g. username `playerB`, password `secretB`).
   - Confirm redirect to the home page with Player B's username visible.

3. **Window A — Create lobby**
   - Navigate to the lobby page (or click "Play Co-op" / equivalent).
   - Create a new lobby. Note the lobby join code or lobby ID shown.
   - Confirm the lobby shows Player A as host and status **open**.

4. **Window B — Join lobby**
   - In Window B, enter the lobby join code / lobby ID from step 3.
   - Click **Join**.
   - Confirm the lobby in both windows now shows two players and status **open**.

5. **Window A — Start the session**
   - Click **Start game** in Window A (host only).
   - Confirm the lobby status transitions to **in_game** and a `session_id`
     is returned from `POST /api/lobbies/{id}/start`.

6. **Both windows — Enter game view**
   - Both windows should automatically navigate to the session/game screen.
   - Under the hood the frontend opens a WebSocket to
     `/api/ws?room=<lobby_id>&session=<session_id>` via `useSessionMirror.ts`.
   - Confirm both windows show the game HUD (wave counter, gold, base HP).
   - Actions taken by Player A (e.g. placing a tower) should be reflected in
     Window B within one tick (≤ ~50 ms default tick interval).

7. **Verify no console errors** in either window throughout.
