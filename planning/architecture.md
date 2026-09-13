# Architecture — C4 model

Diagrams as code (Mermaid), versioned next to the system they describe. Renders natively in GitHub.
If a diagram and the code disagree, the diagram is a bug — fix it in the same PR.

Method: [C4 model](https://c4model.com) — Context → Container → Component. Level 4 (Code) is
intentionally omitted; it's the layer most prone to drift and least useful to a reviewer.

---

## Level 1 — System Context

Who uses it, what it talks to, and what it is *not*.

```mermaid
flowchart TB
    coordinator["<b>Care Coordinator</b><br/>primary user<br/>resolves gaps between cycles"]
    oncologist["<b>Oncologist</b><br/>pre-consult chart review<br/>2-5 min, before patient enters"]
    family["<b>Patient / Family</b><br/>role-scoped, read-only<br/>bring-list before travel"]

    sys["<b>Care Readiness &amp; Evidence Copilot</b><br/>─────────────<br/>Answers one question with resolvable evidence:<br/><i>is this patient ready for the next step of care —<br/>clinically, documentationally, financially —<br/>and exactly what is missing?</i><br/>Never a clinical decision. Never an opaque score."]

    emr[("<b>Hospital EMR</b><br/>ABDM-compliant,<br/>NCG-empanelled<br/><i>synthetic stand-in</i>")]
    claims[("<b>Claims / Authorisation</b><br/>NHCX · PM-JAY TMS<br/><i>synthetic stand-in</i>")]
    refdocs[("<b>Reference corpus</b><br/>PM-JAY manual · NABH<br/>DPDP · IRDAI · NCG<br/><i>real public documents</i>")]

    coordinator -->|"reviews queue,<br/>closes tasks"| sys
    oncologist -->|"asks record-state<br/>questions"| sys
    family -->|"receives reviewed<br/>bring-list"| sys

    sys -->|"reads encounters, labs,<br/>documents"| emr
    sys -->|"reads authorisation<br/>status + letters"| claims
    sys -->|"cites clauses,<br/>page-resolved"| refdocs

    classDef person fill:#EFF6FF,stroke:#2563EB,stroke-width:2px,color:#1F2937
    classDef system fill:#1F2937,stroke:#1F2937,color:#F8FAFC
    classDef ext fill:#F1F5F9,stroke:#64748B,stroke-dasharray:4 3,color:#1F2937
    class coordinator,oncologist,family person
    class sys system
    class emr,claims,refdocs ext
```

**Positioning:** this is an evidence and readiness *layer on top of* an ABDM-compliant EMR — not a
replacement EMR. Six oncology EMRs are already empanelled by NCG/KCDO under LEAP
(see `study-01-clinical-reading.md` §2.1).

---

## Level 2 — Containers

**Rendered version (authoritative): [`diagrams/architecture-container.drawio.png`](diagrams/architecture-container.drawio.png)**
Editable source: `diagrams/architecture-container.drawio` (open in draw.io). SVG also exported.
Both exports embed the diagram XML, so either file reopens as an editable diagram.

![Container architecture](diagrams/architecture-container.drawio.png)

Three things the rendered version makes explicit that the Mermaid below does not:
- **The reference corpus is a real ingestion path**, not a service that materialises from nowhere — real public PDFs land, are parsed, and are indexed separately (R6).
- **`AI_PARSE_DOCUMENT` is shared by both corpora; assertion extraction is patient-scope only.** Reference documents become searchable pages but never patient `ASSERTION`s.
- **R1–R6 are anchored to the band where each is enforced**, so the diagram shows where a rule lives in code rather than asserting it in prose.

The Mermaid below is kept as the diff-able structural source of truth — if the two disagree, that is a bug.

Everything inside the boundary runs in Snowflake. Arrows are data flow.

```mermaid
flowchart TB
    subgraph gen["Local (laptop)"]
        generator["<b>Synthetic generator</b><br/>Python, seeded<br/>fact ledger → rows + documents"]
    end

    subgraph sf["Snowflake"]
        stage[("<b>Stage + raw tables</b><br/>immutable, file-hashed")]
        parse["<b>Document parsing</b><br/>AI_PARSE_DOCUMENT<br/>LAYOUT, page_split"]
        extract["<b>Assertion extraction</b><br/>typed, char offsets,<br/>extractor_version"]
        curated[("<b>Curated model</b><br/>ENCOUNTER · CLINICAL_EVENT<br/>DOCUMENT · ASSERTION<br/>EVIDENCE_LINK")]
        rules["<b>Rule engine</b><br/>versioned SQL<br/>→ REVIEW_ISSUE · TASK"]
        searchP["<b>Cortex Search</b><br/><i>patient scope</i>"]
        searchR["<b>Cortex Search</b><br/><i>reference scope</i>"]
        semantic["<b>Semantic view</b><br/>Cortex Analyst<br/>cohort questions"]
        agent["<b>Cortex Agent</b><br/>6 restricted tools only"]
        validator["<b>Answer validator</b><br/>deterministic<br/>fails closed"]
        app["<b>Streamlit</b><br/>container runtime<br/>role-scoped"]
    end

    generator --> stage
    stage --> parse --> extract --> curated
    curated --> rules
    curated --> searchP
    curated --> semantic
    stage --> searchR

    agent --> searchP
    agent --> searchR
    agent --> semantic
    agent --> rules
    agent --> validator --> app
    app -->|"explicit user action,<br/>idempotency key"| rules

    classDef store fill:#F1F5F9,stroke:#64748B,color:#1F2937
    classDef proc fill:#EFF6FF,stroke:#2563EB,color:#1F2937
    classDef guard fill:#FFFBEB,stroke:#B45309,stroke-width:2px,color:#1F2937
    class stage,curated store
    class parse,extract,rules,searchP,searchR,semantic,agent,app proc
    class validator guard
```

**Two corpora never share a ranked list** (`plan.md` R6) — `searchP` and `searchR` are separate
services. "What does the patient's record say" and "what does the policy require" are different
questions with different evidence standards.

---

## Level 3 — The answer path, with enforcement points

The most important diagram in the repo. Amber = a guard that can refuse or strip.
This is where "never opaque predictions" stops being a claim and becomes control flow.

```mermaid
flowchart TB
    q["Question + role<br/>+ known_as_of"]
    bind["<b>1 · Bind scope</b><br/>server-side: tenant, patient,<br/>role, time cutoff"]
    classify{"<b>2 · Class?</b>"}
    refuse["<b>Refused</b><br/>routed to treating team<br/>+ evidence packet"]
    tools["<b>3 · Bounded tool calls</b><br/>agent may call 6 tools,<br/>each scope-filtered"]
    facts["<b>4 · Deterministic facts</b><br/>SQL + versioned rules<br/>produce every status/number"]
    phrase["<b>5 · Model phrases only</b><br/>using supplied facts<br/>+ evidence IDs"]
    validate{"<b>6 · Validate</b><br/>every claim → ≥1 evidence ID<br/>exists · in scope · right version<br/>· typed match"}
    strip["<b>Strip claim</b><br/>replace with explicit<br/>limitation, log removal"]
    render["<b>Render</b><br/>supported · partial · insufficient<br/>never a confidence %"]

    q --> bind --> classify
    classify -->|"A — clinical judgment"| refuse
    classify -->|"B — record state"| tools
    tools --> facts --> phrase --> validate
    validate -->|"unsupported"| strip --> render
    validate -->|"supported"| render

    classDef guard fill:#FFFBEB,stroke:#B45309,stroke-width:2px,color:#1F2937
    classDef stop fill:#FEF2F2,stroke:#B91C1C,stroke-width:2px,color:#1F2937
    classDef norm fill:#EFF6FF,stroke:#2563EB,color:#1F2937
    class bind,classify,validate guard
    class refuse,strip stop
    class q,tools,facts,phrase,render norm
```

**Read it as four invariants:**

| Step | Invariant | Plan ref |
|---|---|---|
| 1 | Scope is bound in a trusted backend, not by the model remembering a `WHERE` clause | R5 |
| 2 | Clinical-judgment questions are refused for **every** role, including clinicians | §1.2 |
| 4 | The model never produces a status, number, date or gate outcome — SQL does | R1 |
| 6 | An unsupported claim is removed, not softened. The validator fails closed | §6 |

The single failure mode this design exists to prevent: an answer that *looks* cited without *being*
cited (`plan.md` §6.5).

---

## Level 2.5 — Screen map

Which screen serves which stage of the department workflow (`oncology-department-map.md`).

```mermaid
flowchart LR
    s9["<b>Stage 9</b><br/>between-cycle"] --> q["<b>1 · Review queue</b><br/>open gates, owner, due date"]
    s3["<b>Stage 3</b><br/>pre-consult review"] --> p["<b>2 · Patient 360</b><br/>gate strip, then<br/>pathology→imaging→labs→history"]
    s4["<b>Stages 4 + 9</b><br/>mid-visit / chasing"] --> a["<b>3 · Ask + evidence</b><br/>cited answer,<br/>refuses Class A"]
    s9b["<b>Stage 9</b><br/>resolution"] --> r["<b>4 · Review + history</b><br/>auditable task closure"]
    s1["<b>Stage 1</b><br/>before travel"] --> f["<b>family role</b><br/>bring-list only"]

    classDef stage fill:#F1F5F9,stroke:#64748B,color:#1F2937
    classDef screen fill:#EFF6FF,stroke:#2563EB,color:#1F2937
    class s9,s3,s4,s9b,s1 stage
    class q,p,a,r,f screen
```

---

## Maintenance rule

Pin scope in `AGENTS.md`; validate Mermaid syntax in CI before it reaches the repo; keep each diagram
to 6–15 nodes and split rather than sprawl. A diagram that outgrows one screen has become two diagrams.
