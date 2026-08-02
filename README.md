# tab-agent-web

This is the **website/backend/admin layer** for Tab Agent. The Chrome extension runtime lives in [MaykaS/tab_agent](https://github.com/MaykaS/tab_agent).

It is **not** the Chrome extension itself. For product framing and system architecture, see [`docs/PRODUCT.md`](https://github.com/MaykaS/tab_agent/blob/master/docs/PRODUCT.md) and [`docs/ARCHITECTURE.md`](https://github.com/MaykaS/tab_agent/blob/master/docs/ARCHITECTURE.md) in the extension repo.

## Repo split

There are two repos:

- **`tab_agent`** - Chrome extension runtime
- **`tab-agent-web`** - website, API, storage, admin, and OpenAI summaries

Rule of thumb:

- if browser behavior should change -> edit `tab_agent`
- if storage/admin/OpenAI summary should change -> edit `tab-agent-web`

## What this repo does

This repo is responsible for:

- landing site
- study submission API
- Neon Postgres storage
- admin analytics
- OpenAI-assisted policy summary endpoint
- context benchmark harness
- offline policy-training utility
- live admin training dashboard with polling graphs

## What the extension repo does

The extension repo is responsible for:

- popup
- background service worker
- local autonomous policy
- Stats page
- feedback loop

Updating this repo alone does **not** change extension behavior.

## Pages and APIs

| Route | Description |
|------|-------------|
| `/` | Landing page |
| `/demo` | Demo page |
| `/evals` | Evaluation page |
| `/admin` | Review assistant, rule-baseline, and autonomous-agent telemetry |
| `/api/collect` | Receive and return anonymized study submissions |
| `/api/agent-summary` | Send structured behavioral summaries to OpenAI and return policy recommendations |

The site navigation now links directly to:

- `/demo`
- `/evals`
- `/admin`

so the admin dashboard is discoverable from the live product site instead of acting like a hidden internal route.

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

## OpenAI role

OpenAI is **advisory only**.

It does not control the browser directly.

This repo uses OpenAI for:

- behavior summaries
- explanation support
- policy-tuning recommendations
- suggested protected contexts

The extension still makes real-time sleep/wake decisions locally.

Supported context variants for summaries/benchmarking:

- `summary_only`
- `raw_log_only`
- `hybrid`

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
- raw tab event log
- adaptive policy summary
- training examples for offline learning
- protection signals
- rule-baseline comparison data
- self-report survey responses
- OpenAI policy summary snapshots

Data is surfaced through:

- `/api/collect`
- `/admin`

The admin page now refreshes on a polling loop and visualizes:

- reward trend
- regret-rate trend
- memory-saved trend
- memory-saved vs regret scatter
- outcome breakdown
- top regret contexts
- offline policy-training recommendations derived from submitted training examples

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Benchmark and training utilities:

```bash
npm run benchmark:context
npm run train:policy -- path/to/export.json
```

## Deploy

Connected to Vercel via GitHub. Push to the connected deployment branch to deploy.
