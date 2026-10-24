# Limitations and next improvements

## Current limitations

1. **Simulated authentication.** Two fixed demo bearer tokens stand in for Firebase ID-token verification (`src/lib/analysis/auth.ts`). No `firebase-admin` integration exists.
2. **Gemini path not exercised.** The optional REST provider is implemented and type-checked but has not been run against a live key. Model availability (`GEMINI_MODEL`) must be confirmed.
3. **No rate limiting implemented.** It is recommended by the rules, but the prototype has no per-user limiter (that would need shared state such as Redis from the Marketplace).
4. **Timings describe the demo app, not Heritage House.** Two sets exist, both with simulated AI: local route overhead on one machine, and one run against the demo deployment (2026-10-24, `vercel-production`, `lhr1`, n=10, browser in the UK: round trip p50 33.1 ms, p95 42.1 ms). Neither is a Heritage House baseline or candidate measurement, and there is no field (LCP) data. The UI shows those as "Not measured".
5. **CDN behaviour is observed only for the demo's synthetic images.** On the demo deployment (2026-10-24), a public image returned `x-vercel-cache: MISS` then `HIT`, and a private image returned `BYPASS` with `private, no-store` on repeat requests (401 anonymous, 403 for another user). This confirms the caching headers work as intended on Vercel's CDN. It says nothing about cache hit rates for real collection traffic.
6. **Fault injection is request-controlled.** Fine for a demo; it must be disabled (`FAULT_INJECTION=disabled`) in any real system.
7. **Rules are deliberately simple.** Thresholds (peak factor 4×, 60/min, 5,000/day, 50,000/day) are stated assumptions, not calibrated values.
8. **Cost model scope.** It covers only the analysis workload under Option A, with empty default prices. Option B cannot be modelled without the current invoice.
9. **State is per browser.** Scenario, prices and validation runs live in `localStorage`, so they are not shared between devices or presenters.
10. **No end-to-end test suite.** The browser flow was verified manually with Playwright tooling during development, and is not automated in CI.

## Next most valuable improvements

1. **Deploy a protected candidate** of the hardened workload, against non-production Firebase with real ID-token verification, and run the Validation Lab against it. The demo app is already deployed (https://customer-migration-lab.vercel.app) and its CDN behaviour confirmed; a candidate deployment would produce the first Heritage House candidate measurements.
2. **Replace demo auth with `firebase-admin` `verifyIdToken`**, using a Firebase emulator for local runs.
3. **Add a scripted Playwright journey** (change scenario → see implication → run checks → print) to CI.
4. **Add a per-user rate limiter** and a corresponding validation check that returns 429.
5. **Add a direct-to-storage upload path**, so that the large-image rule has a working counterpart.
6. **Add a baseline capture template:** a small script that runs the same checks against any URL, so that the customer's current host can be measured on equal terms.
