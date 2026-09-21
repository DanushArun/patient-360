# Stubs — nothing in this directory ships

**Owner: Builder 1. Deleted at the Day-5 gate.**

This directory exists for one reason: `WORK-PLAN.md` says *"the other stream's component does not exist → build against the contract with a stub. **Never wait.**"* Builder 1's Days 2–5 carry the classifier, R7 extraction, four tool procedures, the agent and the validator, against a schema Builder 2 is creating in the same week. Waiting is the only way to miss the Day-5 gate.

## Rules

| Rule | Why |
|---|---|
| Stubs are created in a **`STUB` schema**, never in `OPERATIONAL` | so a leftover stub cannot shadow a real procedure by name |
| Stub procedures are **signature-identical** to `frontend/contracts/tool_signatures.yaml` | swapping in the real body changes nothing upstream |
| Stub bodies return **fixture rows**, and say so in their `COMMENT` | a stub that looks like real data is how a demo lies |
| `setup.sql` **never** references this directory | `backend/scripts/check_gate.py --stubs` fails the build if it does |
| The `STUB` schema **must not exist** after a clean-account deploy | verified at the Day-5 gate and again on Day 15 |

## The failure this prevents

> **Go / no-go: "Any answer is hard-coded."**

Nobody hard-codes an answer on purpose. It happens when a stub written on Day 3 to unblock the UI is still being called on Day 14, because everything downstream of it worked and nobody went back. By then it is invisible — the call path is real, the procedure name is real, the JSON shape is real, and only the rows are invented.

Two mechanisms close it: **a separate schema**, so the stub cannot silently take a real call; and **a gate check**, so its survival is a build failure rather than a discovery.

## What to stub, and what to build for real instead

| Blocked on | Stub it | Or better |
|---|---|---|
| `bind_patient`, `CARE_TEAM`, `CONSENT` rows | yes — a fixed binding for one session | ask Builder 2 for these on Day 2; they are their first governance deliverable |
| the two Cortex Search services | yes — `LIKE` scan over `DOC_PAGE` | the three-layer structure stays identical; only the retrieval line changes later |
| `evaluate_gates` | yes — return the four outcomes from `frontend/fixtures/answer_conflicting.json` | |
| `DOC_PAGE` rows for extraction | **no** | **build the ambiguous CBC page yourself on Day 2.** It is the R7 fixture and the demo asset; making it removes the dependency entirely rather than deferring it |
| `DT_HARMONIZED_EVENTS` | yes — a view over hand-inserted rows | keep the ANC derivation real even in the stub, so `derived` is exercised from day one |
