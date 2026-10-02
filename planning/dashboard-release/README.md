# Dashboard frontend delivery — 2 October 2026

The frontend is implemented and verified with controlled responses.
Full-system acceptance remains pending live backend integration.

## Current scope and ownership

Danush's team owns backend deployment and integration. The parent owns frontend implementation,
production diff review, browser verification and this handoff. Subagents are stopped.

The latest storyboard controls appearance; IA/user-flow PDFs control navigation.
Returned data controls facts, timestamps, status and write receipts.

## Verified frontend results

- 237/237 unit/render tests pass on the exact reviewed snapshot.
- 40/40 browser tests pass, including all 22 designer steps and recovery branches.
- Production compilation and TypeScript checks pass.
- The final history-table repair passed another 6/6 screen/accessibility checks.
- Actual captures: [evidence/screens](evidence/screens).
- References, paths and deliberate differences: [screen-comparison.json](screen-comparison.json).
- Reviewed source commits: loading recovery `1dadcb9`, designer screens `31b9e49`.
- No live database, model, persistence or clinical-validation proof is implied.

Worklists/search, seven patient sections, source reading, authorization comparison, follow-up
drafts/receipts, queue/history, typed answers, Class A refusal, packet preview, family copy,
responsive reading and recovery are implemented.

## Performance measurements

Final untraced preview benchmark: 20 samples per scenario on local Chromium.
Warm document navigation p95: 76 ms; roster switch p95: 70 ms; section interaction p95: 38 ms.
Cold preview LCP p95: 44 ms. End-to-end cold navigation remained 412 ms against its existing
300 ms ceiling; that target has not passed. Traced cold timing was 485 ms.
A phase probe measured roughly 82 ms navigation, 300 ms first role-selector visibility check,
and 12–28 ms subsequent paint wait. These measurements do not guarantee live data performance.
[Benchmark evidence](evidence/frontend-performance-final.txt) retains the failed target.

## Integration handoff

[frontend-handoff.md](frontend-handoff.md) lists existing interfaces and required governed data.

Snowflake currently rejects its certificate/OCSP check. Credentials were prepared previously;
the earlier credential-absent checkpoint is superseded. TLS remains enabled.
Eight-second UI deadlines release initial loading states; they do not repair TLS or cancel SDK retries.

Exact CBC span mapping, reference viewer data, final packet contents, historical rule changes,
ABHA/consent labels and reviewed translations require returned backend data.
The UI explicitly marks unavailable data and unsaved drafts.

## Acceptance and retained failures

[acceptance.json](acceptance.json) retains pending full-system gates. The frontend checkpoint
does not pass live access, concurrency, SQL recomputation, extraction, receipt or model gates.

The uncommitted full working tree has one failing selected-visit SQL assertion.
Backend work was excluded from frontend commits. Tests and criteria were not weakened.

The first final browser run had two stale assumptions: all workspace reads counted as fact reads,
and refresh failure located as status instead of alert. Corrected checks still verify exact fact
read counts, the alert, retained snapshot and disabled writes. Traces remain in
evidence/failures/frontend-final-screen-check.

## Review gallery

Run from the repository:

```sh
python3 tools/dashboard_visual_review.py /absolute/path/to/gallery
```

Open index.html to compare every reference with its actual capture.
Screens 19/20 have prompt references only. Screens 21/22 use prior failure/responsive sheets.
