# Brainstorm Decision Record — 2026-09-16

Team brainstorm session. 6 ideas evaluated against hackathon criteria (Technical 40%, Relevance 30%, Completeness 30%), Snowflake platform fit, competitor landscape, and build cost.

---

## Decisions

| # | Idea | Verdict | Becomes |
|---|---|---|---|
| 1 | Voice AI bot | **CUT** | Nothing. Pre-consult is a reading task, not a voice task. Snowflake has zero native voice. |
| 2 | Inter-department communication | **TRANSFORM** | "Request Consult" TASK action on Patient 360 — one button, tracked, auditable |
| 3 | Multi-hospital connectivity | **KEEP** | FACILITY_REGISTRY table + facility timeline on Patient 360 + discordance highlighting |
| 4 | Hospital-to-hospital record request | **KEEP** | "Request Record" TASK action, merged with #2 as a task type |
| 5 | Department-specific reading methodology | **KEEP** | Already designed (L7). Make explicit: same truth, specialist-specific drill-down order |
| 6 | Government schemes / NGO finder | **KEEP** | SCHEME_REGISTRY + eligibility SQL in coverage gate. **The emotional demo moment.** |

## New tables added to data model

```
FACILITY_REGISTRY    facility_id, name, city, state, type (hub/spoke/lab), abdm_registered
SCHEME_REGISTRY      scheme_id, name, type (govt/ngo/pharma), eligibility_criteria JSON,
                     coverage_scope, max_amount, application_process, application_url
SCHEME_ELIGIBILITY   patient_id, scheme_id, eligible (boolean), match_reason, checked_at
```

## New TASK types

```
TASK.type ∈ {
    documentation_review,     -- existing
    evidence_received,        -- existing  
    consult_request,          -- NEW: request specialist consultation
    record_request,           -- NEW: request missing record from another facility
    scheme_referral           -- NEW: refer patient to eligible scheme
}
```

## Build cost: ~14 hours total, zero new Snowflake services, zero external integrations

## The one idea that wins the room

Idea #6. When a judge sees the system not just identifying a coverage gap but showing the family a path forward — a specific scheme they might be eligible for, with application instructions, in their own language on the bring-list — that's the moment evaluation becomes advocacy. 84% catastrophic expenditure, 52.8% distress financing, and the system offers a concrete next step. No competitor touches this.
