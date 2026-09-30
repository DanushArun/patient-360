# Workspace Reconciliation Implementation Plan

> **For agentic workers:** Execute this plan inline; use a separate reviewer for the plan and final code. User has authorised precise cleanup, staging and commits. Do not push, merge, rebase, reset, tag, or remove other worktrees.

**Goal:** Leave a reviewed, tested and committed dashboard baseline while preserving valuable branch work and removing confirmed scratch outputs.

**Architecture:** Keep Snowflake SQL as the source of patient scope, classification and facts. Integrate the merged main snapshot using file patches, preserve the complete optional Ollama provider, and port compatible unmerged safety work without introducing tables or rules absent from SPEC.

**Tech Stack:** Next.js 16, React 19, Node test runner, Snowflake SQL/Python, Streamlit, pytest.

## Tasks

- [x] Back up dirty tracked files, untracked files and retained stash into `/private/tmp`.
- [x] Review plan and compatible backend/session changes against SPEC.
- [x] Integrate September 28 merged files, preserve local gate/evidence UI hunks and complete local adapter dependencies.
- [x] Review guarded answer/reconciliation/scheduling work; preserve the committed backend branch pending correction of reproduced defects and rule/table expansion outside SPEC.
- [x] Reconcile compatible config and scope safeguards with merged census, Navigator and Judge routes; preserve per-professional authentication/owner-read branches for focused integration and live verification.
- [x] Reproduce classifier/YAML/probe/Streamlit issues with focused checks before fixes; remove duplicate default-provider routing while preserving SQL classification of local inference.
- [x] Remove `.superpowers` scratch outputs, speculative Streamlit wrapper hunks and confirmed superseded pages; retain historical evidence, other worktrees and stash.
- [x] Update setup and status documentation with exact commands and limitations.
- [x] Run pytest, node adapter/security/dashboard checks, build gate, TypeScript, production build and synthetic local browser smoke.
- [x] Independent review, resolve significant findings, rerun affected checks and create logical commits with explicit paths.
- [x] Account for all remaining files in the final documentation/cleanup commit; record live-account verification requirements in the baseline and verify clean status at handoff.

## Preservation rules

The audit at `docs/WORKSPACE-RECONCILIATION-2026-09-30.md` is the inventory. Remote snapshot `9093efaa` is a comparison source, not a directory replacement instruction. Backend-completion expands to 30 rules and a new regimen table: do not silently activate those under the existing 16-rule SPEC. Their complete tested implementation already remains committed at `4e95f4a` on `danush/backend-completion`.

## Verification

Use `.venv/bin/python`, not system Python. Run meaningful existing tests for imported code and focused regressions for changes. Mock and source checks must be labelled as such. Live Snowflake SQL execution, role access and clinical validation cannot be inferred from local checks.
