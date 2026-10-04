# Robustness review — 4 October 2026

Pulled `origin/main` with `git pull --ff-only`: `d5c5f8c` → `c09b12b`.
Existing local Snowflake account/PAT work and untracked procedures were preserved.
Changes remain unstaged and uncommitted. No SQL deployment or model call was performed.

## Failures and fixes

- Web configuration tests initially reported five failures. Retained PAT support
  and explicit account migration, restored the default account guard, pinned
  `SAARTHI_APP`, and rejected unsupported authentication and malformed paths.
- Session initialization swallowed all `USE SECONDARY ROLES NONE` errors. It now
  propagates unrelated errors and handles restricted-session error `003107` only
  with a subsequent SQL check of primary and secondary roles. Unsafe or
  unverifiable sessions are destroyed before application queries. Regression
  tests reproduced acceptance of unsafe sessions before the fix.
  [Snowflake documents the secondary-role JSON fields](https://docs.snowflake.com/en/sql-reference/functions/current_secondary_roles).
- Numeric document support links matched numbers without units. Creation now
  requires exact units; lab-source reads recheck patient identity, concept,
  value, units, verification, missingness, active document state and cutoff.
  Equivalent differently spelled units are conservatively withheld; this change
  adds no unit-conversion rule.
- Cross-document reconciliation matched generic assertion subjects across
  patients and overwrote missingness with `discordant_across_specimens`, which
  is outside the seven-state type. It now writes the existing EVIDENCE_LINK
  relation only for verified, present findings with the same patient/concept,
  matching units and distinct nonempty recorded accession IDs. Unknown accession
  identity produces no inferred relation. A synthetic relational test executes
  the source SELECT with SQLite and checks foreign patients, same/unknown
  accession, pending/conflicting findings and mismatched units. This is not
  Snowflake compilation or clinical validation.
- npm reported six high-severity production dependency entries, all in the
  `shadcn` build-tool chain. Moved the unchanged tool version to development
  dependencies; production audit now reports zero. The six development-tool
  advisories remain; no forced major downgrade was applied.
- Browser verification first failed due to sandbox port restrictions, then a
  missing Chromium binary, then absent test-only routes in the normal production
  build. Downloaded Chromium to `/tmp`, installed the existing synthetic fixture
  pages in an isolated source copy, and reran successfully. Documented the
  required fixture setup and ignored generated Playwright artifacts.
- System Python lacked project dependencies and could not collect the suite.
  The repository `.venv` ran the tests successfully.

## Final verification

| Check | Observed result |
|---|---|
| `.venv/bin/python -m pytest -q` | 305 passed, 14 skipped, 36 subtests passed |
| Optional adapter tests in existing `/tmp/patient360-pr14-testenv` | 11 passed, 8 subtests passed |
| `npm test` in `web` | 270 passed, zero failures |
| `node --test backend/extraction/*.test.mjs` | 5 passed |
| `check_gate.py --all --strict` | 26 passed, zero failures/skips |
| `npm run typecheck` | Passed |
| Production `npm run build` after dependency change | Passed |
| Playwright with isolated synthetic fixture build | 40 passed, zero failures |
| `npm audit --omit=dev --json` | Zero reported vulnerabilities |
| `git diff --check` | Passed |

## Remaining limits

The SQL edits have offline contract/relational checks only. Compile and execute
the changed procedures in the intended Snowflake account before deployment
claims, including negative tests for foreign patients, conflicting sources,
unit mismatch and unknown accession IDs. Existing incorrectly tagged rows or
relations are not repaired by this source patch; inspect them before any
targeted migration. Model availability, inference accuracy and the complete
document-to-cited-answer live path were not verified in this review.

Browser checks use controlled synthetic responses with Snowflake disabled.
They establish UI behavior, not database authorization or clinical validity.
The default Python environment skips optional trial tests; the adapter was
checked separately in its existing isolated environment. Six npm advisories
remain in development tooling. This review does not certify the whole system
as production-ready.
