# Versioned rule citation boundary — 5 October 2026

Account NY64016, synthetic patients only. These are actual browser worksheet SQL results.
The native AI model was not invoked. Application probe used SAARTHI_APP with secondary
roles disabled and session 561137478265082 bound to PAT-DC-04.

| Execution | Query ID | Observed result |
|---|---|---|
| Compile internal rule adapter | 01c7839c-0004-0e08-0001-fe5a0017015a | Created |
| Direct helper positive/foreign/unknown-version probes | 01c7839f-0004-0d3e-0001-fe5a0016f70e | PASS |
| Guarded dispatch migration, newline anchor absent | 01c783a3-0004-0d3e-0001-fe5a0016f89e | Rejected before mutation |
| Corrected dispatch migration | 01c783a5-0004-0d3e-0001-fe5a0016f8c2 | PASS |
| Main validator rule metadata migration | 01c783b0-0004-0d3e-0001-fe5a0016f936 | PASS |
| Main validator application-role probes | 01c783b0-0004-0e08-0001-fe5a001702aa | PASS |
| Finalizer patch, malformed SQL quoting | 01c783b2-0004-0e08-0001-fe5a00170496 | Compilation failed before mutation |
| Corrected finalizer metadata patch | 01c783b3-0004-0d3e-0001-fe5a0016f9a6 | PASS |
| Readiness citation/category filter patch | 01c783b4-0004-0e08-0001-fe5a001704be | PASS |
| Initial tool/finalizer probe, unbound SQL variable | 01c783b5-0004-0e08-0001-fe5a001704fe | Failed; no finalizer proof |
| Public readiness-to-validator loop | 01c783b7-0004-0d3e-0001-fe5a0016fa46 | PASS under SAARTHI_APP |

The candidate “Safe to proceed with chemotherapy” cited
RULE--ENC-DC-04--CLIN-PLT-001--1. The main validator replaced it with:

> SQL record check CLIN-PLT-001 version 1: fail. This is not treatment clearance.

Exactly one claim survived. Its rule version was 1, its source was EVT-DC-04-PLT,
and known_as_of was 2026-10-04T23:12:55 in the UTC-configured session. The packet
retained the catalog provenance note explaining the unmodelled regimen-specific override.
Rule source clocks were explicitly not_received; no invented clinical clock was supplied.

The same session's ENC-DC-07 pointer returned zero claims. Rule version 9999 returned
zero claims. Both responses retained known_as_of and generic omission limitations.
Their empty rule_versions objects did not inherit the authorized claim's version.

Main validator DDL SHA-256:
3747ec10da055bea37b92a661b83b9b8bfa514105349b06ad71dbc2b27b9128a.
Dispatch DDL SHA-256:
e367226dd887c1819e7e3f227c331934fe4b58dd0d09112d928c518fbf6c7d25.

The main probe took 23 seconds across three validator calls; the helper probe took
17 seconds across three calls. Neither is a single-answer p95 measurement.
The public tool loop returned the exact citation ID and canonical fail outcome at
2026-10-04T23:19:14. Its two procedure calls took 15 seconds together, not a p95 sample.
Finalizer metadata compiled; its runtime has not been exercised with a rule candidate.
An attempted privileged probe retry was rejected by automatic approval review because it
would bypass the application-role boundary. It was not executed and has no query ID.
The replacement stayed within public application-role APIs and passed.
Hosted UI, full source deployment parity and new-ingest AI execution remain separate work.
