# Customer Migration Decision Lab

An interactive customer architecture workshop. It guides a **fictional** enterprise customer, **Heritage House**, through a decision on whether to move its Next.js application's hosting and server-side AI workload to Vercel, and how to do it safely.

The reference workload is the open-source [Memory Artifact](https://github.com/fatoldnerd/memoryartifact) app (inspected at commit `5850081`). Heritage House, its stakeholders, volumes and stories are invented. AI responses are simulated unless you configure Gemini.

> Built as an interview demonstration by Brad Towers. Not affiliated with or endorsed by any vendor.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

No credentials are needed. For representative local timings, use the production build:

```bash
npm run build && npm start
```

## The five views

| Route | View | What it shows |
| --- | --- | --- |
| `/` | Customer Brief | Objective, stakeholders, **inspected** facts from the reference repo, assumptions, open questions, five scenario controls with live, rule-driven implications, and acceptance criteria |
| `/architecture` | Architecture Review | Interactive diagram (two options × three request flows), caching policy, where timeouts/retries/rate limits belong, tradeoffs, and the reasoned recommendation with the evidence that would change it |
| `/migration` | Migration Plan | Five phases with outcome, tasks, dependencies, exit evidence and rollback. Tasks stay *proposed* until evidence makes them *verified* |
| `/lab` | Validation Lab | Synthetic collection, object pages with AI analysis and fault injection, and 10 executable checks with measured timing and metadata |
| `/decision` | Executive Decision | A brief generated from the current scenario, with a transparent cost model; **Print / save as PDF** |

## Architecture

- **Next.js 16.4 App Router**, TypeScript, Tailwind CSS 4, Cache Components on (the `create-next-app` default). No database and no UI library.
- **Rules, not an LLM.** `src/lib/rules/index.ts` contains 11 pure rules over a typed `CustomerScenario`. Each returns a `Recommendation` with strength, rationale (including the numbers), triggering inputs, the options it applies to, and any acceptance criteria or migration tasks it adds. `decideOption()` chooses between the two options and lists the evidence that would reverse it.
- **Scenario state** is a small `useSyncExternalStore` store (`src/lib/scenario/store.ts`) persisted to `localStorage` with guarded access. Pages render with defaults if storage is unavailable.
- **Reference workload**, a hardened version of the reference repo's `POST /api/analyze-artifact`:
  - `POST /api/analyze` runs these steps in order: auth (simulated session) → early `Content-Length` limit → JSON parse → validation (data-URL format, JPEG/PNG/WebP allow-list, size limit, **magic-byte check**) → provider with per-attempt timeout (`AbortSignal.timeout`), one jittered retry for transient errors, and no automatic retry on timeout → structured `{ok, error:{code,message,retryable}, meta}`. Responses always carry `Cache-Control: private, no-store` and `Server-Timing`.
  - `GET /api/objects/[id]/image` serves synthetic SVGs. Public objects get `public, s-maxage=86400, stale-while-revalidate`. Private objects require authorisation on every request (401/403) and get `private, no-store` with `Vary: Authorization`.
  - `GET /api/health` returns environment metadata for measurements. It contains no secrets.
- **Validation checks** (`src/lib/validation/checks.ts`) run in the browser against the live server, so the timings are real. Each run records environment, origin, user agent, Node version, timestamp, sample count and whether the AI was simulated.
- **Cost model** (`src/lib/cost/model.ts`): every line shows quantity and formula. Unit prices start **empty** and need a source and date. Missing prices make the estimate visibly incomplete and are never treated as zero.

```
src/
  app/                  routes and API handlers
  components/           view components (client islands where interactive)
  data/                 brief, architecture, migration plan, acceptance criteria, fixtures
  lib/rules/            recommendation rules, option decision, plan builder (+ tests)
  lib/analysis/         validation, providers, timeout/retry, demo auth (+ tests)
  lib/validation/       browser-run checks, statistics, fixtures
  lib/cost/             transparent cost model (+ tests)
docs/                   ADR, demo script, limitations
```

## Configuration

Copy `.env.example` to `.env.local`. **Every variable is optional.**

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `simulated` | Set to `gemini` to call the real API (server-side only) |
| `GOOGLE_GEMINI_API_KEY` | — | Required when `AI_PROVIDER=gemini`. Never prefix with `NEXT_PUBLIC_` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any currently available image-capable Gemini model |
| `ANALYSIS_TIMEOUT_MS` | `15000` | Per-attempt timeout; keep below the route's `maxDuration` (30 s) |
| `ANALYSIS_MAX_ATTEMPTS` | `2` | Attempts for transient (5xx/429) provider errors |
| `ANALYSIS_MAX_IMAGE_BYTES` | `3145728` | Decoded limit; ≈ 4 MB base64, under the 4.5 MB function body limit |
| `SIMULATED_LATENCY_MS` | `0` | Adds artificial latency to simulated responses |
| `FAULT_INJECTION` | enabled | Set to `disabled` to ignore `simulate` requests |

The Gemini path uses the REST `generateContent` endpoint so that the timeout can cancel the request. **It has not been exercised against a live key in this build** (see limitations).

## Verification

```bash
npm test          # 56 Vitest tests: rules, plan derivation, validation, retry/timeout, route handlers, cost, stats
npm run lint
npm run typecheck # runs `next typegen` first so route types exist
npm run build
```

## Vercel deployment

**Live demo:** https://customer-migration-lab.vercel.app

This is a deployment of the demonstration app itself, with simulated AI. It is not a Heritage House candidate deployment, and nothing measured on it says anything about Heritage House's current or future hosting.

How it is set up:

1. **Git integration:** the Vercel project is connected to this GitHub repository (framework preset: Next.js). Pushes to `main` deploy to production; other branches get preview deployments.
2. **Function region:** `vercel.json` sets `"regions": ["lhr1"]` (London), replacing the `iad1` (US East) default. In a real engagement, choose the region next to the Firebase project.
3. **Environment variables:** none are set, so the deployment runs simulated AI. Do not add `GOOGLE_GEMINI_API_KEY` to a publicly accessible deployment: the demo bearer tokens in `src/lib/analysis/auth.ts` are fixed and public, so they would not protect the quota. If you enable Gemini on a protected deployment, add `AI_PROVIDER` and `GOOGLE_GEMINI_API_KEY` as **Sensitive** variables (`vercel env add`).
4. **Fault injection:** enabled, because the Validation Lab depends on it. In a real customer system, set `FAULT_INJECTION=disabled` in production.
5. **Access:** production is currently public. Previews follow the project's Deployment Protection settings.
6. **Measurements:** run the Validation Lab on the deployment. The environment is recorded as `vercel-preview` or `vercel-production`, so those measurements stay separate from local ones. Check `x-vercel-cache` on a repeated public image request to confirm CDN behaviour.

To deploy manually from a linked checkout: `vercel` (preview) or `vercel --prod` (production). `GET /api/health` reports the serving function's `vercelRegion`.

Platform facts used, from official docs consulted on 2026-10-23:

- [Vercel Functions limits](https://vercel.com/docs/functions/limitations): 4.5 MB request/response body; 300 s default duration; `iad1` default region; active CPU excludes I/O wait.
- [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache): `s-maxage` enables caching; `private`/`no-store` responses and requests carrying `Authorization` are not cached.
- [Instant Rollback](https://vercel.com/docs/instant-rollback): restores a previous production deployment; environment variables and external data are not rolled back.
- Next.js 16.4 docs bundled at `node_modules/next/dist/docs/` (Route Handlers, Cache Components, CDN caching, `maxDuration`).

## Further documents

- [Architecture decision record](docs/ADR-001-hosting-decision.md)
- [Five-minute demonstration script](docs/DEMO-SCRIPT.md)
- [Limitations and next improvements](docs/LIMITATIONS.md)
