# tab-agent-web

Website and study backend for [Tab Agent](https://github.com/MaykaS/tab_agent).

## Pages

| Page | Status | Description |
|------|--------|-------------|
| `/` | Live | Landing page |
| `/demo` | Live/placeholder | Demo page |
| `/evals` | In progress | Evaluation page |
| `/admin` | Live | Review submitted study data |
| `/api/collect` | Live | Receive and return anonymized study submissions |

## Stack

- Next.js 14 (App Router)
- Vercel deployment
- Neon Postgres for study storage

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

Connected to Vercel via GitHub. Push to `main` to deploy.

## Study data

The extension submits anonymized study snapshots to `/api/collect`.

Stored data can include:
- participant ID
- tab/group/asleep counts
- estimated memory summary
- grouping rating summary
- per-group snapshots
- self-report survey responses

Data is stored in Neon Postgres and surfaced through:
- `/api/collect`
- `/admin`
