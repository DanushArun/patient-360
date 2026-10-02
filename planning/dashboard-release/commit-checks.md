# Reviewed local commits — 2 October 2026

Branch: `codex/dashboard-workflow-gates`. No remote update performed.

| Commit | Reviewed scope |
| --- | --- |
| `0319e94` | Required gate IDs, evidence containment, parent review and acceptance |
| `cfa0023` | Reject duplicate JSON keys at every object depth |
| `9992596` | Bounded API input and typed recovery errors |
| `7b24fa6` | Confirm writes only after matching read-back |
| `bd4cb3d` | Generate Next route types before clean-checkout typecheck |

These are foundations for the pending dashboard integration. They do not establish
live workflow completion. UI, SQL and deployment integration remain uncommitted;
the SDK update is reviewed and committed.

## Verification

Exported committed source plus each intended staged patch into a temporary directory.
Unrelated working-tree files were excluded. Build/typecheck reused installed Node
dependencies through a temporary symlink; a fresh lockfile install was not performed.
The gate and new API/receipt tests use only Python/Node standard libraries.

- 18 release-record tests: [output](evidence/commit-gate-tests.txt).
- 66 web tests, including 17 API/receipt tests: [output](evidence/commit-web-tests.txt).
- Final staged snapshot: [typecheck](evidence/commit-typecheck.txt) and
  [production build](evidence/commit-build.txt) passed.
- Independent Luna reviews and parent diff review found no unresolved blocker in
  the committed slices. Live acceptance remains incomplete.

## Failures retained

1. External evidence paths passed a fabricated complete record. Absolute paths,
   traversal and external symlinks now fail. Six new tests first failed, then passed.
2. Missing/incomplete parent acceptance was ignored. Both regressions first failed,
   then passed after requiring `acceptance: accepted`.
3. Duplicate JSON keys hid pending state. Both regressions first failed, then passed
   after strict object parsing.
4. Clean typecheck lacked generated `PageProps`/`RouteContext`. The command now runs
   `next typegen` first; the isolated checkout passes without a prior build.

Live Snowflake execution, application credentials, two-patient isolation, and the
complete evidence-to-handoff journey are not proved by these checks.

## Later reviewed slices

- `8db0e38`: retain isolated foundation verification.
- `effa252`: missing or unknown readiness outcomes fail closed; isolated checks passed.
- `8a49a1d`: GET reads stored readiness; explicit POST recomputes. Actual route regression
  tests, 73 web tests, typecheck and build passed in the intended commit snapshot.
  [Read/refresh verification](evidence/read-refresh-commit-check.txt).
- `e4fd7ca`: pin Snowflake SDK 3.4.0 and TOML 5.0.0; every SDK client enables OCSP
  and fails closed on revocation checks. Fresh locked offline install, 74 web tests,
  typecheck and build passed in the intended commit snapshot.
  [SDK verification](evidence/sdk-commit-check.txt).

These commits do not prove live TLS, authentication, SQL deployment, or journey acceptance.
