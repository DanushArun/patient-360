# Dashboard performance: what is slow, why, and what was done

Measured 6 October 2026 on the live NY64016 account: XS warehouse, local Next.js server, real browser, timed until content is visible. Single synthetic practitioner. These are engineering measurements, not a load test.

## Why reads are slow

Next.js accounts for about 30 ms of each request. The rest is Snowflake. Each governed patient read is six sequential round trips. Averages below come from `QUERY_HISTORY`, filtered on the tag `saarthi_web_prototype`:

| Step | Average |
|---|---|
| `BIND_PATIENT` | 1.75 s |
| `VALIDATE_ANSWER` (access scope, before) | 1.42 s |
| `GET_WEB_PATIENT_DATA('context')` | 2.06 s |
| `GET_WEB_PATIENT_DATA(view)` | 2.06 s |
| `VALIDATE_ANSWER` (access scope, after) | 1.42 s |
| `RELEASE_PATIENT_BINDING` | 0.68 s |
| **One uncached read** | **≈ 9.4 s** |

Queue time was about 0 ms. The cost is per-statement latency inside the procedures, not warehouse contention. Recomputing readiness (`evaluate_gates`) takes 12–16 s on its own.

## What changed

1. **Parallel reads.** The patient page starts its snapshot and roster reads together instead of one after the other.
2. **Read-ahead** (`frontend/lib/warm.ts`, run with Next.js `after()` once the response is sent):
   - The census warms the review queue, plus each listed patient's snapshot and Overview documents.
   - The patient page warms every tab: documents, the six fact domains, coverage comparison, timeline, evidence history, review tasks for each open check, owners and schemes.
   - At most four background sessions run at once.
3. **Cache window of 2 minutes** (`frontend/lib/read-cache.ts`; it was 15 s), decided on 6 Oct 2026.
4. **Shared cache keys.** The API routes and the read-ahead use the same canonical keys (`frontend/lib/warm-plan.mjs`), so warmed entries are always the ones requested.
5. **Explicit Refresh always re-reads.** Census **Refresh** and **Refresh queue** clear the cross-patient cache before reading.

## Results

| Action | Before | After |
|---|---|---|
| Open a patient (after the census) | 9–17 s (≈30 s with tab loads) | 1.0–1.7 s |
| Patient tab | ≈9 s each | 0.1–0.2 s |
| Review queue | 3–7 s | 0.2–0.6 s |
| Return to a patient | ≈9 s | 0.3–0.8 s |
| Return to the census | 2–6 s | 0.1 s |
| First census load (cold) | 2–6 s | 1.9–4.5 s |

## Trade-offs, stated plainly

- **Consent timing.** A cached read can be up to 2 minutes old. Consent withdrawn, or a care-team change, takes effect on the next uncached read, so within 2 minutes rather than 15 s. Every cached value was produced by a full governed session, including both access checks. Writes (tasks, recompute, evidence packets) clear the patient's cache, and the cross-patient cache, immediately.
- **Credits.** Read-ahead keeps the XS warehouse running while the dashboard is in use. One full measurement pass, census plus patient plus all tabs, cost about 0.06 credits.
- **First visit after idle.** The first census load after the cache expires still pays one governed read (about 2–4 s).
- **Still slow.** **Recompute readiness** (12–16 s) and **Prepare evidence packet** (about 14 s) are writes and are never cached.
