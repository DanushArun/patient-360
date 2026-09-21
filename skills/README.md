# Skills — 4 files, stage-mounted, orchestrated by a Task

**The headline bonus.** The brief calls reusable skills *"the headline bonus"*; the explainer asks for one skill per process plus *"a task on top which orchestrates between the three of them."* Four skills plus `TASK_SAARTHI_ORCHESTRATOR` satisfies **reusable skills** and **multi-agent orchestration** in one move.

Scheduled for Days 11–12. The scaffolding is here now because the wiring has three documented gotchas and each one is silent.

## The three gotchas

**1 — The agent references the FOLDER, not the file.**
```yaml
skills:
  - name: clinical-question-routing
    source: {type: STAGE, path: '@SAARTHI.STAGES.SKILLS/clinical-question-routing'}
```
No `/SKILL.md` on the end. The path names a directory that contains one.

**2 — Agents ignore an `instructions:` key in frontmatter.** Frontmatter carries `name` and `description` only. Execution instructions go in the **markdown body**. A skill whose instructions sit in frontmatter loads, runs, and does nothing anyone asked for — the most silent failure in the set.

**3 — Upload via `COPY INTO`, never a local `PUT`.**
```sql
COPY INTO @SAARTHI.STAGES.SKILLS/clinical-question-routing/SKILL.md
FROM (SELECT $$<the markdown>$$)
FILE_FORMAT = (TYPE = CSV, COMPRESSION = NONE,
               RECORD_DELIMITER = NONE, FIELD_DELIMITER = NONE)
SINGLE = TRUE OVERWRITE = TRUE;
```
This is the documented way to write markdown to a stage from SQL alone. It matters because **deployment stays reproducible from `setup.sql`** — a judge on a clean account can redeploy the skills without having the repository checked out locally. A `PUT` would break that, and the break would only appear during the Day-15 rehearsal.

`upload_skills.sql` holds one `COPY INTO` per skill and is activated at step 19 of the manifest, **before** the agent is created.

## The four skills

| Skill | Wraps | Called |
|---|---|---|
| `clinical-question-routing` | the Class A/B cascade in `classify_question` | every turn |
| `evidence-retrieval` | dual-corpus search, governed re-fetch, citation assembly | every turn |
| `risk-stratification` | the 5 gates, 4 outcomes, rule versioning | readiness questions |
| `evidence-reconciliation` | assertion matching, discordance, supersession | conflict questions |

A skill **describes how to use the tools**; it never contains its own scope logic. Scope lives in the procedures, behind `EXECUTE AS OWNER`, where the agent cannot reach it. A skill that re-derived a patient filter would reintroduce A1 through a file on a stage.

## Reuse proof — the half that gets skipped, and the half that scores

`reuse-tests/` runs each skill against a **second synthetic schema with different column names**. Required evidence per skill:

1. **one successful mapping** — the skill works against columns it has never seen
2. **one ambiguity it correctly refuses to resolve**

**The refusal is the stronger demo.** A skill that maps everything confidently has not been tested; it has been demonstrated. Two columns that could plausibly both be "the result value" is exactly the situation where guessing produces a clinically wrong answer with a perfect citation, and the correct behaviour is to say so.
