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

logs-db:
	docker compose logs -f postgres

ps:
	docker compose ps

# Example: make generate name=initial_schema
generate:
	cd backend && npx drizzle-kit generate --name $(name)

migrate:
	docker compose restart backend

# Run inside the container since it needs DATABASE_URL from the env
seed:
	docker compose exec backend npx tsx src/db/seed/index.ts

studio:
	cd backend && npx drizzle-kit studio
