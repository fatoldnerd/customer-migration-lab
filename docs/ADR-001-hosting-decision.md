# ADR-001: Hosting and server-side AI workload for Heritage House

- **Status:** Proposed (fictional scenario)
- **Date:** 2026-10-23
- **Deciders (fictional):** Chief Digital Officer (sponsor), Head of Engineering, Data Protection Officer
- **Reference workload:** github.com/fatoldnerd/memoryartifact @ `5850081`

## Context

Heritage House wants AI-assisted analysis of photographs in its collections app, which is built from the Memory Artifact code base. Code inspection established the following:

- The app is already Next.js 16 (App Router).
- Firebase Auth is used in the browser. Firestore and Storage are initialised but unused; data lives in browser localStorage.
- A single server route sends the full image as base64 JSON to Gemini, with **no authentication, timeout, retry, rate limit or size limit**.
- The repository contains no hosting configuration, so the current host, region, release process, baseline performance and costs are all **unknown**.

## Options considered

**A. Host the Next.js frontend and server routes on Vercel; keep Firebase.** This brings per-branch preview deployments, Instant Rollback, a global CDN for static and public content, and active-CPU pricing in which time spent waiting on the AI provider is not billed as CPU. Costs: migration and verification effort, a function region that must be chosen next to Firebase (the default is `iad1`), and a 4.5 MB request-body limit that constrains the current base64 upload design.

**B. Keep the current hosting, apply targeted hardening and defer the migration.** This is the lowest effort and the fixes are identical. The cost is that the stated concerns about deployment speed and recovery are only addressed if the current host already supports them, which is unknown.

## Decision

1. **Under both options:** verify Firebase ID tokens server-side; validate input before any provider call; bound Gemini calls with a timeout and one retry for transient errors; return structured, retryable errors; set `private, no-store` on private content and analysis responses; add per-user rate limits.
2. **Hosting:** the recommendation is generated from the scenario by `decideOption()`.
   - With the workshop defaults (balanced preference, 8,000 analyses/day), the recommendation is **Option A as a measured candidate**: deploy a hardened preview, validate it against the acceptance criteria, and cut over only on that evidence.
   - If the customer prefers minimal effort and volume is below 5,000 analyses/day, the recommendation becomes **Option B**.

## Consequences

- Most of the risk reduction comes from the hardening, not from the hosting choice. Presenting it that way keeps the recommendation credible.
- A hosting move does not change how Gemini or Firebase handle data. Data-protection review is a separate requirement, and region choice alone does not establish compliance.
- If typical images exceed about 3.4 MB, the base64 upload exceeds the function body limit. In that case Option A requires client-side downscaling or a direct-to-storage upload.
- Cost cannot drive the decision until the current invoice is known and unit prices are entered with sources.

## What would change this decision

- The current host already provides equivalent previews, rollback and CDN caching at comparable effort (favours B).
- The candidate misses the latency or error-rate criteria against the measured baseline.
- The Firebase project region has no nearby function region.
- A sourced cost model shows a material increase that the delivery benefits do not justify.
- Data-protection review restricts processing locations in a way neither option meets.
