# Five-minute demonstration script

**Audience:** Heritage House technical and business stakeholders (role-played by the interview panel).
**Set-up:** present from the live demo at https://customer-migration-lab.vercel.app, or locally with `npm run build && npm start`. Open `/` in a full-width window. Before you start, run the Validation Lab once in the same browser (on the live demo its results are recorded as `vercel-production`) and reset the scenario to workshop defaults (photographs **private**). Have `/decision` ready in a second tab.

Timings are a guide. Spoken lines are in quotes; stage directions are in italics.

---

### 0:00–0:40 · Frame the decision (Customer Brief)

*Point at the banner, then the headline.*

"Before we start: Heritage House is a fictional customer, and everything you'll see is labelled as inspected, assumed, proposed or measured. What you want is AI analysis of photographs without putting private family stories at risk. The question on the table is whether moving hosting to Vercel helps you get there, not whether migrating is good in general."

*Scroll to the stakeholder table.*

"Each of you has a different test. Engineering cares about release safety, your DPO about private data, Finance about predictable cost. Today should give each of you something you can check."

### 0:40–1:30 · Ground it in the code

*Scroll to "What the reference repository establishes".*

"I read the code before forming a view. Three things matter. The app is already Next.js, so this would be a hosting change, not a rewrite. Firebase Auth is real, but photos currently sit in browser storage. And the AI route has no authentication, timeout or size limit. Anyone who finds that URL can spend your Gemini quota."

"Equally important is what the code doesn't tell me: where it's hosted today, how you release, and what it costs. Those are open questions, and I won't guess at them."

### 1:30–2:20 · Make the scenario move (the key moment)

*In Scenario controls, switch Photographs from **Private** to **Public**, then back to **Private**.*

"Watch the implications. When photos are public, I recommend caching images at the CDN. Set them back to private, and that recommendation is withdrawn and replaced by a requirement: private, no-store, and authorisation on every request. It also adds a cross-user access test to your acceptance criteria and to the migration plan."

*Drag image size past about 3.4 MB.*

"Larger images cross the 4.5 MB function body limit once they're base64-encoded, so the rule now requires a different upload path. These are plain, testable rules. No model decides anything."

### 2:20–3:10 · The architectural judgement (Architecture Review)

*Open `/architecture`. Show the AI analysis flow, then toggle **Retain + harden**.*

"An analysis request crosses five service boundaries, and each one needs a timeout and an error contract. Now compare the two options. Notice that the required fixes are identical in both. The honest message is that most of the risk reduction comes from hardening, not from changing host."

*Scroll to the recommendation.*

"So my recommendation is a measured candidate on Vercel, because you're already on Next.js and previews plus instant rollback answer your release concerns. On the right is what would change my mind, including evidence that your current host already does this well."

### 3:10–4:10 · Evidence, not assertions (Validation Lab)

*Open `/lab`, click **Run validation checks**.*

"This is a working, hardened version of the analysis flow. These ten checks make real requests: auth rejection, bad and oversized images, a simulated provider timeout, automatic recovery from a transient failure, and that private photos never get shared-cache headers."

*Point at the timing card and the environment table.*

"The timings are real, but local and simulated, and they're labelled that way. Your baseline and the candidate both say 'Not measured', because they haven't been. I'd rather show you an empty cell than an invented improvement."

### 4:10–5:00 · The decision and the ask (Executive Decision)

*Switch to the `/decision` tab.*

"The brief writes itself from what we've just agreed: recommendation, tradeoffs, risks, evidence so far, and conditions. The cost section stays incomplete until we enter sourced unit prices and measure CPU time. I won't put a number in front of Finance without that."

*Click **Print / save as PDF**.*

"My ask today is small: approve a time-boxed evaluation, give us access to current hosting metrics, and agree a go/no-go date. No production change is requested."

---

## Likely follow-up questions

- **"Why not Edge?"** Analysis is I/O-bound waiting on Gemini and needs full Node APIs. The default Node.js runtime with a region next to Firebase is the right fit, and active CPU isn't billed while waiting.
- **"Does Vercel make us GDPR-compliant?"** No hosting choice does on its own. Photographs reach Gemini and Firebase under either option, so their processing terms and your DPIA are separate workstreams. That's why it's a requirement in the brief.
- **"What if Gemini is down?"** One automatic retry for transient errors, then a retryable error with the photo preserved. At high volume, queued analysis becomes worth discussing (shown as a consideration above 50,000/day).
- **"How do you roll back the cutover?"** The old host stays live through monitoring and DNS reverts. After cutover, Instant Rollback handles bad releases, noting that it doesn't roll back environment variables or data.
- **"Show me the rules."** Open `src/lib/rules/index.ts` and its tests.
