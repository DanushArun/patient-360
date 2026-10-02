# Frontend delivery — 2 October 2026

Scope: dashboard frontend, following the designer IA, user-flow PDF, and 22-step storyboard.
Backend deployment, integration, and model availability belong to Danush's backend team.

## What is implemented

- Day care board and sortable Visits table, scoped search, restored filters/view/scroll.
- Persistent patient context and Overview, Facts, Timeline, Documents, Coverage, Review, Family.
- Compact source inventory, seven evidence states, three clocks, and source-page reading.
- Authorization comparison, task draft/cancellation, confirmed receipt, uncertain-save recovery.
- Review queue board/table, task details, ownership/version updates, and record change history.
- Patient/reference question scopes, typed cited answers, Class A refusal and packet preview.
- Family preparation and clipboard recovery; translations currently cover headings only.
- Mobile evidence dialog, keyboard focus restoration, touch targets, zoom and source wrapping.
- Eight-second initial record-read deadlines and actionable recovery navigation.

## Backend interfaces the frontend consumes

| Interface | Required behavior |
|---|---|
| Census and authorized roster | Server scope, returned visit/practitioner, distinct SQL status groups. |
| `GET /api/patient/:id` | Read stored snapshot; preserve identity, cutoff and versioned gates together. |
| `POST /api/patient/:id` | Recompute SQL, then support GET read-back; task writes do not recompute. |
| `GET /api/patient/:id/workspace?view=facts&domain=…&known_as_of=…` | Typed domain facts, clocks, source IDs and explicit temporal semantics. |
| Same endpoint, `view=documents` | Received rows plus `expected_documents`; observed verification counts. |
| Same endpoint, `view=coverage_comparison` | Structured values and separately identified letter spans; retain conflicts. |
| `GET /api/patient/:id/timeline` | Three clocks, derivation, scoped source IDs, cutoff and truncation metadata. |
| `POST /api/review-task` | Bounded action/owner, idempotency key, receipt and confirmed read-back. |
| `PATCH /api/review-task` | Expected version, eligible owner and repeat-safe receipt; preserve uncertain writes. |
| `GET /api/patient/:id/review-tasks` | Task state/events and eligible owners; state is separate from rule outcome. |
| `POST /api/ask` | Frozen validated artifact; patient/reference retrieval separated; no raw model prose. |
| `GET/POST /api/patient/:id/evidence` | Answer/packet pointers, named treating recipient and confirmed packet receipt. |
| `/patient/:id/documents/:doc` | Server-scoped page, version, cutoff and exact supplied citation coordinates. |

Access withdrawal must return the existing purge marker; stale patient responses must be discarded.
Use the existing contracts and procedures. No schema expansion is implied by this handoff.

## Optional record-change payload now supported

The review-tasks response can include `changes`. If absent or malformed, the UI explicitly says
that before/after rule results were not returned. It never infers readiness from task closure.

```json
{
  "changes": [{
    "before": {
      "known_as_of": "2026-10-01T09:42:00",
      "rule_id": "COV-AUTH-001", "rule_version": 1,
      "outcome": "conflicting", "reason": "Authorization dates disagree."
    },
    "after": {
      "known_as_of": "2026-10-02T10:00:00",
      "rule_id": "COV-AUTH-001", "rule_version": 1,
      "outcome": "pass", "reason": "Corrected authorization values agree."
    },
    "fields": [{ "label": "Valid through", "before": "30 Sep", "after": "5 Oct" }]
  }]
}
```

This example is synthetic. Both snapshots must come from existing versioned SQL results.

## Integration items requiring backend data

1. The selected-evidence panel now renders exact excerpts from optional gate `source_spans`.
   Each span requires `patient_id`, `scope: "patient"`, `assertion_id` present in `evidence_ids`,
   `doc_id`, positive `version`, zero-based `page_index`, `char_start`, `char_end`, `excerpt_start`,
   `excerpt`, `verification_status: "verified"`, and the gate's identical `known_as_of`.
   It can also display `event_time`, `source_recorded_at` and `ingested_at`.
   Propagate these existing source fields through the snapshot adapter. Invalid, unverified,
   cross-patient, reference-scope or mismatched-cutoff spans are hidden.
2. Packet preview reads returned facts and sources at the answer cutoff. The server must record
   and read back final packet contents; the frontend preview is explicitly an unsaved draft.
3. Historical rule changes, reference-source viewing, ABHA/consent labels, and reviewed
   family translations require governed returned data. They are not fabricated in the UI.
4. Live Snowflake connection currently fails its certificate/OCSP check. TLS remains enabled.
   The UI deadline releases the loading state; it does not cancel SDK retries or repair TLS.

## Verification and reproduction

The reviewed frontend commit passes **245 unit/render tests and 40 browser tests**.
All 22 storyboard steps have screenshots in `evidence/screens/`.
Browser API responses are synthetic fixtures; these results do not prove live persistence.

The test fixture installer only writes to an isolated checkout outside this repository:

```sh
cd /Users/danusharun/Documents/patient-360
node web/tests/prepare-fixtures.mjs /absolute/path/to/isolated-checkout
cd /absolute/path/to/isolated-checkout/web
npm test
npm run build
npm run test:e2e
```

Run the backend team's full suite separately. Its existing selected-visit SQL test fails in
the uncommitted working tree; that backend work was excluded from frontend commits.
Full-system acceptance remains pending live integration and model verification.
