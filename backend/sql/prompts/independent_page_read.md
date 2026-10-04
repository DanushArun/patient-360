---
prompt_id: independent_page_read
extractor_version: independent-page-read@0.1
single_document_version: independent-two-family@0.2
models: [llama3.3-70b, claude-haiku-4-5]
status: draft - offline source checks only; live compilation and evaluation pending
---

# Independent page readers — candidate change

Both models receive the same source and instructions. Neither sees the other
reader's value, unit or conclusion. Each call fixes temperature at zero and
limits output to 1,800 tokens. This is interpretation verification of shared
parsed text, not independent verification of original pixels.

The executable prompt strings remain in the existing SQL procedures:

- `tasks/extract_assertions.sql`: bounded batch, ten pages maximum per invocation;
  subject/predicate contract retained for existing ontology mapping.
- `procedures/extract_one_document.sql`: one bound patient/document/page;
  canonical-concept contract retained.

Both ask for verbatim value/unit, typed negation/missingness, and an exact quote;
no calculations or clinical judgments. Type-specific hints cover lab, pathology,
authorization and discharge documents; other types use conservative generic text.

Verification requires an unambiguous exact quote and matching typed readings.
Repeated concepts with different quotes are not collapsed by concept alone.
Identical repeated quotes remain unverified rather than choosing the first match.
Pending/unreadable results cannot carry an asserted value. Unverified/conflicting
values and units are withheld; raw pass values remain available for audit.

The two SQL envelope shapes are **not yet one shared implementation**. Python's
offline contract and source regressions define comparison checks, not proof that
both SQL procedures compile or behave identically. Specimen identity in SQL
remains incomplete: retaining a specimen in a quote is not a substitute for a
persistent, reviewed assertion-to-specimen link. Do not claim that gap is closed.

No automatic historical re-extraction: a prompt-version change alone must not
trigger new charges or mix old/new assertion sets. A controlled migration for
existing assertions is still required. Pages producing no assertions can still
be selected on a future scheduled run; leave schedules off during evaluation.
