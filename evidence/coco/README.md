# CoCo Lifecycle Evidence — SAARTHI

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

| Phase | Manifest | Status |
|---|---|---|
| **Planning** | `planning.yaml` | Complete — 52 sessions, 16–17 Sept |
| **Development** | `development.yaml` | In progress |
| **Execution** | `execution.yaml` | Not started |
| **Testing & validation** | `testing.yaml` | Partial — platform verification done, see `verification-query-ids.md` |

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
