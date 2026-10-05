# Answer boundary verification — 4 October 2026

Checkpoint: approximately 21:13 IST. Source: working tree based on
`6db4347afd6be9bc4062aab5797439018ab58389`. Changes are not committed or published.

## Account and runtime

The user confirmed `KGTPGHJ-YJ28449`, locator `NY64016`, as the submission account.
Do not attribute older OS69400 or JN89282 measurements to this account.
Snowsight executed the following tests with role `SAARTHI_APP`, secondary roles
`NONE`, warehouse `SAARTHI_AI_WH`, and a binding to synthetic patient `PAT-DC-04`.
The updated `VALIDATE_ANSWER` procedure was created here at approximately 21:03 IST.

| Test | Observed result | QUERY_HISTORY query ID | Elapsed ms |
|---|---|---|---:|
| Valid PLT evidence, asserted value 82000, invented treatment wording | One supported claim; wording replaced by SQL-derived record statement | `01c781ed-0004-0d3e-0001-fe5a0016b0de` | 5027 |
| Wrong value 999999; foreign-patient-shaped evidence ID; nonexistent evidence ID | Zero claims; three generic limitations; status `partial` | `01c781ed-0004-0d3e-0001-fe5a0016b112` | 4977 |

The first response said:

> Recorded PLT: 82000 /cumm (event time 2026-10-03T23:03:11).

It included `EVT-DC-04-PLT`, the harmonized-events table, event time,
source-recorded time, ingestion time, and `known_as_of`.
The invented treatment recommendation was absent from the response.

The foreign-patient-shaped ID was `EVT-DC-07-PLT`; its existence was not independently
checked. That rejection is **not** a positive-control-backed cross-patient leakage test.
These two calls are not a latency distribution, an end-to-end answer evaluation,
or evidence of document entailment accuracy. No p95 is reported.

## Local verification

- Python: 418 passed, 14 skipped, 36 subtests passed.
- Web unit tests: 267 passed, zero failed or skipped.
- TypeScript typecheck: passed.
- Next.js production build: passed.
- Browser E2E: not rerun at this checkpoint; earlier stubbed runs remain historical.

The evaluation scorer now retains missing answers in the denominator and rejects
duplicate/unknown question IDs. This corrects scoring behavior; it does not repair
the patient/layout overlap in the question split or constitute a model evaluation.

## Boundary and remaining work

The web Q&A path now validates the candidate on its bound session and releases only
the frozen answer artifact. Malformed responses and validator failures fail closed.
The structured validator replaces candidate wording rather than accepting arbitrary
text merely because its numeric assertion matches an event.

The updated agent JSON response instruction exists in source but has not been deployed.
Direct `ASK_SAARTHI` and MCP output are not yet guarded. The Class A clock is now
SQL-supplied, but the refusal artifact still lacks the contract's named-practitioner
referral object. Document validation, revocation, concurrent session isolation, and
independent held-out answers still need runtime proof on this release.

The local strict SDK connection was blocked by OCSP validation of the workstation's
intercepting certificate. Certificate and OCSP checks remain enabled. A separate
metadata probe using default SDK settings is not proof that the strict web connection
works. Snowsight runtime evidence above is independent of that local SDK failure.

No portal form was submitted. The draft deck and hosting preparation are not a
published release or a verified judge-accessible deployment.
