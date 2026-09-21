# `backend/sql/` — every Snowflake object

**Build order is diagram 5b in `ARCHITECTURE-DIAGRAMS.md`, encoded in `setup.sql`. Read that file first; it is the map.**

## Directory → build step

| Directory | Steps | Owner | Notes |
|---|---|---|---|
| `account/` | 1–5 | Builder 2 | param · warehouse · database + 7 schemas · 5 roles · 3 stages |
| `tables/` | 6 | Builder 2 | one file per schema, numbered by dependency |
| `governance/` | 7–9 | Builder 2 | policies · attach · grants — **all three are red steps** |
| `data/` | 10–12 | Builder 2 | ontology · units · 16 rules · synthetic load |
| `streams/` | 13 | Builder 2 | |
| `procedures/` | 14 | **split** | `tools/` and the two enforcement procedures are Builder 1; `bind_patient` and `evaluate_gates` are Builder 2 |
| `dynamic_tables/` | 15 | Builder 2 | **no AI functions inside a DT** |
| `tasks/` | 16 | **split** | `extract_assertions`, `reconcile_evidence`, `orchestrator` are Builder 1 |
| `search/` | 17 | Builder 2 | two physically separate services |
| `semantic/` | 18 | Builder 2 | semantic view + 6 verified queries |
| `agent/` | 19 | Builder 1 | agent + MCP server |
| `integrations/` | 20–21 | Builder 2 | notifications · Streamlit · Git repository |
| `prompts/` | — | Builder 1 | not deployed. Reviewed source for the string literals in `tasks/` |
| `probes/` | — | Builder 1 | not deployed. Platform verification whose output is **evidence**. `model_availability.sql` runs Day 1, before any extraction work |
| `stubs/` | — | Builder 1 | **never referenced by `setup.sql`. Deleted at the Day-5 gate.** |

## Conventions

**File names** are `NN_snake_case.sql`. The number orders files *within* a directory; it is not a global sequence.

**Object names** are `UPPER_SNAKE`. The specifications write procedure names in lower case (`get_patient_facts`); they are created as `UPPER_SNAKE` and the agent's `tool_resources` identifiers must match the created names **exactly**, or the agent fails at run time with an unhelpful message.

**Idempotency is not optional.** `setup.sql` must survive: fresh account → run → run again → `teardown.sql` → run again. Use `CREATE OR REPLACE` for procedures, tasks, dynamic tables, views, agents and the MCP server; `CREATE … IF NOT EXISTS` for tables, stages, roles and warehouses; `MERGE` for seed data, never a bare `INSERT`.

**`setup.sql` holds no DDL** and no line in it does anything except `EXECUTE IMMEDIATE FROM`. Adding a statement there is how two builders start conflicting on one file.

## The five facts that will bite you

Each was established empirically, each cost real time, and each fails somewhere other than where the mistake is. Query IDs are in `evidence/coco/verification-query-ids.md`.

**1 — `CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION'` is line one.** `GCP_ME_CENTRAL2` has no local `AI_COMPLETE`. Without it nothing in the AI path runs, and the error arrives from whichever AI call happens first.

**2 — All three stages must be `SNOWFLAKE_SSE`.** AI functions cannot read `SNOWFLAKE_FULL`, user stages (`@~`) or table stages (`@%tbl`). Wrong encryption fails at **parse time, not create time** — days later, in a different file.

**3 — The row access policy keys on `CURRENT_USER()`, never `CURRENT_ROLE()`.** Inside an `EXECUTE AS OWNER` procedure `CURRENT_ROLE()` becomes the *owner's* role. A role-keyed policy returns every patient and **looks perfect in single-user testing, because the owner is the caller.**

**4 — `DOC_CHUNK` carries no row access policy.** `CREATE CORTEX SEARCH SERVICE` fails with *"Change tracking is not supported on queries with correlated subquery expressions"* over a RAP-protected table. So the index holds no content and returns IDs, and the content sits behind the policy. The platform forced the correct security architecture; do not undo it.

**5 — Every session runs `USE SECONDARY ROLES NONE`.** Otherwise *"the app role has no `USAGE` on the search service"* is a false statement — a secondary `ACCOUNTADMIN` satisfies the check through a back door while the `GRANT` audit still looks correct.

## Deploying

```sh
# local, during development — runs each uncommented manifest line in order
backend/scripts/deploy.sh <connection-name>

# from the repository stage — the path judges reproduce
EXECUTE IMMEDIATE FROM @SAARTHI_REPO/branches/main/backend/sql/setup.sql;
```

Both read the same manifest and skip the same commented lines, so build order and build progress have one source.

**Before the Day-5 gate and again on Day 15:**

```sh
backend/scripts/check_gate.py --all
```
