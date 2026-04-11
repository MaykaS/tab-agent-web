# tab-agent-web

Website, study backend, admin dashboard, and OpenAI summary API for [Tab Agent](https://github.com/MaykaS/tab_agent).

This repo is **not** the Chrome extension itself.

## Repo responsibility

- **This repo (`tab_agent_web`)**
  - landing site
  - study submission API
  - Neon Postgres storage
  - admin analytics
  - OpenAI-assisted policy summary endpoint

- **Extension repo (`tab_agent`)**
  - popup
  - background service worker
  - local autonomous policy
  - Stats page
  - feedback loop

If you want browser behavior to change, you must update `tab_agent`.

## Pages and APIs

| Route | Description |
|------|-------------|
| `/` | Landing page |
| `/demo` | Demo page |
| `/evals` | Evaluation page |
| `/admin` | Review assistant, rule-baseline, and autonomous-agent telemetry |
| `/api/collect` | Receive and return anonymized study submissions |
| `/api/agent-summary` | Send structured behavioral summaries to OpenAI and return policy recommendations |

## Stack

- Next.js 14 (App Router)
- Vercel deployment
- Neon Postgres for study storage
- OpenAI API for summary/tuning recommendations

## Environment variables

For local development or Vercel deployment:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, `/api/agent-summary` falls back to a local heuristic summary instead of failing.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

Connected to Vercel via GitHub. Push to `main` to deploy.

## Study data

The extension submits anonymized snapshots to `/api/collect`.

Stored data can include:

- participant ID
- tab/group/asleep counts
- estimated memory summary
- grouping rating summary
- per-group snapshots
- autonomous action logs
- feedback outcomes
- protection signals
- rule-baseline comparison data
- self-report survey responses
- OpenAI policy summary snapshots

Data is surfaced through:

- `/api/collect`
- `/admin`
