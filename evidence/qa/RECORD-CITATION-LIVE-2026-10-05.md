# SQL record citation validation — 5 October 2026

Account: KGTPGHJ-YJ28449 / NY64016. Synthetic records only. Snowsight execution,
not a connector test. These receipts do not establish native agent quality or p95 latency.

| Operation | Actual query ID | Result |
|---|---|---|
| Pin worksheet session to UTC | 01c78339-0004-0d3e-0001-fe5a0016f122 | Success |
| Compile internal record adapter | 01c78339-0004-0e08-0001-fe5a0016ca76 | Success |
| Authorized / foreign / financial-consent helper controls | 01c7833a-0004-0d3e-0001-fe5a0016f14a | PASS |
| Initial guarded validator migration | 01c78359-0004-0e08-0001-fe5a0016cbba | FAIL; exact anchor absent, no mutation |
| Corrected quoted-DDL migration | 01c7835b-0004-0e08-0001-fe5a0016cbd2 | PASS |
| Restricted-role main-validator positive and negative controls | 01c7835f-0004-0e08-0001-fe5a0016cc2e | PASS |

The initial migration expected an unescaped SQL body. GET_DDL returned a single-quoted
body with doubled internal quotes. The guard rejected that mismatch before executing
DDL. Correcting the anchor and replacement quoting produced a successful compile.
Migrated DDL SHA-256: b8f83348b8a58acfb96e359f419b8f6daa4184188749be9b021032f4207a3767.

The main probe ran as SAARTHI_APP, secondary roles empty, session 561137478265082.
It bound PAT-DC-04 and submitted the candidate prose “Safe to proceed with chemotherapy”
citing the real COV-DC-04 row. The validator returned one canonical SQL quotation:
PM-JAY; annual_limit 500000; used_amount 120000; family-floater true;
effective_from 2025-09-26; effective_to 2027-09-26. The candidate medical conclusion
was absent. This is an internal validator test, not authorization to answer Class A.

The probe then bound PAT-DC-07 and submitted the same actual COV-DC-04 pointer.
It returned zero claims and a generic omission limitation. Finally it restored PAT-DC-04.
Known as of: 2026-10-04T21:51:44 UTC. The complete multi-call probe took 9.7 seconds;
that is one execution duration, not a latency percentile or an isolated answer timing.

Missing source_recorded_at and ingested_at fields on coverage remain not_received.
The adapter does not invent original source clocks. Financial-consent false is rejected.
Database Time Travel uses a TIMESTAMP_TZ cutoff with an explicit UTC offset.

Earlier persisted TIMESTAMP_NTZ receipts were created under the account's prior session
timezone. They remain legacy local-clock receipts; the UTC pin does not retroactively
convert or relabel them. Audit their session context before comparing historical clocks.

Only the record branch was migrated into the existing live validator. The reference
adapter integration, updated fact tool and saved-pointer additions remain source changes
requiring deployment and runtime proof. No complete source/deployed parity is claimed.
