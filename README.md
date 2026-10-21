# Competitor Catalog — scraper console

Web dashboard for the competitor catalog scraping API
(`docs/openapi.json`, OpenAPI 3.1, v0.1.0).

It covers overview and health, competitors and their workers, products with price
history, the category tree, jobs (live progress, pause/resume/cancel, restart of an
interrupted/failed/cancelled job), runs and their items (retry of the failed pages),
notifications, banned categories (deleted and skipped by the syncs, with unban), and the
matching of competitor products with the Antalis reference catalog (`/matching`:
per-competitor overview and runs, review queue, review screen with the score breakdown of
every candidate, all matches, obsolete matches, event history). Jobs start from a dialog
with their options and a live estimate, for a whole catalog or a single category.

Matching scores are similarity scores on a 0-100 scale, not probabilities: never show them
as a percentage.

## Stack

- Next.js 16 (App Router, Server Components, Server Actions) + React 19 + TypeScript
- Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) (Radix primitives, sources in `components/ui/`, add more with `npx shadcn@latest add <name>`)
- [nuqs](https://nuqs.dev) for the filters, bound to the URL and applied live
- Recharts (through the shadcn chart component) for charts, lucide-react for icons

All data is fetched on the server. The API key never reaches the browser: live updates come
from the API's server-sent event stream (`GET /events`), relayed by the `/api/events` route.

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
app/api/events  relay of the API's live event stream (SSE)
app/login/      password login page and its server action
components/ui/  shadcn/ui primitives (generated, owned by the project)
components/     page building blocks (kit.tsx), filters, live updates, matching views
hooks/          client hooks used by the shadcn components
lib/            server-only API client, types, formatters, search-param helpers, auth helpers
proxy.ts        optional password gate (DASHBOARD_PASSWORD), redirects to /login
docs/           OpenAPI spec snapshot of the scraper API
```

## Safety notes

- The dashboard can start, pause, stop and delete jobs and data in the scraper. Set
  `DASHBOARD_PASSWORD` in any environment reachable from the internet.
- Destructive or costly actions (starting a job, stopping, deleting) ask for confirmation.
