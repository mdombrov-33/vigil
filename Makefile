.PHONY: up down restart build logs ps migrate generate

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
	cd packages/db && npx drizzle-kit generate --name $(name)

migrate:
	docker compose exec backend npm run migrate

studio:
	cd packages/db && npx drizzle-kit studio
