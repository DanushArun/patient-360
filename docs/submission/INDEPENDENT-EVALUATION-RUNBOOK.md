# Independent evaluation execution

This package contains 48 development and 48 heldout questions, eight fresh synthetic
patients, eight actual PDFs, and two physically different renderers. Patient IDs, PDF
hashes and layout families are disjoint. It is prepared input, not measured accuracy.

## Before AI access

```bash
.venv/bin/python -m backend.scripts.prepare_independent_evaluation
.venv/bin/python -m backend.scripts.prepare_evaluation_load
.venv/bin/python -m pytest backend/tests/test_independent_evaluation.py \
  backend/tests/test_evaluation_loader.py backend/tests/test_evaluation_gold_freeze.py -q
```

Review `data/generated/evaluation-v2/load_pre_ai.sql`, then execute it in the intended
synthetic evaluation account as ACCOUNTADMIN. It creates only the eight bounded
evaluation identities, clinical events, digital document pages, and their synthetic
coordination consent/care-team fixtures. It requires exactly one existing active
FAC-02 practitioner mapped to CURRENT_USER(). It also loads eight fixed encounters and synthetic authorisation disagreements.
It does not create a Snowflake user,
credential, role, model, assertion or clinical rule. No genuine ABHA identifiers exist.

SQL uses UTC, MERGE and transactional writes. Existing patient, event, document or page
content must match the frozen input; mismatched or duplicate fixtures fail their controls.
If execution fails before COMMIT, run ROLLBACK in that same session before correcting
the defect. Do not continue a partially failed multi-statement worksheet to COMMIT.
The identity/consent mappings must be reviewed before executing in any shared account.

The original PDF files stay under `data/generated/evaluation-v2/pdf/`. Digital text ingestion
does not establish extraction verification. Refresh the existing document chunking and
harmonized-event pipeline before running questions. Do not manufacture ASSERTION rows.

## With final AI access: extraction, then freeze, then answer

Run the existing `EXTRACT_ONE_DOCUMENT` procedure on the four heldout document IDs:
DOC-EVAL-HELDOUT-01 through DOC-EVAL-HELDOUT-04. Preserve each actual query ID and returned
model pair. Each document must have unique verified PLT source spans from the pinned
independent families, with both readings matching its independently generated gold.

```bash
.venv/bin/python -m backend.scripts.freeze_evaluation_gold
.venv/bin/python -m backend.scripts.run_evaluation_benchmark \
  --dev data/generated/evaluation-v2/dev.jsonl \
  --heldout data/generated/evaluation-v2/heldout.jsonl \
  --gold data/generated/evaluation-v2/gold.jsonl \
  --freeze data/generated/evaluation-v2/freeze.json
```

The freezer rejects missing, ambiguous, unverified or disagreeing extraction and checks
actual SQL source spans, document hashes and extractor version. Final gold has 44
structured/refusal/rule entries plus four document entries with actual assertion IDs.
It refuses to overwrite frozen gold. Preparation also refuses a FROZEN output directory.
Changing patients, layouts, source values or expected facts requires a new versioned
directory, frozen before answering. Never refreeze after observing heldout model outputs.

Document entailment still requires independent source adjudication bound to each captured
artifact and claim hash. The harness marks missing adjudication unmeasured/failing rather
than counting a citation as proof of entailment. Eight heldout cases explicitly test missing pathology and conflicting authorisation
through SQL rule citations. Their expected outcomes and exact rule versions are frozen
from synthetic fixture design before model answering; they are not inferred from answers.
The plain-RAG comparator remains separate acceptance work. The original 40-question
package is retained as an earlier preparation artifact; use evaluation-v2 for the release. Report all rates with counts and cold starts separately.

The current workstation's strict connector cannot validate its intercepting proxy's OCSP
chain. Use a correctly configured trusted network; do not disable TLS or OCSP checks.
