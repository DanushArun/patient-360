# Scale Review — Is SAARTHI's architecture good enough for a pan-India multi-facility system?

**Reviewed 2026-09-17. This is a second-order review: not "is the spec internally correct" (see SPEC-REVIEW.md, 21 issues) but "is the architecture the right shape for the system the problem statement describes."**

**Verdict: No. 15 structural gaps. 6 are fatal for the stated use case and 4 of those are also direct hackathon scoring losses.**

---

## The core diagnosis

SPEC.md models **a single hospital with a flat user→patient access list**.

PS-04 describes **siloed EHR + claims + dense unstructured documents**, across facilities, for both a *patient* and a *member*. The Indian reality we researched — 74% of patients cross ≥2 facilities, Dipali crossed 3 across 650 km, 7 identifiers, 0 ABHA — is a *multi-organization consent-mediated* problem.

Evidence the architecture is single-tenant in disguise:
- `PATIENT.tenant_id VARCHAR(50) NOT NULL DEFAULT 'SAARTHI-DEMO'` — one hardcoded tenant.
- `ROLE_PATIENT_MAP(user_name, patient_id)` — access is a flat enumerated list, not a derived care relationship.
- `ENCOUNTER.facility VARCHAR(100)` — facility is a **string**, not a foreign key to a registered entity.
- No organization, department, practitioner, care team, referral, or consent object exists anywhere in the spec.

Every one of the four competitors we profiled has exactly this shape. **This is where we are currently tied with them, not ahead.**

---

## FATAL — Breaks the stated use case AND loses hackathon points (6)

### F1. CONSENT does not exist anywhere in the architecture

This is the single largest omission in the entire design.

Our own research says so twice, explicitly:
- `abdm-architecture.md` §5: *"consent modeled as first-class entity... Consent state must be checked at query time, not just at ingest."*
- `law-dpdp.md` design implication #4: *"Consent as an artefact enforced at query time, not just at ingest. Purpose-coded, ABDM-compatible, withdrawable as easily as it was given, and checked at retrieval. A consent that was valid at ingest and revoked before the query must block the query."*

`plan.md` §5's data model does **not** list a CONSENT table (the research assumed it did). SPEC.md has no CONSENT table. There is no consent check in any of the 6 tool contracts.

**Why this is fatal for the use case**: ABDM's entire data-exchange architecture is HIP → Consent Manager → HIU. Data cannot lawfully move from CMC Vellore to TMH Jamshedpur without a purpose-bound, time-bound, revocable consent artifact. A centralised pan-India record store *without* consent enforcement is not a product — it is a DPDP s.6 violation with ₹250 cr exposure.

**Why this is fatal for the hackathon**: It is the most India-specific architectural object available to us, it is legally mandatory, it is demonstrable in 30 seconds (revoke consent → same question now returns nothing), and **not one of the four competitors has it**. We researched it and then failed to architect it.

Required:
```
CONSENT
──────
consent_id, patient_id, granted_to_facility_id, granted_by (patient|guardian),
purpose_code, data_categories[], date_range_from, date_range_to,
valid_from, valid_until, status (active|revoked|expired),
revoked_at, artifact_hash, abdm_consent_ref (nullable), created_at
```
Checked in **every** retrieval tool, not at ingest. Logged per `ANSWER_RUN`.

---

### F2. No organizational hierarchy — access control is architecturally wrong

`ROLE_PATIENT_MAP(user_name, patient_id)` cannot express how Indian healthcare is organized. The real access question is:

> Is this **practitioner**, at this **facility**, in this **department**, with an active **care relationship** to this patient, inside a valid **consent** window, for this **purpose**?

Six joins. The spec collapses them to one flat list.

**Consequences at scale**: 100K practitioners × ~1,000 patients each = 100M rows. The RAP in Appendix A runs `EXISTS (SELECT 1 FROM ROLE_PATIENT_MAP ...)` on **every row of every query**. Against 100M rows, on every patient-scoped table, this is a performance collapse. Access must be **derived from relationships**, not enumerated.

**Consequences for correctness**: When Dipali transfers CMC Vellore → TMH Jamshedpur, both facilities need access, at different levels, for different windows, under different consents. A flat map cannot express "TMH has access to the pathology from CMC for the purpose of continuing treatment, from 14 Oct 2024, until treatment completion."

Required: `ORGANIZATION`, `FACILITY` (with Health Facility Registry ID), `DEPARTMENT`, `PRACTITIONER` (with NMC registration number), `CARE_TEAM` (practitioner × patient × facility × role × active window). `CARE_TEAM` replaces `ROLE_PATIENT_MAP`.

This also **fixes C1** from SPEC-REVIEW: with a practitioner registry, identity comes from an authenticated practitioner record, not `CURRENT_USER()`.

---

### F3. No REFERRAL object — we omitted the product's central moment

The referral **is** the event the entire product exists to serve. It is the instant the record must travel and the instant it fails to. 74% of patients cross ≥2 facilities; 82.6% face a delay somewhere in that pathway.

`ENCOUNTER.facility` is a string. There is no object capturing: from_facility → to_facility, referring practitioner, reason, date, which documents were transferred, which were expected but never arrived, and under which consent.

**The "expected but never arrived" set is the bring-list.** Without a REFERRAL object, the bring-list has no principled derivation — it can only be inferred from gate failures, which is indirect and loses the "the spoke sent 4 documents, 3 arrived" story that judges will find vivid.

Required:
```
REFERRAL
────────
referral_id, patient_id, from_facility_id, to_facility_id,
referring_practitioner_id, reason, referral_date, consent_id,
documents_expected[], documents_received[], status
```

---

### F4. No integration / ingestion architecture — "siloed EHR" is unaddressed

The brief's first named challenge is **siloed EHR**. SPEC.md's answer is a single field: `DOCUMENT.ingestion_method`.

There is no specification of:
- What a source system is, or a registry of them
- The contract per ingestion method (FHIR bundle, HL7 v2, flat file, manual PDF, WhatsApp photo)
- The FHIR R4 resource → our table mapping — **which we already researched in full** (`abdm-architecture.md` §3 maps 10 resources to our tables) and then never wired into the architecture
- An ingestion audit record (what arrived, from where, how many records, what failed)

**Direct competitive loss**: CareCompass — assessed in our own field report as *"the most complete data-engineering effort in the field"* — has a working HL7 v2.x + FHIR R4 parsing pipeline across 10 source systems. On the dimension the brief names first, they are ahead of us and we have nothing specified.

Required: `SOURCE_SYSTEM` (endpoint, method, FHIR capability, facility_id), `INGESTION_RUN` (source, method, counts, hashes, errors, timing), and an explicit FHIR mapping table promoted from research into the spec.

---

### F5. "Member 360" is half-built — the family is the coverage unit, not the patient

The problem statement is *"Patient **and Member** 360."* Our architecture is entirely patient-centric.

**The concrete error**: PM-JAY is **₹5 lakh per family per year** — a family floater. `COVERAGE` is keyed on `patient_id`. There is no household or family concept. So:
- Remaining limit cannot be computed correctly (a sibling's admission consumes the same pool)
- `COV-LIMIT-001` ("annual limit not exhausted") is **wrong by construction** for every PM-JAY patient
- The member-side view — policy → member → claim history → utilization → other members — does not exist

`insurance-irdai-nhcx.md` §3 documents the family-floater model and §5.3 says *"support multiple active coverages per patient"* — but the rule engine has no notion of primary vs secondary payer or coordination of benefits.

Also missing, and explicitly recommended by our own research (`insurance-irdai-nhcx.md` §5.4): `AUTHORIZATION.status` should be `pending | approved | denied | partial | expired | conflicting`. SPEC has only four — **missing `partial` and `conflicting`** — and `conflicting` is the status our own flagship demo scenario (table says pending, letter says approved) requires.

Required: `HOUSEHOLD` + `HOUSEHOLD_MEMBER`, coverage keyed to household where the scheme is a floater, a member-centric view, and the corrected status enum.

---

### F6. No PRACTITIONER — the system cannot name who is accountable

Every Class A refusal says *"your treating team decides."* The system cannot name them.

`law-nmc-clinical-practice.md`: the RMP remains **solely accountable**. `law-medical-records.md`: missing records create an **adverse inference of negligence**. A medico-legal audit trail that cannot identify the registered practitioner accountable at each step does not meet the standard we are claiming as a differentiator.

Required: `PRACTITIONER(practitioner_id, name, nmc_registration_no, qualification, department_id, facility_id, active)`. Every `TASK.actor`, every `REVIEW_ISSUE` resolution, every `ANSWER_RUN.role` resolves to a real registered practitioner.

---

## STRUCTURAL — Breaks at scale or in real workflows (5)

### S1. Encounter rescheduling does not recompute gates

Rules evaluate "labs within 72h of `scheduled_time`." Reschedule 21 Oct → 28 Oct and previously-passing labs are now stale — with no recomputation trigger anywhere in the spec.

This is **not** an edge case: 14% of cycles are missed with a **median 13.75-day delay**. Rescheduling is the single most common event in the workflow the product serves. Needs a trigger on `ENCOUNTER.scheduled_time` change → re-evaluate all gates → open/close issues → notify.

### S2. Cortex Search cannot hold a pan-India corpus

Documented limits: **<400M rows per service, 20 QPS/service, 140 QPS/account, no cloning.** Two services (patient + reference) do not scale past a few hundred thousand patients. Requires a sharding strategy — per-region or per-organization services — with the routing logic in the retrieval tool. Note: no documented cap on services per account, which makes sharding viable but it must be *designed*.

### S3. `DT_READINESS_STATE` is unworkable at scale (compounds C2)

Already contradictory (a Dynamic Table cannot call the rule-engine procedure). At scale it is also infeasible: 13 rules × millions of patients on a 1-minute target lag. The recomputation must be **event-driven** (recompute on new evidence / reschedule for the affected patient only), not a full-table refresh.

### S4. No concurrency control on clinical review decisions

Two coordinators at two facilities acting on the same `REVIEW_ISSUE`. `TASK` has an idempotency key (good) but `REVIEW_ISSUE` has no version column and no optimistic locking. **Last-write-wins on a clinical documentation decision is not acceptable.**

### S5. No notification or escalation architecture

`REVIEW_ISSUE` rows are created and nobody is told. A care-coordination product's core loop is: blocker open 3 days pre-cycle → notify coordinator; 1 day → escalate to oncologist. Snowflake notification integrations make this cheap, and it maps directly to the hackathon's **custom tools / automations** bonus categories. Currently absent.

---

## COMPLIANCE — Researched, then not architected (4)

### K1. Two retention clocks — designed in research, absent from spec
`law-dpdp.md` #3 requires clinical records on the sectoral clock (CEA/NABH/IMC) and **derived artefacts** (embeddings, retrieval caches, transcripts, generated answers) on a short purpose-limited clock, *because nothing in law compels keeping them.* SPEC has `DATA_RETENTION_TIME_IN_DAYS = 90` on the database and nothing else. No derived-artifact registry, no purge job. `ANSWER_RUN` correctly stores pointers — but the deletion policy that makes that design *necessary* is unspecified.

### K2. Rule 6(e) security monitoring — no security event table
DPDP Rule 6(e) mandates logs for detecting unauthorised access, retained **≥1 year**; Rule 7 requires 72-hour breach notification with **no materiality threshold**. The validator's Check 2 "logs a security event" — to nothing. There is no `SECURITY_EVENT` table, no alerting, no 1-year retention guarantee. We flagged `ACCESS_HISTORY`'s 180-minute lag but never designed the compensating control.

### K3. Rule 13(3) model-risk register — a free judge-facing artifact we skipped
`law-dpdp.md`: Rule 13(3) requires due diligence that *"algorithmic software"* does not risk principals' rights, and our own research notes *"that register is also an excellent judge-facing artefact."* Not in the architecture.

### K4. Multilingual **input** is unhandled
`Cortex TRANSLATE` covers bring-list *output*. But a coordinator in Tamil Nadu types the query in Tamil, against English documents. Not specified, not tested. This is a genuine Indian requirement and a strong demo beat.

---

## What this means for the table count

| | Count |
|---|---|
| Tables actually specified in SPEC.md | 14 |
| Referenced but unspecified (C6: FACILITY_REGISTRY, SCHEME_REGISTRY, SCHEME_ELIGIBILITY, TREATMENT_PLAN, DOC_CHUNK) | 5 |
| **New, required by this review** | **12** |
| Realistic total | **~31** |

New: `ORGANIZATION`, `FACILITY`, `DEPARTMENT`, `PRACTITIONER`, `CARE_TEAM`, `CONSENT`, `REFERRAL`, `SOURCE_SYSTEM`, `INGESTION_RUN`, `HOUSEHOLD` (+`HOUSEHOLD_MEMBER`), `SECURITY_EVENT`, `DERIVED_ARTIFACT`.

`CARE_TEAM` **replaces** `ROLE_PATIENT_MAP`, which also resolves C1.

---

## Honest scoping — what must actually be built vs designed

We cannot build a pan-India system in the remaining window. But the architecture must be *shaped* for it, and the hard parts must be *proven*. Split:

**BUILD AND DEMO (highest scoring value per hour)**
1. **CONSENT with query-time enforcement.** Legally mandatory, zero competitors have it, demoable in 30 seconds: revoke consent → same question returns nothing. This is the strongest single addition available to us.
2. **ORGANIZATION / FACILITY / PRACTITIONER / CARE_TEAM.** Replaces the flat map, fixes C1, makes "which registered doctor is accountable" answerable.
3. **REFERRAL.** Gives the bring-list a principled derivation and supplies the vivid "spoke sent 4, 3 arrived" narrative.
4. **HOUSEHOLD + corrected `COV-LIMIT-001`.** Fixes a rule that is currently wrong for every PM-JAY patient, and delivers the "Member" half of the problem statement.
5. **`AUTHORIZATION.status` + `partial` + `conflicting`.** One-line fix; our flagship demo scenario depends on it.
6. **SECURITY_EVENT + notification.** Cheap, maps to bonus categories, closes Rule 6(e).

**BUILD THIN, DESIGN FULLY**
7. **Ingestion layer.** Implement one real FHIR bundle path end-to-end (using the mapping already in `abdm-architecture.md` §3) + `SOURCE_SYSTEM` / `INGESTION_RUN`. Document the other four methods. This neutralizes CareCompass's strongest axis.
8. **Reschedule recompute.** Trigger + event-driven gate re-evaluation for the affected patient.
9. **Concurrency.** Version column + optimistic locking on `REVIEW_ISSUE`.

**DESIGN AND DOCUMENT ONLY (state the limits honestly)**
10. Cortex Search sharding strategy for >400M chunks.
11. Event-driven readiness recomputation at population scale (replaces `DT_READINESS_STATE`).
12. Two retention clocks + `DERIVED_ARTIFACT` purge policy.
13. Rule 13(3) model-risk register (write it — it is a deliverable, not code).
14. Multilingual input: test Tamil/Hindi query against English corpus, report what works.

---

## The uncomfortable conclusion

Fixing all 21 issues in SPEC-REVIEW.md gets us a **correct single-hospital prototype**. That is roughly where Verity already is, with shipped code and a $7 reproducible run.

The 6 fatal gaps above are what separate "a good patient-360 demo" from "a system designed for the problem India actually has." Four of them — consent, organizational hierarchy, referral, member/household — are things **no competitor has**, are **directly implied by the problem statement**, and are **grounded in research we already did and then failed to carry into the architecture**.

That last point is the real finding of this review: the research is not the weak link. **The gap between our research and our architecture is.** Consent, the FHIR mapping, the family floater, the `conflicting` status, the retention clocks, the model-risk register — every one of these is already written down in `planning/research/`, with citations, and none of them made it into SPEC.md.
