.PHONY: up down restart build logs ps migrate generate seed

up:
	docker compose up

build:
	docker compose up --build

down:
	docker compose down

down-v:
	docker compose down -v

restart:
	docker compose restart

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-mcp:
	docker compose logs -f mcp-server

logs-db:
	docker compose logs -f postgres

ps:
	docker compose ps

# Example: make generate name=initial_schema
generate:
	cd packages/db && npx drizzle-kit generate --name $(name)

migrate:
	docker compose restart backend

seed:
	docker compose exec backend npx tsx ../packages/db/src/seed/index.ts

studio:
	cd packages/db && npx drizzle-kit studio
