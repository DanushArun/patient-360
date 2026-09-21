#!/usr/bin/env bash
#
# SAARTHI - local deploy.
#
# Reads the ACTIVE (uncommented) EXECUTE IMMEDIATE FROM lines out of sql/setup.sql
# and runs each file in that order through the Snowflake CLI.
#
#   scripts/deploy.sh <connection>              deploy
#   scripts/deploy.sh <connection> --dry-run    print the plan, touch nothing
#   scripts/deploy.sh <connection> --from 14    resume from build step 14
#
# WHY THIS SCRIPT EXISTS AT ALL
#   EXECUTE IMMEDIATE FROM resolves relative paths against the calling file's
#   location ON A STAGE. Locally there is no stage, so the manifest cannot execute
#   itself. Rather than keep a second copy of the build order in a shell array -
#   which would drift the first time someone inserted a step - this parses the
#   order back out of setup.sql. One source of truth, two execution paths, and a
#   commented line is skipped identically by both.
#
# THE DEPLOY JUDGES REPRODUCE IS THE OTHER ONE
#       EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/main/sql/setup.sql;
#   Use that for the clean-account rehearsal on Day 15. This script is for the
#   inner loop, and a script that only works on a developer's machine is exactly
#   the failure the Day-15 rehearsal exists to catch.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP="${ROOT}/sql/setup.sql"

CONN="${1:-}"
DRY_RUN=0
FROM_STEP=0

if [[ -z "${CONN}" || "${CONN}" == -* ]]; then
  echo "usage: scripts/deploy.sh <connection> [--dry-run] [--from N]" >&2
  echo "  connection is a Snowflake CLI connection name (snow connection list)" >&2
  exit 2
fi
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --from)    FROM_STEP="${2:?--from needs a step number}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "${SETUP}" ]]; then
  echo "sql/setup.sql not found" >&2
  exit 1
fi

if [[ "${DRY_RUN}" -eq 0 ]] && ! command -v snow >/dev/null 2>&1; then
  echo "the Snowflake CLI ('snow') is not on PATH" >&2
  exit 1
fi

# Active lines only. A line starting with -- is skipped here exactly as Snowflake
# skips it, so the manifest records build ORDER and build PROGRESS in one place.
# Written without mapfile and without arrays: macOS ships bash 3.2, and a deploy
# script that only runs on a machine with a newer bash is the same class of bug as
# a deploy that only runs on an account with leftover state.
TARGETS="$(
  grep -E "^[[:space:]]*EXECUTE IMMEDIATE FROM[[:space:]]+'" "${SETUP}" \
    | sed -E "s/^[[:space:]]*EXECUTE IMMEDIATE FROM[[:space:]]+'([^']+)'.*/\1/" \
    || true
)"

if [[ -z "${TARGETS}" ]]; then
  echo "No active deploy steps in sql/setup.sql."
  echo "Uncomment each EXECUTE IMMEDIATE FROM line as its file lands and runs clean."
  exit 0
fi

COUNT="$(printf '%s\n' "${TARGETS}" | wc -l | tr -d ' ')"

echo "connection : ${CONN}"
echo "steps      : ${COUNT} active"
if [[ "${FROM_STEP}" -gt 0 ]]; then
  echo "resuming   : from step ${FROM_STEP}"
fi
echo

n=0
while IFS= read -r rel; do
  n=$((n + 1))
  file="${ROOT}/sql/${rel}"

  if [[ "${n}" -lt "${FROM_STEP}" ]]; then
    printf '  %2d  SKIP  %s\n' "${n}" "${rel}"
    continue
  fi

  if [[ ! -f "${file}" ]]; then
    printf '  %2d  MISS  %s\n' "${n}" "${rel}"
    echo >&2
    echo "setup.sql activates a file that does not exist: sql/${rel}" >&2
    echo "Either create it or re-comment its line. scripts/check_gate.py --manifest checks this." >&2
    exit 1
  fi

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '  %2d  plan  %s\n' "${n}" "${rel}"
    continue
  fi

  printf '  %2d  run   %s ... ' "${n}" "${rel}"
  if snow sql -c "${CONN}" -f "${file}" >/dev/null; then
    echo "ok"
  else
    echo "FAILED"
    echo >&2
    echo "Step ${n} failed: sql/${rel}" >&2
    echo "Fix it, then resume without repeating what already succeeded:" >&2
    echo "    scripts/deploy.sh ${CONN} --from ${n}" >&2
    exit 1
  fi
done <<EOF
${TARGETS}
EOF

echo
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "dry run - nothing executed"
else
  echo "deploy complete."
  echo "Idempotency is a requirement, not a nicety: run this again now and it must"
  echo "succeed unchanged. Then teardown.sql, then a third run. All three pass or"
  echo "the clean-account rehearsal on Day 15 will fail instead."
fi
