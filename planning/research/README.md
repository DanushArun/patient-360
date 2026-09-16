# SAARTHI research index

Progressive research log. Started 2026-09-16. Build window closes **4 Oct 2026**.

**Status: 22/23 gaps closed. 1 blocked on live account access (empirical Cortex Search scoping test).**

---

## Research inventory — 19 files, 3,554 lines, 8 domains

### Indian Law (4 files)
| File | Lines | Headline |
|---|---|---|
| [law-dpdp.md](law-dpdp.md) | 84 | Audit trail legally required (Rule 6(e)). ANSWER_RUN must store pointers not content. |
| [law-nmc-clinical-practice.md](law-nmc-clinical-practice.md) | 108 | NMC guidelines don't mention AI. Class A/B split is the correct legal enforcement. |
| [law-cdsco-device.md](law-cdsco-device.md) | 453 | Not a medical device if scoped to record-state. CDSCO July 2026 guidance is new. |
| [law-medical-records.md](law-medical-records.md) | 394 | ANSWER_RUN medico-legal claim is real. Missing records = presumed negligent (adverse inference). |

### Indian Healthcare System (4 files)
| File | Lines | Headline |
|---|---|---|
| [abdm-architecture.md](abdm-architecture.md) | 133 | R4 correct but aspirational. 780M ABHAs mostly dormant. Must handle no-ABHA patients. |
| [insurance-irdai-nhcx.md](insurance-irdai-nhcx.md) | 120 | ₹30,000 cr repudiation is real. 60-70% of denials knowable before admission. |
| [pmjay-oncology.md](pmjay-oncology.md) | 117 | Package rate ₹50K/cycle doesn't cover trastuzumab. 30% denials = missing docs. |
| [lab-reporting-india.md](lab-reporting-india.md) | 152 | Platelet "1.5" ambiguous by 100,000x without unit. SGOT→AST mapping required. |

### Clinical (1 file)
| File | Lines | Headline |
|---|---|---|
| [clinical-thresholds.md](clinical-thresholds.md) | 427 | ANC ≥1500, platelets ≥100K, LVEF hold at drop ≥16%. System must calculate CrCl. HER2 IHC 2+ without FISH is NOT final. |

### Lived Experience (2 files)
| File | Lines | Headline |
|---|---|---|
| [lived-experience-patients.md](lived-experience-patients.md) | 144 | 14% missed cycles, 52.5% due to caretaker unavailable. Bring-list is the primary output. |
| [lived-experience-clinicians.md](lived-experience-clinicians.md) | 150 | Coordinator role exists but rare. Stage 9 has no human. 9-stage model validated. |

### Platform (3 files)
| File | Lines | Headline |
|---|---|---|
| [platform-constraints.md](platform-constraints.md) | 144 | Cortex Search ignores RAP. Enterprise-only governance. Cross-region needed day one. |
| [snowflake-implementation-patterns.md](snowflake-implementation-patterns.md) | 165 | Dynamic tables + semantic views + VQR = what judges expect. sf-hcls-solutions is the benchmark. |
| [streamlit-container-runtime.md](streamlit-container-runtime.md) | 158 | Container runtime runs as owner role. RAP must use CURRENT_USER() for viewer identity. |

### Implementation (2 files)
| File | Lines | Headline |
|---|---|---|
| [polarity-checking-implementation.md](polarity-checking-implementation.md) | 127 | AI_FILTER for polarity checking. 5-check validation pipeline. We beat Verity on checks 2,3,5. |
| [should-close-gaps.md](should-close-gaps.md) | 169 | Synthetic data best practices, Class A/B edge cases, FHIR prior art (R2 novel, R3 partially novel), VQR design. |

### Hackathon (2 files)
| File | Lines | Headline |
|---|---|---|
| [coco-lifecycle-evidence.md](coco-lifecycle-evidence.md) | 117 | 4 phases + 7 bonuses. Capture session IDs, failure+fix pairs. Evidence index as a product surface. |
| [reference-corpus-sources.md](reference-corpus-sources.md) | 66 | All regulatory docs are publicly downloadable. PM-JAY manual + trastuzumab label + NCG guidelines = Tier 1. |

---

## Design-changing findings (read before writing any code)

1. **Cortex Search ignores RAP** → R5 is three-layer defence (no direct access, server-injected filter, content re-fetch through governed tables)
2. **ANSWER_RUN stores pointers not content** → DPDP erasure + Rule 6(e) log retention collide otherwise
3. **Governance features are Enterprise-only** → need Standard fallback path
4. **India regions need `CORTEX_ENABLED_CROSS_REGION` day one** → no native AI_COMPLETE
5. **Class A/B split is legally grounded** in NMC RMP-accountability, not just design preference
6. **Not a medical device if scoped correctly** → CDSCO July 2026 guidance; keep Class A refusal airtight
7. **Platelet units are the highest-risk parsing trap** → "1.5" without unit is ambiguous by 100,000x
8. **Bring-list is the primary output for 85% of users** → not a secondary feature
9. **"Family illness" = missed cycles** → the caretaker who carries records couldn't travel. System IS the navigator
10. **₹30,000 cr in preventable denials** → coverage gate value proposition in one number
11. **R2 (known_as_of) is genuinely novel vs FHIR** → defensible novelty claim with citation
12. **R3 (typed missingness) partially novel vs FHIR DataAbsentReason** → `conflicting` and `unreadable` go beyond FHIR
13. **Streamlit runs as owner role** → RAP must use CURRENT_USER() not CURRENT_ROLE()
14. **AI steps cannot be inside dynamic tables** → pipeline is task-driven for AI, DT-driven for deterministic steps
15. **AI_FILTER works for polarity checking** → 5-check validation pipeline, beats Verity on 3 of 5 checks

---

## Single remaining blocker

- [ ] **Empirical test: immutable session attribute vs Cortex Search tool inside an agent.** Cannot close without the live Snowflake account. This test decides the final R5 implementation. Run on day one of account access.
