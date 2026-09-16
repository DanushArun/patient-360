# DPDP Act 2023 + DPDP Rules 2025 — what binds us

**Researched 2026-09-16.** Relevant to R5, to `ANSWER_RUN`, and to the retention model.

> **Headline finding: our immutable audit trail is legally *required*, not merely a good idea.** And it must be built so that erasure can remove clinical content while the access record survives — which is a schema change.

---

## Commencement — we are in the gap period

Rules notified 14 Nov 2025, phased:

| Date | What comes into force |
|---|---|
| Now | Rules 1–2, 17–21 — Board constituted, complaints live |
| 13 Nov 2026 | Rule 4 — Consent Manager registration opens |
| **13 May 2027** | Rules 3, 5–16, 22–23 — notice, consent, rights, **Rule 6 security**, **Rule 7 breach**, Rule 8 retention. s.44(2) fires, repealing IT Act s.43A and the SPDI Rules |

**Consequence:** until May 2027 the **SPDI Rules 2011 still govern health data**, and those *do* classify "medical records and history, physical/mental health condition" as sensitive personal data with heightened duties. So a system built today sits under SPDI now and DPDP later. **Design for both** — and say so, because a judge who knows the law will ask which regime applies.

## Classification — health data loses its special tier, gains a stronger floor

DPDP abandons categories entirely (s.3): one uniform standard for all *digital* personal data. No sensitive-data tier. Sensitivity re-enters only indirectly, through s.10 Significant Data Fiduciary designation and Rule 6 safeguards "calibrated to risk."

## Duties that shape the build

- **Notice (s.5, Rule 3)** — standalone, plain language, **itemised** description of the data, specific purpose, plus links to withdraw consent, exercise rights, and complain to the Board.
- **Consent (s.6(1))** — free, specific, informed, unconditional, unambiguous, limited to what is *necessary* for the stated purpose.
- **Accuracy (s.8(3))** — a duty to ensure accuracy and completeness **where the data drives a decision affecting the principal.** This is the provision that bites on AI output.
- **Security (Rule 6)** — encryption / masking / tokenisation, access control, and **logs and monitoring for detection of unauthorised access, retained ≥1 year** (Rule 6(e)). Rule 8(3) independently requires ≥1 year of processing logs.
- **Breach (Rule 7)** — notify the Board *without delay*, detailed report within **72 hours**, and notify **every** affected principal. **No materiality threshold — every breach is notifiable.**
- **Retention (Rule 8(1) / Third Schedule)** — the fixed periods bind e-commerce, gaming and social media classes. **Not hospitals.** Clinical establishments fall back on purpose limitation plus sectoral law.

## Significant Data Fiduciary (s.10)

Triggered by volume **and sensitivity**, risk of harm, and use of emerging technologies. A national oncology platform processing health data at scale with LLMs is a strong candidate — though **no health SDF class has actually been notified yet.**

Extra obligations: India-based DPO answerable to the board (s.10(2)); independent data auditor; **Rule 13 — annual DPIA + audit**, significant observations reported to the Board; and **Rule 13(3), which requires due diligence that "algorithmic software" used to process personal data does not risk principals' rights.** Rule 13(4) allows specified data to be barred from export.

Rule 13(3) is the closest thing Indian law has to an AI-governance obligation, and it lands squarely on us.

## Erasure vs medical record retention — the tension resolves in our favour

s.12(3) qualifies erasure expressly: retain where *"necessary for the specified purpose or for compliance with any law."* The Clinical Establishments Act rules, NABH standards and IMC Regulations (3 years minimum, longer for medico-legal cases and minors) are such laws.

**So an erasure request over the clinical record can be lawfully refused.** DPDP instead imposes a retention *ceiling* once those sectoral periods lapse.

**The real exposure is derived artefacts** — embeddings, retrieval caches, chat transcripts, generated answers. None of these enjoy statutory retention cover. They are the things we must be able to delete.

## Children (s.9)

Verifiable parental consent; no tracking, behavioural monitoring or targeted advertising. **But Rule 12 + Fourth Schedule Part A exempt clinical establishments and healthcare professionals from s.9(1) and 9(3)** — strictly "to the extent necessary for provision of health services to the child." Paediatric oncology care is covered. Secondary research, analytics or model training is **not**.

## Automated decision-making — no GDPR Article 22 analogue

DPDP contains **no** right to human review, no explanation right, no profiling restriction. The only hooks are s.8(3) accuracy and Rule 13(3) algorithmic due diligence.

**This matters for positioning:** DPDP does not restrict AI-generated clinical answers as such. The constraints on clinical AI come from **NMC rules and medical negligence law**, not data protection law. Do not claim DPDP forbids what it does not.

## Penalties

₹250 cr (security failure) · ₹200 cr (breach notification) · ₹200 cr (children) · ₹150 cr (SDF duties) · up to ₹50 cr residual · ₹10,000 on the data principal. Ceilings are per instance and cumulable.

---

## Design implications — five of these change the build

**1. `ANSWER_RUN` is a compliance artefact, not just an audit nicety.** Rule 6(c)/(e) and Rule 8(3) *mandate* access logs with ≥1-year retention. Log who asked, what evidence was returned, and which model version answered. **Reframe this in the pitch: we are not over-engineering, we are meeting Rule 6(e).**

**2. SCHEMA CHANGE — separate the audit log from the clinical payload.** Erasure must be able to remove content while the access *record* survives. Therefore `ANSWER_RUN` stores **hashes, pointers and evidence IDs — never the retrieved text or the generated answer body.** If we store answer text inline, s.12(3) erasure and Rule 6(e) log retention collide and we cannot satisfy both. This must be right in the first migration.

**3. Two retention clocks.** Clinical record on the sectoral clock (CEA / NABH / IMC minimum, then delete). Derived artefacts — embeddings, RAG caches, transcripts, generated answers — on a short purpose-limited clock, because nothing in law compels keeping them. **This is a third clock concept alongside R2's three, and it is about deletion rather than knowledge.**

**4. Consent as an artefact enforced at query time, not just at ingest.** Purpose-coded, ABDM-compatible, withdrawable as easily as it was given, and **checked at retrieval**. Log consent state alongside each answer. A consent that was valid at ingest and revoked before the query must block the query.

**5. Build as if we are an SDF.** India-resident DPO, annual DPIA covering retrieval and generation, and a **Rule 13(3) model-risk register** — a living document recording what the model is used for, what it cannot do, and what we did to check it. That register is also an excellent judge-facing artefact.

**6. ABDM compliance is necessary but not sufficient.** ABDM's HIU/HIP/Consent Manager architecture prefigures DPDP's consent model but a Consent Manager under ABDM is **not automatically a DPDP Consent Manager** — Rule 4 registration only opens Nov 2026 and requires ₹2 crore net worth and Board registration. Do not conflate the two in the deck.

---

## Sources

[DPDP Rules 2025 timeline](https://protectcomply.com/blog/dpdp-rules-2025-timeline) · [SPDI vs DPDP](https://dpdpact.net/dpdp-vs-spdi-rules) · [Rule 6](https://www.dpdpa.com/dpdparules/rule6.html) · [Rule 8](https://www.dpdpa.com/dpdparules/rule8.html) · [Rule 13 (SDF)](https://www.dpdpa.com/dpdparules/rule13.html) · [Rule 4 Consent Manager](https://www.dpdpa.com/dpdparules/rule4.html) · [s.12 erasure](https://www.dpdpa.com/dpdpa2023/chapter-3/section12.html) · [s.10 SDF](https://www.dpdpa.com/dpdpa2023/chapter-2/section10.html) · [Schedule penalties](https://www.dpdpa.com/theschedule.html) · [children's-data carve-outs](https://www.storyboard18.com/digital/dpdp-rules-carve-out-key-exemptions-for-healthcare-providers-schools-and-childcare-services-processing-childrens-data-84208.htm) · [SFLC on SDFs](https://sflc.in/dpdp-rules-2025-significant-data-fiduciaries-and-data-transfers/)
