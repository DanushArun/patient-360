# CoCo Lifecycle Evidence — What Judges Expect

**Researched 2026-09-16. Judges score CoCo usage explicitly across all 4 phases. This defines what to capture.**

> **Headline finding: The hackathon rules name 4 phases (Planning, Development, Execution, Testing) and 7 bonus categories. Judges look for evidence at EVERY stage. The most commonly forgotten deliverable across the competitor field is lifecycle evidence — most teams have CoCo evidence only for code generation, not for planning, testing, or execution. Capturing real session records including failures and fixes is what separates "used CoCo" from "generated code with CoCo."**

---

## 1. The 4 required phases (from hackathon rules)

### Planning
**What judges expect**: CoCo used to explore data, frame the problem, draft solution design, outline data model/ontology/workflow BEFORE any build.

**Evidence to capture**:
- Session ID where CoCo explored the synthetic source samples and identified ambiguities
- Session ID where CoCo drafted the schema / data model
- Session ID where CoCo profiled sample data
- Timestamps showing planning happened BEFORE development commits

**What NOT to do**: a single session where you asked CoCo to "plan the whole project" and copy-pasted the output. Judges see through this. Multiple focused planning sessions with specific questions read as genuine.

### Development
**What judges expect**: CoCo built the pipelines, semantic views, models, agents, and app code. Iterating in CLI/Desktop rather than hand-writing.

**Evidence to capture**:
- Session IDs where CoCo generated SQL DDL, pipeline code, Streamlit app code
- Reviewed diffs showing CoCo-generated code that was actually committed
- Session ID where CoCo explained a failing test before fixing it
- Git commits with CoCo co-authorship (the `Co-Authored-By: Cortex Code` trailer)

### Execution
**What judges expect**: CoCo deployed and ran the end-to-end solution, including scheduled/automated runs.

**Evidence to capture**:
- Session ID where CoCo deployed to the hackathon namespace
- Run manifest: query IDs, object states, source hashes from the ingestion run
- Session ID where CoCo ingested the late-addendum fixture and verified evidence version change
- If automation exists: the automation run log

### Testing/Validation
**What judges expect**: CoCo validated outputs, tested accuracy, handled errors/edge cases.

**Evidence to capture**:
- Session ID where CoCo ran the benchmark under allowed and denied roles
- Machine-readable test results (pass/fail counts, not just "it works")
- Session ID where CoCo found and fixed a bug (the failure + fix pair is more valuable than a clean run)
- Session ID where CoCo ran adversarial tests (cross-scope, injection)

---

## 2. The 7 bonus categories (from hackathon rules)

| Bonus | What to show | Priority for SAARTHI |
|---|---|---|
| **Reusable and shareable skills** | A custom CoCo skill other teams could reuse. Published, documented. | HIGH — `evidence-reconciliation` skill from plan.md §10 |
| **MCP connectors** | CoCo connected to external tools (Jira, Slack, etc.) | LOW — cut-list item |
| **Automations and scheduled runs** | CoCo automation running on schedule | MEDIUM — nightly evidence quality check |
| **Custom tools and function calling** | Agent tools that take real actions | HIGH — the 6 SQL procedures are custom tools |
| **Multi-agent orchestration** | Multiple agents/skills with handoffs | MEDIUM — if router + agent both exist |
| **Working across surfaces** | Same solution in CLI + Desktop + Snowsight | LOW — demo in one surface is enough |
| **Guardrails and graceful fallback** | Validation, error handling, confidence checks | HIGH — the answer validator IS this |

---

## 3. Evidence format

### What to store in `evidence/coco/`
For each phase, a manifest file:

```yaml
phase: planning
sessions:
  - id: "session-abc123"
    date: "2026-09-16"
    purpose: "Explore synthetic patient data, identify identity ambiguities"
    commit: "abc1234"
    input_hash: "sha256:..."
    key_finding: "Discovered platelet unit ambiguity in sample lab reports"
    screenshot: "planning-01-data-profile.png"  # optional
  - id: "session-def456"
    date: "2026-09-17"
    purpose: "Draft DDL for clinical tables with three-clock timestamps"
    commit: "def5678"
    output_files:
      - "sql/01_ddl.sql"
    key_finding: "R2 three-clock design validated against FHIR provenance model"
```

### What NOT to do
- A screenshot of CoCo open beside hand-written code — the rules explicitly call this out as not lifecycle evidence.
- A single long session transcript — curate, don't dump.
- Only code-generation evidence — the judges want to see planning and testing too.

---

## 4. The evidence index as a product surface

From the draft plan (§4 Judge Console): the CoCo evidence index should be a screen in the app, not just a directory in the repo. Per-phase session IDs, commits, run manifests, query IDs — including the failures and their fixes. A judge can click through the lifecycle without leaving the app.

This is what makes it a "Solution Completeness" scoring item rather than just a checkbox.

---

## 5. Practical capture strategy during build

1. **Start every CoCo session with a one-line purpose comment** — makes the manifest easy to build later.
2. **Save session IDs** — CoCo CLI shows session IDs. Record them.
3. **Commit after each meaningful CoCo-assisted change** — the git log IS the development evidence.
4. **Screenshot sparingly but strategically** — one per phase, showing CoCo doing something non-trivial (finding a bug, not generating boilerplate).
5. **Record at least one failure+fix pair** — this is the single most credible piece of evidence. A session where CoCo found a cross-scope leak and you fixed it together is worth more than ten sessions of clean code generation.
6. **Build the manifest YAML as you go, not at the end** — add entries to the file after each session.

---

## Sources

Hackathon rules (hack2skill.com/event/cococlihack-gccedition/) · Competitor analysis (planning/ps04-competitive-landscape.md) — noted that lifecycle evidence is the most commonly missing deliverable.
