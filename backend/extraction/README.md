# Offline document extraction trial

## What this changes

This is an isolated evaluation module, **not a replacement for the deployed
Snowflake pipeline**. It uses the real LangExtract 1.7.0 library with fake model
responses in tests. Offline commands do not read credentials, query Snowflake,
call Google, deploy procedures, or change clinical calculations. The optional
transport defaults off and is not wired to the application. Frontend dependency
manifests are unchanged by this trial.

- `baseline.py` reads four existing synthetic PDFs and checks ten expected field
  lines, patient/date/specimen anchors, and source hashes.
- `contract.py` checks typed findings, exact source text, Unicode positions,
  specimen context, and agreement between two different model families.
- `langextract_adapter.py` supplies a Cortex-shaped request through an explicitly
  injected completion function; there is no automatic provider selection.
- `cortex_transport.py` provides an opt-in Snowflake-only HTTP boundary with
  required server-authentication hooks, normal TLS verification, redirect
  rejection, timeout and request limits. Access-procedure wiring and live
  compatibility remain unverified. Tests inject fake HTTP responses.
- `document_profile.py` routes explicit supported headings, keeps unknown and
  ambiguous types unknown, validates supplied parser page envelopes and reports
  observable text defects without inventing image-quality scores.
- `compare.py` scores saved A/B/C predictions against the same source hashes;
  it does not generate predictions or invent cost/latency results.
- The document viewer uses code-point positions, matching Python/SQL text spans.
  A whole-page range is labelled page-level evidence, not a precise highlighted
  excerpt. Existing scoped reads and invalid-source rejection remain in place.

## Run locally

From the repository root, use an isolated Python 3.12 environment:

```sh
python3.12 -m venv /tmp/saarthi-langextract-trial
/tmp/saarthi-langextract-trial/bin/python -m pip install -r backend/extraction/requirements-trial.txt
/tmp/saarthi-langextract-trial/bin/python -m unittest backend.tests.test_extraction_contract backend.tests.test_langextract_adapter backend.tests.test_document_profile backend.tests.test_document_sql_contracts backend.tests.test_cortex_transport backend.tests.test_extraction_comparison -v
/tmp/saarthi-langextract-trial/bin/python -m backend.extraction.baseline
```

The two direct dependencies are pinned; transitive dependencies are not fully
locked yet. Installation downloads packages, but these commands do not invoke
paid model services. Adapter tests block socket connections and DNS. If the
optional library is absent, adapter tests skip: a skipped run does **not** prove
compatibility. Check for zero skips before reporting success.

Frontend checks, after syncing the existing `web/package-lock.json` dependencies:

```sh
cd web
npm test
npm run typecheck
```

Do not open live patient pages or run deployment/smoke scripts as part of this
offline test. Those can issue database queries.

## What the fixtures mean

All values come from existing files in `data/generated/pdf`.

| Existing document | Expected printed findings |
| --- | --- |
| CBC | WBC `6,000 /CUMM`, neutrophils `35.0%`, platelets `2,60,604 /CUMM` |
| Outside biopsy | Specimen `SPEC-OUTSIDE-001`, Grade `II`, HER2 IHC `1+` |
| Surgical specimen | Specimen `SPEC-SURGICAL-001`, Grade `III`, HER2 IHC `2+` |
| Altered CBC | WBC and neutrophils as above; printed platelets `2,60,904 /CUMM` |

The altered CBC must be evaluated against its **printed** value, not silently
corrected to the source ledger. Outside and surgical specimens stay separate.
Conservative heading routing is implemented locally. It is not a general trained
document classifier; unknown or ambiguous headings need review.

The baseline's `extraction_score` is `null` until independent candidate outputs
are supplied with `--predictions FILE`. Matching ten text lines is not 100%
extraction accuracy. The command's local PDF read duration is not dashboard,
OCR, model, or end-to-end answer latency. Evaluate existing exported Cortex parse
output with `--parsed-documents FILE` (object keyed by fixture doc_id, each value
is the original `{metadata:{pageCount:...},pages:[{index:...,content:...}]}` result).
This does not invoke the parser. Exact fixture-line order is measured; general
table association and original-image readability remain unmeasured.

Compare independently saved predictions with:

```sh
python -m backend.extraction.compare --a current.json --b corrected.json --c langextract.json
```

Every input maps all four fixture document IDs to `{text_sha256,findings}`; each
finding uses the exact `Finding` contract in `contract.py`. Missing/invalid inputs
cannot produce a winning score. Do not fill predictions from fixture answers
and call that model accuracy.

## Safety and cost boundaries

Each model instance permits one request, one prompt, no retries, and no provider
fallback. The request fixes temperature to zero and caps output at 1,800 tokens;
source pages are limited to 12,000 characters. Two model instances are required
for two independent reads. These per-instance limits are **not an account-wide
spending cap** and must be backed by job/request limits before live integration.

Only approved model IDs are accepted. A pass cannot consume the other pass's
answer. A missing or disagreeing second finding never produces an accepted
value. Malformed, truncated, refused, fuzzy, ambiguous, or silently dropped
findings fail closed. Empty extractions remain empty rather than inventing facts.

Exact matching proves where text came from, not whether the model interpreted it
correctly. Repeated identical quotes are deliberately rejected by the adapter
until disambiguation is tested. Two models reading the same parsed text are not
independent image/OCR verification. Mock examples establish plumbing only, not
clinical accuracy or improvement over the current extractor.

## ANC review: confirmed locally, formula unchanged

`backend/sql/dynamic_tables/01_harmonized_events.sql` mentions bands in its
comment, but derives ANC using only `WBC * NEUTROPHIL_PCT / 100`. The derivation
label reflects that actual expression. Source semantics must establish whether
`NEUTROPHIL_PCT` already includes bands; do not assume an absent component is zero.

Also review same-patient/specimen matching, plausible inputs, direct-ANC selection,
and input safety classification. The current derivation joins by encounter/time,
and `backend/sql/data/ontology.sql` marks WBC and NEUTROPHIL_PCT non-safety-critical
even though they feed ANC. These are code-review findings, not verified database
contents. No SQL, thresholds, clinical mappings, or rules were changed here.

## Remaining gates, in order

1. Finish source-field mapping and get clinical review before changing ANC.
2. Compare current and corrected extraction using held-out synthetic documents;
   include table associations, repeated findings, unreadable text, and specimens.
3. With separate approval, wire the transport's server-side authorisation and run
   one bounded live page test. Verify endpoint/model availability, authentication,
   consent checks, token usage, timeout handling, and two-family responses.
4. Compare corrected Cortex extraction with and without LangExtract on the same
   sources/models. Report correct, missed, unsupported, and exact-citation counts,
   plus observed cost and latency. Adopt only if it adds measurable value.
5. Then assess Snowflake Python packaging/runtime compatibility. Local import
   success does not prove execution inside a Snowflake procedure.
6. Integrate batch/single-document verification and scoped evidence-to-answer
   links without changing R1–R7. Test the complete workflow before hosting.

Website performance is a separate workstream. The latest main branch contains
earlier local measurements in `planning/dashboard-release/evidence/performance-baseline.md`.
Do not treat those as fresh results from this trial or hosted Web Vitals.

**Status: partial — local mocked compatibility, not live integration or clinical validation.**

### Second local checkpoint — SQL candidates, not deployed

The existing SQL source now contains heading routing, unknown capture quality,
independent bounded batch reads, strict quote/typed-result checks in both paths,
verified assertion pointers in patient Search, and exact-span/access/cutoff
checks in the answer validator. Agent instructions distinguish page retrieval
context from verified assertion evidence. The validator replaces model-supplied
citation positions with database-resolved positions.

No tables, clinical rules, grants or schedules were added. These candidate
changes require Snowflake compilation and isolated live regression tests before
being called working backend integrations. The batch and single-page envelope
shapes remain different; persistent SQL specimen links and reference-clause
validation still need work. See [release gates](../../docs/DOCUMENT-IMPROVEMENT-RELEASE-GATES.md).

### Recorded checkpoint — 3 October 2026

- Python: 26 passed, zero skipped (15 contract/baseline + 11 adapter tests).
- Frontend: 265 unit/render tests passed; TypeScript passed.
- Existing PDF baseline: 4 documents, 10/10 expected lines, all context anchors
  matched; candidate extraction accuracy remains unmeasured.
- Initial broad frontend checks failed after the pull because local dependencies
  lacked `ajv` and Playwright. Syncing the existing lockfile with install scripts
  disabled fixed the environment; dependency manifests were not edited.
- No full production build or browser E2E run in this checkpoint. No database
  queries, paid inference calls, or deployments.

### Continue on the other laptop

Use branch `langextract_use`, then create the isolated environment and run the
offline commands above. Keep that laptop's credentials local; do not copy keys
or `.env` files into Git. Its key must already authenticate `SITAR` in
`OHCXVXM-OS69400`, not the exhausted teammate account. Creating a public-key
file alone does not register it in Snowflake.

After installing the existing frontend lockfile with `cd web && npm ci`, the
approved metadata-only check can run from the repository root:

```sh
node --use-system-ca backend/scripts/preflight-langextract-os69400.mjs --approved-metadata-check
```

Use a Node version supporting `--use-system-ca` (tested here with Node 24.19.0).
The script reads `SNOWFLAKE_PRIVATE_KEY_PATH` from the shell environment if set;
otherwise it uses `.snowflake/keys/sitar_snow_rsa.p8` under the current user's home.
It does not load `.env` automatically. It prints no key contents.

The account-specific default-role change has separately been approved. If still
needed, `--approved-set-app-default` applies only that change and verifies it.
Neither mode reads patient data, selects/resumes a warehouse or calls a model.
Both keep TLS/OCSP protection enabled and stop after 45 seconds.

**There is not yet a complete live-test runner.** The transport still requires
real server-side authorisation/token wiring and dollar-bound checks before the
approved one-page, maximum-four-call, $1 test. Do not call the existing full
deployment or one-document ingestion scripts as a substitute. See the release
gates for the exact approval scope, blockers and remaining work.

Latest offline checkpoint: 51 targeted Python tests, 265 frontend tests,
TypeScript and nine manifest/preamble gates passed. No clinical validation or
live extraction-accuracy result is claimed.
