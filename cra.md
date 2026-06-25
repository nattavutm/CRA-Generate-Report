# Cyber Risk Advisory (CRA) Report Generator — Build Spec

> Single source of truth for Claude Code. Read this top-to-bottom before writing any code.
> Target runtime: **Cloudflare Workers**. Language: **TypeScript**. Router: **Hono**.

---

## 1. Goal

A web app that, on demand, pulls live data from **Trend Vision One v3.0 APIs**, assembles it
into the **Cyber Risk Advisory** report (8 sections, see `report-reference.pdf` design), renders
it to **PDF**, and lets the user download it.

## 2. Hard design constraints (READ FIRST)

1. **Stateless / generate-on-demand.** Do **NOT** persist any historical data. No database, no
   D1, no snapshot store. Every report is built fresh from a single live API pull. This is a
   deliberate decision — do not add a DB "for convenience."
2. **Consequence — the trend table.** The report's Risk Index table has columns Day 1 / 30 / 60 /
   90. The Vision One `securityPosture` API returns only the **current** snapshot (one
   `createdDateTime`). Therefore:
   - The **latest** column is filled live from the API.
   - **Prior-period columns are OPTIONAL MANUAL INPUTS** entered by the user in the generate form.
   - If the user leaves them blank, render `—` (matches the reference, which shows `—` for Day 30).
3. **Editorial text is human-owned.** Narrative blocks ("What changed this cycle", recommendation
   wording, "trending above industry average") are **not** auto-asserted from data. Provide them as
   editable form fields. Optionally offer an AI-draft button (see §11) that the user reviews — never
   ship un-reviewed generated prose as fact.
4. **Data-source selection is config, not computed.** Things like "Qualys excluded" are decisions,
   not values the app derives. Expose toggles/notes in the form where relevant; do not hardcode.
5. **Secrets never in code.** Vision One API token is a Wrangler secret. The browser never sees it.

## 3. Architecture (minimal, stateless)

```
Browser (form UI)
      │  POST /api/report  (config + manual prior-period values)
      ▼
Cloudflare Worker (Hono)
      ├── serves the UI (GET /)
      ├── /api/report  → V1 client → fetch all sections → assemble model → render HTML → PDF
      │        │
      │        ├── Vision One v3.0 REST API  (Bearer token, region base URL)
      │        └── Browser Rendering binding  (HTML → PDF)
      └── returns application/pdf  (streamed download; optional R2 cache, see §9)
```

Bindings in `wrangler.toml`:

| Binding | Type | Purpose | Required |
|---|---|---|---|
| `BROWSER` | Browser Rendering | HTML → PDF via Puppeteer-on-Workers | Yes |
| `V1_API_TOKEN` | Secret (`wrangler secret put`) | Vision One Bearer token | Yes |
| `V1_REGION` | var | region key, default `sg` (Thailand → Singapore DC) | Yes |
| `REPORTS` | R2 bucket | optional cache of generated PDFs | Optional |
| `ASSETS` | Static assets / Workers Assets | fonts, logo, CSS for the template | Recommended |

> No D1. No KV. No Queues. The whole flow is one request → one response.
> If the multi-call pull risks exceeding CPU/subrequest limits, fetch sections **in parallel**
> (`Promise.all`) and cap pagination depth (see §6). Do not introduce a job queue.

## 4. Vision One API — connection facts

- **OpenAPI source of truth:** `sp-api-open-v3_0.json` (v3.0.1, 238 paths). Always confirm field
  names against this file; this spec quotes the relevant subset but the JSON wins on conflict.
- **Base URL by region (TH = Singapore):**
  - `sg` → `https://api.sg.xdr.trendmicro.com`
  - others: `us`→`api.xdr.trendmicro.com`, `eu`→`api.eu...`, `jp`→`api.xdr.trendmicro.co.jp`,
    `au`, `in`, `mea`, `uk`, `ca`, `za` (see `servers[]` in the JSON).
- **Auth:** header `Authorization: Bearer <V1_API_TOKEN>`.
- **Filtering:** many list endpoints accept a `TMV1-Filter` **header** for subset filtering, plus
  `orderBy`, `top` (default 100) query params.
- **Pagination:** list responses contain `nextLink`. Follow it until null. Hard-cap at e.g. 20 pages
  per endpoint to stay within Worker limits — the report needs aggregates and top-N, not full dumps.
- **Rate limits:** requests are counted per 60s; over-limit returns **HTTP 429**, body max **1 MB**,
  per-request timeout **60s** (else 504). Implement exponential backoff on 429/5xx (e.g. 3 retries,
  base 500ms). Risk Index is recalculated server-side every ~4h, so a single pull per run is fine.
- **Required API scopes (set on the API key in Automation Center, least-privilege):** ASRM read,
  Workbench (View/filter/search) read, Endpoint Inventory read. No response/action scopes needed.

## 5. Report section → API mapping

| Report section | Endpoint(s) | Key fields used |
|---|---|---|
| **01 Executive Summary** | `GET /v3.0/asrm/securityPosture` (+ manual deltas) | `riskIndex`, `cveManagementMetrics.mttpDays`, derived counts; deltas vs. manual prior values |
| **03 Risk Index Overview** | `GET /v3.0/asrm/securityPosture` | `riskIndex` (number), `riskCategoryLevel.{exposure,attack,securityConfiguration}` (level strings) |
| **04 Exposure Overview** | `securityPosture` + lists | `vulnerabilityAssessmentCoverageRate`, `cveManagementMetrics.{count,mttpDays,averageUnpatchedDays,density,vulnerableEndpointRate,legacyOsEndpointCount}`, `exposureStatus.*` |
| ↳ weak-auth / privilege / admin | `exposureStatus.domainAccountMisconfigurationStatus.{weakAuthenticationCount,excessivePrivilegeCount,increaseAttackSurfaceRiskCount}` | counts; drill via `GET /v3.0/asrm/attackSurfaceDomainAccounts` |
| ↳ insecure hosts (SSL/TLS, ports) | `exposureStatus.{insecureHostConnectionStatus,unexpectedInternetFacingInterfaceStatus}` | `insecureHostCount`, `connectionIssueCount`, `servicePortCount`, `publicIpCount` |
| ↳ internet-facing CVEs | `GET /v3.0/asrm/internetFacingAssetVulnerabilities` | `cveId`, `cveRiskScore`, `cvssScore`, `affectedAssetCount`, `globalExploitActivityLevel` |
| ↳ stale accounts | `GET /v3.0/asrm/attackSurfaceDomainAccounts` (filter on `lastDetectedDateTime`) | count inactive > N days client-side |
| **05 Security Configuration** | `GET /v3.0/asrm/securityPosture` → `securityConfigurationStatus` | `endpointAgentStatus.{agentAdoptionCount,agentVersionStatus,edrFeatureAdoptionCount,agentFeatureStatus.*}`, `virtualPatchingStatus`, `emailSensorStatus`, `cloudAppsStatus` |
| ↳ per-endpoint detail (optional) | `GET /v3.0/endpointSecurity/endpoints` | `eppAgent`, `edrSensor`, `agentUpdateStatus`, `osName` (use `select` to trim payload) |
| **06 Attack Overview** | `GET /v3.0/workbench/alerts` (`startDateTime`/`endDateTime`, `TMV1-Filter`) | alert items → top detections by score/severity |
| ↳ high-risk assets context | `GET /v3.0/asrm/highRiskDevices`, `GET /v3.0/asrm/highRiskUsers` | `deviceName`, `riskScore`, `os` |
| **07 Recommendations** | derived from §04/§05/§06 findings + editable templates | risk level, category, finding, recommendation, status |
| **08 Cadence** | form input only (no API) | session dates/times/status |

### Gotchas baked into the mapping
- `riskCategoryLevel.*` returns **level strings** (e.g. `high`/`medium`/`low`), **not** the 0–100
  numbers the reference table shows per category. Only the overall `riskIndex` is numeric. So:
  render the overall index as a number, and render category cells using the level string (or accept
  manual numeric overrides in the form). Do not fabricate per-category numerics.
- `vulnerabilityAssessmentCoverageRate` and the various `*Rate` fields are ratios (0–1) — format as %.
- `workbench/alerts` item schema is polymorphic; read the actual item shape from a live call /
  the JSON `components` before binding fields. Show: detection name, severity/score, entity, time.

## 6. Worker request flow (`/api/report`)

1. Parse body → `ReportConfig` (see §7).
2. Build `V1Client` with region base URL + token.
3. `Promise.all` the collectors:
   - `getSecurityPosture()` → one call, feeds §01/03/04/05.
   - `getInternetFacingCves({ top: 50, orderBy: 'cveRiskScore desc' })`.
   - `getDomainAccounts({ paginate, cap: 20 pages })` → compute stale/admin counts client-side.
   - `getWorkbenchAlerts({ startDateTime, endDateTime, top: 50 })`.
   - `getHighRiskDevices({ top: 20 })` (optional).
4. Assemble `ReportModel` (merge live data + manual prior-period values + editorial text).
5. Render HTML template (§8) with the model.
6. `BROWSER` → PDF (A4, print background on).
7. Optional: `REPORTS.put(key, pdf)` and return a signed download; else stream `application/pdf`.
8. On any collector failure: degrade gracefully — render that section with a visible
   "data unavailable" note rather than failing the whole report. Log which collector failed.

## 7. Data model (in-memory only)

```ts
interface ReportConfig {
  customerName: string;
  region: string;               // 'sg' default
  engagement: { docId: string; cycleLabel: string };
  sessions: Array<{ label: string; date: string; time: string; status: 'Completed'|'Upcoming' }>;
  // optional prior-period values for the trend table (manual)
  priorRiskIndex?: { day1?: number; day30?: number; day60?: number };
  priorCategory?: { /* same shape */ };
  // editorial, human-authored
  executiveSummary: string;
  whatChanged: string[];
  dataSourceNotes?: string;     // e.g. "Qualys disabled this cycle"
  recommendationsOverride?: Finding[];
}

interface Finding {
  riskLevel: 'High'|'Medium'|'Low';
  category: 'Exposure'|'Attack'|'Configuration';
  title: string; detail: string[]; recommendation: string[]; status: string;
}

interface ReportModel {
  config: ReportConfig;
  live: {
    riskIndex: number;
    categoryLevels: { exposure: string; attack: string; securityConfiguration: string };
    coverageRate: number;
    cve: { count: number; mttpDays: number; averageUnpatchedDays: number;
           density: number; vulnerableEndpointRate: number; legacyOsEndpointCount: number };
    exposure: any;            // exposureStatus.*
    securityConfig: any;      // securityConfigurationStatus.*
    internetFacingCves: Array<{ cveId: string; cveRiskScore: number; cvssScore: number;
                                affectedAssetCount: number; globalExploitActivityLevel: string }>;
    staleAccountCount: number;
    alerts: Array<{ name: string; severity: string; entity: string; time: string }>;
  };
  generatedAt: string;
}
```

## 8. Rendering

- Build the report as a server-rendered **HTML string** (one `report.html.ts` template fn) styled to
  match `report-reference.pdf`: dark cover page, red accent (`#E11C24`-ish), TrendAI logo, 8 numbered
  sections, the trend table, the recommendations table with red/pink risk cells, footer with page
  numbers, A4 page breaks (`@page`, `page-break-before`).
- Convert with Browser Rendering:
  ```ts
  import puppeteer from '@cloudflare/puppeteer';
  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' } });
  await browser.close();
  ```
- Embed fonts/logo as base64 or via the `ASSETS` binding so the PDF is self-contained.
- Match the reference design system; if building UI, follow `/mnt/skills/public/frontend-design`.

## 9. Optional PDF caching (R2)

Only if the user wants a shareable link. Key by `customerName + generatedAt`. Default behavior is
to stream the PDF directly in the response. This is **not** historical storage of data — it's just
the rendered artifact, and is fine to keep or skip.

## 10. UI (single page, served at `GET /`)

Form fields: customer name, region, cycle label, document id; the 4 session rows (date/time/status);
optional prior-period Risk Index + category values; editorial textareas (exec summary, what-changed
bullets, data-source notes); workbench date range. Buttons: **Generate PDF** (download),
**Preview HTML** (open in new tab). Show per-section fetch status + clear errors. No localStorage.

## 11. Optional AI narrative draft

A "Draft summary" button may call the Anthropic API (model `claude-sonnet-4-6`) with the live
numbers + manual deltas to draft "What changed this cycle". Output lands in the editable textarea
for the user to review and correct before generating. Never inject AI prose into the PDF without
that review step.

## 12. Build phases (do in order)

- **P0 — Scaffold:** Wrangler + Hono + TS; add `BROWSER` binding; `wrangler secret put V1_API_TOKEN`;
  set `V1_REGION`. Verify `npm run dev` serves a hello route.
- **P1 — V1 client:** base-URL-by-region, Bearer auth, `fetchJson` with 429/5xx backoff,
  `paginate(nextLink, cap)`, `TMV1-Filter` header support. Unit-smoke against `securityPosture`.
- **P2 — Collectors:** one fn per §5 row, each returning typed slices of `ReportModel.live`.
- **P3 — Assembler:** merge live + config + editorial into `ReportModel`; compute derived deltas and
  stale-account count; format ratios as %.
- **P4 — Template:** `report.html.ts` matching the reference; verify with Preview HTML.
- **P5 — PDF:** Browser Rendering integration; A4, page breaks, embedded assets.
- **P6 — UI + `/api/report`:** form, parallel fetch, stream PDF; graceful per-section failure.
- **P7 — Harden:** least-privilege token scopes, error states, backoff tuning, optional R2 + AI draft.

## 13. Verify in Automation Center before/while coding

- Exact request/response of `workbench/alerts` items (polymorphic) and which `TMV1-Filter` fields
  apply for severity/score sorting.
- Whether `attackSurfaceDomainAccounts` exposes a last-activity field usable for the >180-day stale
  filter server-side, or if it must be computed client-side from `lastDetectedDateTime`.
- Confirm the API key's role includes ASRM + Workbench + Endpoint Inventory **read** scopes only.

## 14. Acceptance criteria

- One `POST /api/report` produces a PDF visually matching the 8-section reference, populated with
  live Vision One data for the latest column and `—`/manual values for prior periods.
- No persistent data store exists in the project.
- API token is never present in client code or the rendered HTML.
- A single collector failing yields a partial report with a visible notice, not a 500.
