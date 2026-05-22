.PHONY: help migrate-up migrate-down migrate-version migrate-create

MIGRATE_VERSION ?= v4.18.2

help:
	@echo "Makefile targets (fmt, lint, dev) arrive in issue #5."
	@echo ""
	@echo "Migration targets (require DATABASE_URL in environment):"
	@echo "  migrate-up       Apply all pending migrations"
	@echo "  migrate-down     Roll back one migration (dev only)"
	@echo "  migrate-version  Print current migration version"
	@echo "  migrate-create   Create new migration pair (requires NAME=...)"

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
