# Consent category isolation — 5 October 2026

Actual SQL worksheet results on NY64016, synthetic PAT-DC-04 only. The probe read through
SAARTHI_APP with secondary roles disabled. Administrative operations only migrated code or
temporarily narrowed/restored the synthetic consent; they were not privileged read probes.

| Step | Query ID | Observed result |
|---|---|---|
| ROW/main validator category migration | 01c783bc-0004-0d3e-0001-fe5a0016fbd6 | PASS |
| First multi-procedure patch, stale search anchor | 01c783bf-0004-0d3e-0001-fe5a0016fc0e | Stopped before mutation |
| Corrected fact/search/validator migration | 01c783c2-0004-0d3e-0001-fe5a0016fc42 | PASS |
| Financial-only synthetic consent readback | 01c783c3-0004-0d3e-0001-fe5a0016fc8a | CON-DC-04: financial only |
| Application-role category probes | 01c783c4-0004-0e08-0001-fe5a0017069a | PASS |
| Exact original-category restoration equality | 01c783c5-0004-0d3e-0001-fe5a0016fcaa | PASS |
| Restored clinical positive control | 01c783c5-0004-0e08-0001-fe5a001707fe | Nonempty lab facts |

At known_as_of 2026-10-04T23:32:08, financial-only consent produced:

- Labs and demographics: consent_not_valid, no facts.
- Coverage: one PM-JAY record, annual limit 500000 and recorded used amount 120000.
- PLT event and ROW-PATIENT candidate: zero accepted claims, empty rule_versions.
- Readiness: exactly two coverage gates; zero non-coverage gates.

Original categories clinical, identity and financial were restored exactly. The restoration
query's equality check passed; subsequent clinical access returned the original lab records.
This is not an in-flight cancellation or ten-connection isolation proof.

The stale live search implementation returned only page text/chunk IDs. Its migration now
adds verified assertion pointers and filters source pages by patient, active state, cutoff,
and document category. Search compilation succeeded; live Search-result acceptance remains
separate from the category probe above. Unknown document types follow the existing clinical
default; mixed-category documents and other web/timeline routes still require audit.

Final migration hashes:

- Validator: 6d8c493af27cac08697f2e277cde73ba0d893cf28593218c8baeaa601c19ab6b
- Fact tool: 6c1c8e159099c839293cccc11c75ffaa6db45dff1f6b6bc8b3865a9ef2078726
- Search tool: 0b33d397449992570b036eb3081ed821b6a2237e38867d2d0ae2d8f2313ca0b5


## Later tool compilation and chronology proof

Timeline and full guarded change-tool compilation:
01c783d8-0004-0d3e-0001-fe5a0016fdaa (PASS).
Change-tool runtime: 01c783d9-0004-0e08-0001-fe5a00170956 (PASS), 12 events,
all three clocks, omitted end cutoff freezes to SQL known_as_of, invalid/reversed dates deny.
This does not prove the new timeline/category-negative branches at runtime.
Canonical fact tool compilation: 01c783db-0004-0e08-0001-fe5a001709a2 (PASS).
Its final runtime probe: 01c783de-0004-0e08-0001-fe5a001709de (BLOCKED),
approved resource monitor quota exhausted. No further credits were authorized or added.
Later source dashboard category/unknown-document/unit/historical guards are not deployed.
