# Cyber Risk Advisory (CRA) Report Generator

A **stateless** Cloudflare Worker that, on demand, pulls live data from the **Trend Vision One v3.0**
APIs, assembles it into the 8-section Cyber Risk Advisory report, renders it to **PDF** with Browser
Rendering, and streams it back for download.

No database. No snapshot store. Every report is built fresh from a single live API pull
(see [`cra.md`](./cra.md) for the full build spec).

## Stack
- **Runtime:** Cloudflare Workers · **Language:** TypeScript · **Router:** Hono
- **PDF:** `@cloudflare/puppeteer` (Browser Rendering binding)

## Project layout
```
src/
  index.ts            Hono app + routes (GET / , POST /api/report|preview|draft)
  types.ts            Env + in-memory data model (ReportConfig, ReportModel, Finding)
  ui.ts               Single-page generate form (served at GET /)
  assemble.ts         Parallel collector orchestration → ReportModel (graceful per-section failure)
  pdf.ts              HTML → PDF via Browser Rendering
  ai.ts               Optional Anthropic "Draft summary" (§11)
  v1/
    client.ts         Region base URLs, Bearer auth, backoff, pagination, TMV1-Filter
    collectors.ts     One collector per report section (cra.md §5)
  report/
    template.ts       report.html.ts — 8-section A4 report
    styles.ts         Print CSS (dark cover, red accent, page breaks)
```

## Configuration

| Binding | Type | Purpose |
|---|---|---|
| `BROWSER` | Browser Rendering | HTML → PDF (requires a **paid** Workers plan) |
| `V1_API_TOKEN` | Secret | Vision One Bearer token |
| `V1_REGION` | var | region key (default `sg` — Thailand → Singapore DC) |
| `ANTHROPIC_API_KEY` | Secret (optional) | AI draft button |
| `REPORTS` | R2 bucket (optional) | cache of rendered PDFs |

### Required Vision One API scopes (least privilege)
ASRM **read**, Workbench (View/filter/search) **read**, Endpoint Inventory **read**. No response/action scopes.

## Local development
```bash
npm install
cp .dev.vars.example .dev.vars   # add your V1_API_TOKEN
npm run dev
```
Open the printed URL, fill the form, and use **Preview HTML** or **Generate PDF**.
> Browser Rendering does not run in `wrangler dev` offline mode — use `wrangler dev --remote` for PDF.

## Deploy
This repo is wired to deploy via the **Cloudflare ↔ GitHub** integration (push to `main`).
For manual deploys:
```bash
npm run deploy
wrangler secret put V1_API_TOKEN
# wrangler secret put ANTHROPIC_API_KEY   # optional
```

## Design decisions (from the spec)
- **Trend table:** only the latest column is live; Day 1/30/60 are **manual** form inputs, blank → `—`.
- **Editorial text is human-owned** — narrative is never auto-asserted from data. The AI draft lands in
  an editable field for review; it is never injected into the PDF directly.
- **Graceful degradation:** one failing collector renders a "data unavailable" notice, not a 500.
