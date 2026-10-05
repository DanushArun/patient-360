#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${TASK_ROOT}"
TASK_PYTHON="${SAARTHI_PYTHON:-${TASK_ROOT}/.venv/bin/python}"
TASK_MODE="${1:-check}"
if [[ "${TASK_MODE}" == "install-pre-ai" ]]; then
  "${TASK_PYTHON}" -m backend.scripts.build_deploy_bundle --check
  "${TASK_PYTHON}" -m backend.scripts.install_clean_account --pre-ai
  echo 'PASS_PRE_AI: installation only; native execution and hosted health remain separate'
  exit 0
fi
TASK_FRONTEND="${SAARTHI_FRONTEND_HEALTH_URL:?Set SAARTHI_FRONTEND_HEALTH_URL}"
TASK_BACKEND="${SAARTHI_BACKEND_HEALTH_URL:?Set SAARTHI_BACKEND_HEALTH_URL}"
TASK_REVISION="${SAARTHI_RELEASE_REVISION:?Set SAARTHI_RELEASE_REVISION}"
if [[ "${TASK_MODE}" == "install-clean-account" ]]; then
  "${TASK_PYTHON}" -m backend.scripts.install_clean_account
elif [[ "${TASK_MODE}" != "check" ]]; then
  echo 'FAIL: mode must be check, install-clean-account or install-pre-ai' >&2
  exit 2
fi
"${TASK_PYTHON}" -m backend.scripts.build_deploy_bundle --check
"${TASK_PYTHON}" -m backend.scripts.release_preflight \
  --frontend-url "${TASK_FRONTEND}" --backend-url "${TASK_BACKEND}" \
  --release-revision "${TASK_REVISION}"
curl --fail --silent --show-error --max-time 20 "${TASK_FRONTEND}" >/dev/null
curl --fail --silent --show-error --max-time 20 "${TASK_BACKEND}" >/dev/null
echo 'PASS: platform, canonical dependency order, bundle and HTTP health checks'
