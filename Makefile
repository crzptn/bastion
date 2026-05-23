.PHONY: help install workspace fmt lint web-install web-fmt web-lint check dev dev-api dev-web kill-ports migrate-up migrate-down migrate-version migrate-create

DEV_PORTS ?= 5173 8080

MIGRATE_VERSION ?= v4.18.2

GOPATH_FWD := $(subst \,/,$(shell go env GOPATH))
GOIMPORTS := $(GOPATH_FWD)/bin/goimports
GOLINES := $(GOPATH_FWD)/bin/golines
GOLANGCI := $(GOPATH_FWD)/bin/golangci-lint
AIR := $(GOPATH_FWD)/bin/air
GO_FMT_PATHS := ./cmd ./internal

help:
	@echo "Bastion Makefile targets:"
	@echo ""
	@echo "  install        Install golangci-lint v2, goimports, golines, and air (run once)"
	@echo "  dev            Free dev ports, then run backend (air) and web (vite) together"
	@echo "  kill-ports     Kill any processes listening on DEV_PORTS ($(DEV_PORTS))"
	@echo "  dev-api        Run backend with air hot reload"
	@echo "  dev-web        Run web dev server (vite)"
	@echo "  workspace      Copy go.work.example to go.work if missing"
	@echo "  fmt            Format Go code under cmd/ and internal/"
	@echo "  lint           go vet and golangci-lint on bastion packages"
	@echo "  web-install    bun install in web/"
	@echo "  web-fmt        Prettier write in web/"
	@echo "  web-lint       ESLint in web/"
	@echo "  check          lint + web-lint + go test -short ./..."
	@echo ""
	@echo "Migration targets (require DATABASE_URL in environment):"
	@echo "  migrate-up       Apply all pending migrations"
	@echo "  migrate-down     Roll back one migration (dev only)"
	@echo "  migrate-version  Print current migration version"
	@echo "  migrate-create   Create new migration pair (requires NAME=...)"

install:
	go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
	go install golang.org/x/tools/cmd/goimports@latest
	go install github.com/segmentio/golines@latest
	go install github.com/air-verse/air@latest

ifeq ($(OS),Windows_NT)
workspace:
	@if not exist go.work copy go.work.example go.work
else
workspace:
	@test -f go.work || cp go.work.example go.work
endif

fmt:
	$(GOIMPORTS) -w $(GO_FMT_PATHS)
	$(GOLINES) -m 80 -w $(GO_FMT_PATHS)

lint: workspace
	go vet ./...
ifeq ($(OS),Windows_NT)
	cmd /c "set GOTOOLCHAIN=local&& $(GOLANGCI) run ./..."
else
	GOTOOLCHAIN=local $(GOLANGCI) run ./...
endif

web-install:
	cd web && bun install

web-fmt:
	cd web && bun run format

web-lint:
	cd web && bun run lint

check: lint web-lint
	go test -short ./...

dev-api: workspace
	$(AIR)

dev-web:
	cd web && bun run dev

ifeq ($(OS),Windows_NT)
kill-ports:
	@powershell -NoProfile -ExecutionPolicy Bypass -File scripts/kill-ports.ps1 $(DEV_PORTS)
else
kill-ports:
	@for p in $(DEV_PORTS); do pids=$$(lsof -ti tcp:$$p 2>/dev/null); if [ -n "$$pids" ]; then echo "Killing $$pids on port $$p"; kill -9 $$pids 2>/dev/null || true; fi; done
endif

dev: kill-ports
	@$(MAKE) -j2 dev-api dev-web

migrate-up:
	go run ./cmd/migrate up

migrate-down:
	go run ./cmd/migrate down

migrate-version:
	go run ./cmd/migrate version

migrate-create:
ifndef NAME
	$(error NAME is required, e.g. make migrate-create NAME=add_users)
endif
	go run github.com/golang-migrate/migrate/v4/cmd/migrate@$(MIGRATE_VERSION) create -ext sql -dir migrations -seq $(NAME)
