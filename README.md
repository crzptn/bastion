# bastion

Tower-defense game backend and SPA monorepo.

## Prerequisites

- [Go](https://go.dev/dl/) 1.25+
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

Expected JSON: `{"status":"ok","version":"dev"}` (version follows `API_VERSION` or `VERSION` when set). The React SPA scaffold is [issue #3](https://github.com/JoakimCarlsson/bastion/issues/3).

## Local build

After submodule init:

```bash
go build ./cmd/api
```

## Architecture

Backend packaging rules (subsystem-oriented layout, minmux, domain purity) are documented in [docs/backend-architecture.md](docs/backend-architecture.md).

## Makefile

Run `make help` for available targets. Full fmt/lint/dev targets are planned in [issue #5](https://github.com/JoakimCarlsson/bastion/issues/5).

## License

MIT — see [LICENSE](LICENSE).
