# Competitor Catalog — scraper console

Web dashboard for the competitor catalog scraping API
(`docs/openapi.json`, OpenAPI 3.1, v0.1.0).

It covers overview and health, competitors and their workers, products with price
history, the category tree, jobs (live progress, pause/resume/cancel), runs and their
items, product matches (validate/reject), and notifications.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions) + React 19 + TypeScript
- Tailwind CSS 4
- Recharts for price history

All data is fetched on the server. The API key never reaches the browser.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `SCRAPER_API_KEY` | yes | API key sent as `X-API-Key` to the scraper API. |
| `SCRAPER_API_URL` | no | API base URL. Defaults to the production API under `/api/v1`. |
| `DASHBOARD_PASSWORD` | no | If set, the dashboard requires signing in at `/login` with this password. |

Copy `.env.example` to `.env.local` for local development.

## Development

```bash
npm install
cp .env.example .env.local   # then fill in SCRAPER_API_KEY
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Docker

```bash
docker build -t scraping-frontend .
docker run -p 3000:3000 -e SCRAPER_API_KEY=... -e DASHBOARD_PASSWORD=... scraping-frontend
```

The image uses Next's `standalone` output and runs as a non-root user on port 3000.

## Project layout

```
app/            routes (Server Components), actions.ts (Server Actions)
app/(console)/  dashboard pages with the sidebar layout
app/login/      password login page and its server action
components/     UI primitives and small client components
lib/            server-only API client, types, formatters, search-param helpers, auth helpers
proxy.ts        optional password gate (DASHBOARD_PASSWORD), redirects to /login
docs/           OpenAPI spec snapshot of the scraper API
```

## Safety notes

- The dashboard can start, pause, stop and delete jobs and data in the scraper. Set
  `DASHBOARD_PASSWORD` in any environment reachable from the internet.
- Destructive or costly actions (starting a job, stopping, deleting) ask for confirmation.
