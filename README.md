# CMS PT

React/Vite dashboard with an Express API that reads visit and report data from a JHCIS MySQL database.

## Requirements

- Node.js 22 or newer for local development
- Docker Desktop for Docker Compose
- Access to a JHCIS MySQL database

## Environment

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Update the database connection values in `.env`:

```env
JHCIS_DB_HOST=localhost
JHCIS_DB_PORT=3333
JHCIS_DB_USER=root
JHCIS_DB_PASSWORD=123456
JHCIS_DB_NAME=jhcisdb
API_PORT=5174
```

When running with Docker and the database is on your host machine, set:

```env
JHCIS_DB_HOST=host.docker.internal
```

If `.env` is not present, Docker Compose uses defaults from `docker-compose.yml`, including `host.docker.internal` for the database host.

## Run With Docker Compose

```bash
docker compose up
```

Open the app at:

```text
http://localhost:5173
```

The API is available at:

```text
http://localhost:5174/api/health
```

The Compose service runs Vite and the Express API in one Node container. Source files are mounted into the container, so frontend and API changes are picked up during development.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the API and frontend together:

```bash
npm run dev:full
```

Open:

```text
http://localhost:5173
```

## Useful Scripts

- `npm run dev` starts the Vite frontend.
- `npm run dev:api` starts the Express API.
- `npm run dev:full` starts both with `concurrently`.
- `npm run build` type-checks and builds the frontend.
- `npm run preview` previews the built frontend.

## Notes

- Vite proxies `/api` requests to the Express API during development.
- The API defaults to port `5174`.
- Docker Compose publishes the frontend on port `5173` and the API on `API_PORT`.
