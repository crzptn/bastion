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
```

**Expected:** exits 0; produces `api` binary (or `api.exe` on Windows) in the current directory.

Optional:

```bash
go build -o bin/api ./cmd/api
```

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

**Expected:**

- `db` service becomes healthy (`pg_isready` passes).
- `api` service starts and logs `listening on :8080`.
- API port `${API_PORT:-8080}` is reachable on the host.

Stop with `Ctrl+C`, then:

```bash
docker compose down
```

Optional database check while compose is up:

```bash
docker compose exec db pg_isready -U bastion -d bastion
```

**Expected:** `accepting connections`.

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

## Makefile placeholder

```bash
make help
```

**Expected:** prints that fmt/lint/dev targets arrive in issue #5.
