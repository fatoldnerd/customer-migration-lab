<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Customer Migration Decision Lab

## Purpose

An interview demonstration for Brad Towers (Vercel Head of Solutions Architecture, EMEA application). It walks a **clearly fictional** enterprise customer, **Heritage House**, through an architecture and hosting-migration decision, using the real open-source **Memory Artifact** app (https://github.com/fatoldnerd/memoryartifact) as the reference workload.

The journey is: customer objective → architectural decision → migration approach → validation evidence → executive recommendation. It must support a five-minute presentation, with deeper material available for follow-up questions.

## Scope (v1)

One fictional customer, one reference workload, two architecture options, five scenario controls, a small set of executable validation checks and one printable decision brief. Out of scope: accounts, billing, persistence beyond browser storage, a general-purpose migration engine.

## Evidence standards (non-negotiable)

Every claim belongs to exactly one category, and the UI labels it:

| Category | Meaning | Example |
| --- | --- | --- |
| **Inspected** | Verified by reading the reference repo (commit `5850081`) | Analysis route has no auth check |
| **Assumption** | Fictional Heritage House context | 40k daily analyses |
| **Proposed** | A change we recommend, not yet done | Verify Firebase ID token server-side |
| **Measured** | Produced by an actual execution in this app, with metadata | Local p50 from the Validation Lab |

- Never invent hosting providers, production deployments, adoption, benchmarks or performance improvements. Show **"Not measured"** when data is absent.
- Do not imply that choosing a region establishes regulatory compliance, or that a hosting change controls downstream providers' (Gemini, Firebase) data handling.
- Do not present migration as automatically beneficial. Most of the critical risk reduction (auth, timeouts, input limits) is independent of hosting.
- Cost estimates expose their inputs and arithmetic. Unit prices are editable and carry a source and a date. Missing prices make an estimate visibly **incomplete**.
- Simulated AI responses are always labelled as simulated.

## Inspected reference facts (commit 5850081, 2025-12-01)

- Next.js 16.0.5 App Router, React 19.2, TypeScript, Tailwind 4.
- Firebase **Auth** is used client-side. Firestore and Storage are initialised but unused. Artifacts, photos (base64 JPEG, max 1200px wide) and audio are stored in browser `localStorage`. The repo's CLAUDE.md describes a Firestore/Storage layout, which is documented intent rather than implementation.
- One server route, `POST /api/analyze-artifact`, sends a base64 data URL to Gemini (`gemini-2.0-flash`, `@google/generative-ai`) with the server-only key `GOOGLE_GEMINI_API_KEY`. It has no auth check, timeout, retry, rate limit or body-size limit.
- No hosting configuration, tests or security-rules files exist. **Current hosting is unknown.**

## Architecture principles

- Simplest suitable architecture: one Next.js 16 app, App Router, Cache Components (on by default), Node.js runtime. No database and no UI component library.
- Recommendation logic is **pure, typed, deterministic rules** in `src/lib/rules/`. No LLM decides anything. Every recommendation carries its rationale and the inputs that triggered it.
- Scenario state lives in a client context (`src/lib/scenario/`) persisted to `localStorage` behind try/catch. The app must render without it.
- The reference workload (`/api/analyze`) runs **simulated** AI by default. Real Gemini is optional, server-side only, and enabled by `AI_PROVIDER=gemini` plus `GOOGLE_GEMINI_API_KEY`.
- Private content is never served with shared-cacheable headers. Public fixture images may use `s-maxage`.
- Fixtures are synthetic: SVG illustrations and invented stories.

## Layout

- `src/app/` — routes: `/` (Customer Brief), `/architecture`, `/migration`, `/lab`, `/lab/objects/[id]`, `/decision`, `api/*`
- `src/lib/rules/` — recommendation rules and option selection (unit tested)
- `src/lib/analysis/` — request validation, provider adapters, timeout/retry (unit tested)
- `src/lib/validation/` — browser-run checks and timing statistics
- `src/lib/cost/` — transparent cost model
- `src/data/` — customer brief, architecture, migration-plan and object fixtures
- `docs/` — ADR, demo script, limitations

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest unit tests (rules, analysis, cost, stats)
npm run lint
npm run typecheck  # runs `next typegen` first; route types (PageProps, RouteContext) are generated
npm run build      # production build; run before claiming completion
```

## Established implementation decisions

- Next.js 16.4 with Cache Components: avoid render-time `new Date()` and other non-deterministic values in prerendered components. Read them on the client (see `PreparedOn` in `DecisionBrief.tsx`).
- Private fixture images are served from a route handler, never from `public/`, so access control and `private, no-store` apply.
- Demo auth uses fixed bearer tokens (`src/lib/analysis/auth.ts`) in place of Firebase `verifyIdToken`. Keep it clearly labelled as simulated.
- Timeouts are not retried automatically; transient 5xx/429 are retried once with jitter.
- Browser verification screenshots go in `.playwright-mcp/` (gitignored).

## Verification expectations

Before reporting work as done: `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` all pass. Then exercise the flow in a browser: change a scenario control, see the architecture consequence, run the validations and open the print view. When reporting, separate code inspection, automated checks and browser testing, and state anything that was not verified.
