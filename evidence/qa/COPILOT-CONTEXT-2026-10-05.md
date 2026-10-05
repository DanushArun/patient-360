# Copilot context boundary — 5 October 2026

Scope: source checks and metadata compilation on KGTPGHJ-YJ28449 / NY64016.
No native inference, integrated context retrieval or latency distribution is proven here.
The warehouse remains suspended at the approved 3-credit allowance. Billing is unchanged.

## Implemented boundary

The original bound SQL session collects six record domains, readiness, patient-document
results and reference-document results before inference. Patient and reference corpora
remain separate named lists. Latest lab records are selected in SQL per concept; an invalid
latest record does not cause selection of an older result. Final claims still require the
independent deterministic answer validator. Context is not permission to assert a claim.

One VALIDATE_ANSWER result freezes the SQL snapshot clock used by every context section.
A fresh access fingerprint is checked before transmitting the packet to the native agent;
the outer gateway and web boundary also check scope after the operation.
Optional provider failures produce unavailable sections and redact raw dependency details.
The packer bounds arrays, strings, object keys and nesting; packets above 64,000 serialized
characters are withheld. No confidence percentage or treatment conclusion is generated.

## Actual compilation and grant receipts

| Object / check | Query ID | Result |
|---|---|---|
| Pure context packer CREATE | 01c78431-0004-0d3e-0001-fe5a001711da | Succeeded |
| Context-aware inference CREATE | 01c78431-0004-0e08-0001-fe5a00170d62 | Succeeded |
| Corrected two-argument patient-search dispatcher CREATE | 01c7843e-0004-0e08-0001-fe5a00170eca | Succeeded |
| Frozen-clock collector CREATE | 01c7843f-0004-0d3e-0001-fe5a001712da | Succeeded |
| Packer SHOW GRANTS | 01c78437-0004-0d3e-0001-fe5a0017124e | One ownership row: ACCOUNTADMIN |
| Dispatcher SHOW GRANTS | 01c78438-0004-0e08-0001-fe5a00170e3e | One ownership row: ACCOUNTADMIN |
| Corrected dispatcher SHOW GRANTS | 01c7843f-0004-0e08-0001-fe5a00170eea | Succeeded |
| Frozen-clock collector SHOW GRANTS | 01c7843f-0004-0d3e-0001-fe5a001712e2 | One ownership row: ACCOUNTADMIN |
| Inference SHOW GRANTS | 01c78431-0004-0e08-0001-fe5a00170d7a | One ownership row: ACCOUNTADMIN |

No app/PUBLIC grants were added. Existing public ASK remains on its earlier working revision;
it was not switched to the new context boundary without coordinated deployment/runtime checks.
Source installation order is packer, dispatcher, collector, inference, then ASK.
Updated normalization DT and validator must precede their readers and the new web boundary.

## Failure and fix evidence

- A context call passed three arguments to SEARCH_PATIENT_DOCUMENTS, whose signature takes
  two. A regression failed, the extra argument was removed and all 13 context tests passed.
  CREATE success alone did not discover the nested-call defect.
- A missing cutoff could let successive sections resolve different current times. A failing
  regression now requires all sections to use the first validated SQL clock. Fixed in source
  and compiled collector; integrated runtime remains unverified.
- One metadata batch stalled before receiving a query ID. Execution was canceled through
  Snowsight. Separate dispatcher/collector retries succeeded with the IDs above.
- Concurrent search harness previously checked only structured facts. Three new behavioral
  tests reproduced undetected foreign search results and an empty positive control. The
  runner now checks owner-rights search with authorized nonempty controls plus foreign
  patient/document/event canaries for every connection. Nine harness tests pass.

## Regression and acceptance boundary

Full Python: 679 passed, 14 live-dependent skips, 36 subtests, 5.57 seconds.
Context/security targeted regression: 22 passed. Web remains 286 passed, with unchanged
web code since its passing typecheck and production build. Bundle has 11 current files.
Deck r5 passed package/layout/import validation and its changed evidence slide was reviewed.
Deck SHA256: a2709bde180d022243b4d3a229293bae2c114c9b75163fb57f09d3c9d97899d6.

Nine sequential context providers add work. Warm p95 is unmeasured and requires the funded
account. Native MCP session continuity, ten actual concurrent connections, concurrent writes,
in-flight consent cancellation and connected new-document ingestion remain separate open gates.
Post-response scope checks withhold data; they do not cancel an already running query.

Snowflake transaction guidance checked 5 October 2026 via Context7:
https://docs.snowflake.com/en/sql-reference/transactions.html describes DML locks as generally
preventing concurrent UPDATE/DELETE/MERGE. Actual concurrent receipt uniqueness must still be
measured; sequential retries and a declared UNIQUE on a standard table are insufficient proof.

## Actual pure-packer execution attempt

CALL with explicit synthetic constants failed before JavaScript execution:
01c78441-0004-0e08-0001-fe5a00170f02. The warehouse cannot resume because the
approved resource monitor allowance is exhausted. No AI was invoked. This is not a
packer runtime pass. Local tests execute the actual JavaScript body through Node.
