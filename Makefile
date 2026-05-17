.PHONY: up down seed logs reset build lint help

help:
	@echo ""
	@echo "VulnCMS Security Lab — Makefile targets"
	@echo "========================================"
	@echo "  make up      — Start Docker, install deps, push schema, run all services"
	@echo "  make down    — Stop Docker containers"
	@echo "  make seed    — Seed database with 20+ posts, 50+ comments, all roles"
	@echo "  make logs    — Tail all log files (app + security + audit)"
	@echo "  make cef     — View CEF security events only"
	@echo "  make reset   — Wipe database, logs, and volumes"
	@echo "  make build   — Build all TypeScript packages"
	@echo ""

up:
	@echo ">>> Starting infrastructure..."
	docker-compose up -d
	@echo ">>> Installing dependencies..."
	pnpm install
	@echo ">>> Pushing database schema..."
	pnpm --filter @vulncms/database run db:push
	@echo ">>> Generating Prisma client..."
	pnpm --filter @vulncms/database run db:generate
	@echo ">>> Starting all services (Ctrl+C to stop — all processes exit cleanly)..."
	pnpm dev

down:
	docker-compose down

seed:
	@echo ">>> Seeding database..."
	pnpm --filter @vulncms/database run db:seed

logs:
	@echo "=== App logs (ECS) ===" && tail -f logs/app.log 2>/dev/null & \
	echo "=== Security events (CEF) ===" && tail -f logs/security.cef.log 2>/dev/null & \
	echo "=== Audit log ===" && tail -f logs/audit.log 2>/dev/null; \
	wait

cef:
	@tail -f logs/security.cef.log

audit:
	@tail -f logs/audit.log | jq .

reset: down
	@echo ">>> Removing logs..."
	rm -rf logs/*
	@echo ">>> Removing Docker volumes..."
	docker volume rm injection-lab_postgres_data 2>/dev/null || true
	@echo ">>> Reset complete. Run 'make up && make seed' to start fresh."

build:
	pnpm build

lint:
	pnpm lint
