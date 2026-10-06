# CoCo Lifecycle Evidence — Saarthi

**Required by the hackathon rules:** *"All hackathon solutions must use CoCo (CLI, Desktop app) across the full lifecycle, from planning through development to execution and testing. Teams should be able to show CoCo in each phase below, and judges will look for evidence of it at every stage."*

This directory is the audit trail. Everything in it is machine-verifiable — session IDs are resolvable with `cortex conversations transcript <id>`, query IDs are resolvable in `SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY`, and commits are in the repository history.

---

## How to verify any claim in here

| Artefact | How to check it |
|---|---|
| A CoCo session | `cortex conversations transcript <session_id>` |
| The full session list | `evidence/coco/sessions-raw.csv` — raw export, unedited |
| A Snowflake query | `SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY WHERE QUERY_ID = '<qid>'` |
| A commit | `git show <sha>` |
| A research finding | the cited file in `planning/research/` — every file names its sources |

---

## Phase status

Manifest status is copied from each file's own `status:` field (checked 4 Oct 2026). "In progress" is what the manifests say; this README does not upgrade it.

| Phase | Manifest (lines) | Manifest `status:` | Scope |
|---|---|---|---|
| **Planning** | `planning.yaml` (381) | complete | 52 sessions, 16-17 Sept |
| **Development** | `development.yaml` (144) | in_progress | Daksha's JN89282 deploy and extensions (22 Sept), Danush's Days 1-5 scaffolding (18-20 Sept) |
| **Execution** | `execution.yaml` (221) | in_progress | Vertical slice on JN89282 (22 Sept); 6 failure/fix pairs recorded |
| **Testing & validation** | `testing_validation.yaml` (437) | in_progress | Platform verification, see `verification-query-ids.md`; failure/fix stage 5 in the manifest |

Also in this directory: `sessions-raw.csv` (raw export), `verification-query-ids.md`, `robustness-review-2026-10-04.md`, `snowflake-new-account-rca.md`.

**6 Oct 2026 update.** `sessions-2026-10-06.md` lists the CoCo sessions that ran the first full `setup.sql` deploy on a clean
account (XG46956): 1 main session, 3 subagents and 1 headless attempt, with 3 failure-and-fix pairs and read-only verification counts.

**Provenance caveat.** Work after 22 Sept on the OS69400 account (rounds 1-6 of the QA/fix cycle, the deploy bundle, the web app) was done with
other coding agents and by hand unless a session id above says otherwise. It is **not** CoCo lifecycle evidence and must not be presented as such.
Session ids in the manifests have not been re-resolved with `cortex conversations transcript` since they were written (gap 20, `IMPLEMENTATION-STATUS.md`).

---

## What we deliberately did *not* do

`planning/research/hackathon/coco-lifecycle-evidence.md` records what judges treat as weak evidence. We avoided each:

- **No single "plan my whole project" session.** Planning ran as **26 focused research sessions**, each with one specific question — `Research chemo readiness thresholds`, `Research NMC telemedicine AI rules`, `Research Indian medical records law`. The session titles in `sessions-raw.csv` are the questions themselves.
- **No screenshot of CoCo beside hand-written code.** The rules call that out explicitly as not being lifecycle evidence.
- **No curated-only successes.** Failures are recorded, including four consecutive wrong attempts at `AI_FILTER` syntax and a security assumption that testing proved false.

---

## The most valuable single item

`verification-query-ids.md` records an empirical test that **disproved one of our own architectural claims**.

We had designed the security model on the assumption that "the application role has no `USAGE` on the search service" was sufficient. Testing showed the query **succeeded anyway** — because secondary roles were active and a secondary `ACCOUNTADMIN` satisfied the privilege check through the back door. The fix (`USE SECONDARY ROLES NONE`, or a dedicated service user) is now a hard requirement in the architecture.

That is a failure-and-fix pair on the exact property the system claims as its differentiator, found before any application code was written. `coco-lifecycle-evidence.md` §5.5 identifies this kind of pair as *"the single most credible piece of evidence"* available.
