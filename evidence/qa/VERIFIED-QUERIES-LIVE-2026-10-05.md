# Seven verified-query SQL definitions — 5 October 2026

Executed as ACCOUNTADMIN on synthetic NY64016 data. These are direct executions of the
source SQL definitions, not evidence of Cortex Analyst selecting a registered VQR or
of a native skill invocation. The resulting semantic-view source changes require deployment.
The final anonymous block took 1.9 seconds in total; this is not answer p95 latency.

| Definition | Actual query ID | Observed rows / values |
|---|---|---|
| vq_patients_missing_evidence | 01c78396-0004-0e08-0001-fe5a001700fa | Nine patients with not_evaluated checks; includes PAT-DEEP-0001 |
| vq_open_blockers_per_gate | 01c78396-0004-0e08-0001-fe5a001700fe | clinical: 1 blocker |
| vq_conflicting_authorisation | 01c78396-0004-0e08-0001-fe5a00170102 | PAT-DC-07: table pending, letter approved |
| vq_failed_gates_per_gate | 01c78396-0004-0e08-0001-fe5a0017010a | clinical: 10; safety: 2 |
| vq_eligible_schemes | 01c78396-0004-0e08-0001-fe5a0017010e | PM-JAY: 12; Maharashtra: 3; Tamil Nadu: 2 |
| vq_curable_denials | 01c78396-0004-0e08-0001-fe5a00170112 | count 0; no positive denial fixture proved |
| vq_review_issues_by_state | 01c78396-0004-0e08-0001-fe5a00170116 | open: 1 |

Parent query: `01c78396-0004-0e08-0001-fe5a001700f6`.
Nested statement IDs were captured from Snowflake Scripting SQLID after each execution.

## Failure and fix

Original source definitions all executed in parent `01c78390-0004-0d3e-0001-fe5a0016f656`.
The conflict query returned zero because it checked only status=conflicting, while the
flagship synthetic fixture stores pending in the table and approved in the letter field.
The blocker query also lacked a blocker-severity predicate. Behavior regressions reproduced
both defects. Explicit pending/approved/denied/expired disagreements now return conflicts;
NULL or not_received letter status does not become a contradiction. Blockers require
state=open and severity=blocker. Semantic facts/metrics now use these same conditions.

The first correction still omitted pending from comparable statuses and returned zero
in parent `01c78393-0004-0e08-0001-fe5a001700a2`. A pending-versus-approved regression then
failed and was fixed. Full tests subsequently exposed severity missing from the semantic
view dimensions; it is now declared. The final source queries produced the rows above.

An earlier worksheet transport attempt displayed Execution failed without a new server
query ID. A separate USE ROLE request restored execution; no fabricated ID was assigned.

Not_evaluated is not itself proof that evidence was not received: a check can be unavailable
for other reasons. Use its SQL reason and source states before explaining missingness.
Scheme counts are patient-scheme pairs and must not be summed as distinct patients.
