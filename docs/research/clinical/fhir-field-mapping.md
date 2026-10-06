# FHIR R4 → Saarthi Field-Level Mapping

**Written 2026-09-17. Closes research gap G2 — `abdm-architecture.md` §3 mapped FHIR *resources* to tables but only one field-level path (`Patient.identifier`) existed anywhere in the corpus.**

Purpose: write the `LATERAL FLATTEN` SQL for the semi-structured ingestion path (`SPEC.md` §3) correctly on the first attempt.

**Provenance note:** compiled from the HL7 FHIR R4 specification (hl7.org/fhir/R4). Items marked ⚠️ need verification against the NRCeS ABDM FHIR R4 IG v6.5.0 (nrces.in/ndhm/fhir/r4/) before the India-specific profile claims are made in the submission. Base-FHIR paths below are standard and stable.

---

## 0. Five findings that strengthen the architecture

Working through the field level surfaced things that matter beyond the SQL.

### 0.1 `Observation.dataAbsentReason` is prior art for R3

FHIR has a standard code system for *why* a value is missing:

`http://terminology.hl7.org/CodeSystem/data-absent-reason`
→ `unknown · asked-unknown · temp-unknown · not-asked · asked-declined · masked · not-applicable · unsupported · as-text · error · not-a-number · negative-infinity · positive-infinity · not-performed · not-permitted`

Our R3 taxonomy (`present · explicitly_negative · pending · not_received · conflicting · unreadable · superseded`) is therefore **less novel than `should-close-gaps.md` assessed, and better grounded than we knew.** Two consequences:

1. **Do not claim R3 as novel.** Claim it as *enforced* — FHIR offers the vocabulary but does not compel anyone to populate it, and no competitor uses a typed taxonomy at all (Verity has 3 verdict states, ATLAS an `UNKNOWN` enum, SynapseCortex bare NULLs, CareCompass nothing).
2. **Map to it.** `ASSERTION.missingness_state` should carry a mapping to the FHIR code where one exists. That is a genuine interoperability signal, cheap to add.

Our taxonomy still adds three states FHIR lacks in this vocabulary: `pending` (result awaited — FHIR expresses this via `status`, not `dataAbsentReason`), `conflicting`, and `superseded`.

### 0.2 `DiagnosticReport.status = 'appended'` is exactly the addendum pattern

Valid values: `registered · partial · preliminary · final · amended · corrected · appended · cancelled · entered-in-error · unknown`

Dipali's FISH result arrived as an "ADDITIONAL REPORT" appended to an existing surgical pathology report, two weeks after the IHC. **FHIR distinguishes `appended` (added to) from `amended`/`corrected` (changed).** That distinction is precisely what our `supersedes_doc_id` chain needs — an addendum does *not* supersede the original, whereas a correction does.

**Design correction:** `DOCUMENT` should carry `revision_type` (`original | appended | amended | corrected`) so the version chain can tell "more information arrived" from "the previous value was wrong." Those drive different clinical actions and our v2 spec collapses them.

### 0.3 R2's first two clocks exist natively

| Our clock | FHIR |
|---|---|
| `scheduled_time` | `Appointment.start` (referenced from `Encounter.appointment[]`) |
| `event_time` | `Encounter.period.start` / `Observation.effectiveDateTime` |
| `source_recorded_at` | `Observation.issued` / `DiagnosticReport.issued` — *"when this version was made available"* |
| `ingested_at` | ours only — no FHIR equivalent |

`issued` vs `effective[x]` is the same distinction as our clocks 1 and 2. Good validation, and it means FHIR-sourced data populates both correctly rather than duplicating one value into two columns.

### 0.4 Ordered vs administered is two resources, not a status field

`MedicationRequest` = the order. `MedicationAdministration` = the drug given, with `request.reference` pointing back.

`clinical-thresholds.md` §8 insisted these must not collapse (readiness checks fire at *ordered*; cycle counting uses *administered* only). FHIR agrees structurally. Our single `CLINICAL_EVENT.status` enum spanning `ordered|administered|dispensed` is a deliberate simplification — worth stating as such, since a FHIR purist will notice.

### 0.5 Authorisation validity is native

`ClaimResponse.preAuthRef` + `ClaimResponse.preAuthPeriod.{start,end}` gives the pre-auth reference and its validity window directly. `Claim.use = 'preauthorization'` is a real enum value. This maps cleanly onto `AUTHORIZATION.valid_until`, and `ClaimResponse.outcome` (`queued|complete|error|partial`) supports the `partial` status that `insurance-irdai-nhcx.md` §5.4 told us to add.

---

## 1. Bundle envelope and the flatten pattern

```json
{
  "resourceType": "Bundle",
  "id": "...",
  "type": "document",
  "timestamp": "2026-09-08T16:45:00+05:30",
  "entry": [
    { "fullUrl": "urn:uuid:a1b2...", "resource": { "resourceType": "Patient",     "...": "..." } },
    { "fullUrl": "urn:uuid:c3d4...", "resource": { "resourceType": "Observation", "...": "..." } }
  ]
}
```

`Bundle.type`: `document | collection | transaction | batch | searchset | history`. ABDM health-information bundles are typically `document` (with a `Composition` as the first entry) or `collection`.

**Base flatten:**

```sql
CREATE OR REPLACE VIEW SAARTHI.DOCUMENTS.V_FHIR_ENTRY AS
SELECT
    b.bundle_id,
    b.source_id,
    b.received_at,
    b.payload:type::VARCHAR                        AS bundle_type,
    b.payload:timestamp::TIMESTAMP_NTZ             AS bundle_timestamp,
    e.index                                        AS entry_index,
    e.value:fullUrl::VARCHAR                       AS full_url,
    e.value:resource:resourceType::VARCHAR         AS resource_type,
    e.value:resource                               AS resource
FROM SAARTHI.DOCUMENTS.RAW_FHIR_BUNDLE b,
     LATERAL FLATTEN(input => b.payload:entry) e;
```

Every mapping below reads from `resource`.

**References** are strings of the form `"Patient/pat-0017"` or `"urn:uuid:a1b2..."`. Resolve with `SPLIT_PART(ref, '/', -1)` for the relative form; for `urn:uuid` forms, join on `full_url`.

---

## 2. Patient → `PATIENT` + `ID_MAP` + `HOUSEHOLD_MEMBER`

| Target | Path | Card | Note |
|---|---|---|---|
| `abha_ref` | `identifier[?system='https://healthid.ndhm.gov.in'].value` | 0..* | ⚠️ verify system URI against NRCeS |
| `ID_MAP.source_patient_id` | `identifier[].value` | 0..* | one `ID_MAP` row per identifier |
| `ID_MAP.source_system` | `identifier[].system` | | facility MRNs carry facility-specific system URIs |
| `name` | `name[0].family`, `name[0].given[0]` | 0..* | `name[].use` = `official\|usual\|nickname` — prefer `official` |
| `dob` | `birthDate` | 0..1 | `date` |
| `gender` | `gender` | 0..1 | `male\|female\|other\|unknown` |
| `district` | `address[0].district` | 0..* | |
| `state` | `address[0].state` | | |
| `primary_language` | `communication[?preferred=true].language.coding[0].code` | 0..* | BCP-47 (`hi`, `ta`, `bn`, `mr`) |

```sql
SELECT
    resource:id::VARCHAR                                        AS fhir_id,
    resource:name[0]:family::VARCHAR                            AS family_name,
    ARRAY_TO_STRING(resource:name[0]:given::ARRAY, ' ')         AS given_name,
    resource:birthDate::DATE                                    AS dob,
    resource:gender::VARCHAR                                    AS gender,
    resource:address[0]:district::VARCHAR                       AS district,
    resource:address[0]:state::VARCHAR                          AS state,
    resource:communication[0]:language:coding[0]:code::VARCHAR  AS primary_language
FROM SAARTHI.DOCUMENTS.V_FHIR_ENTRY
WHERE resource_type = 'Patient';

-- identifiers fan out to ID_MAP; ABHA is one identifier among several (R4)
SELECT
    e.resource:id::VARCHAR              AS fhir_id,
    i.value:system::VARCHAR             AS source_system,
    i.value:value::VARCHAR              AS source_patient_id,
    i.value:type:coding[0]:code::VARCHAR AS identifier_type
FROM SAARTHI.DOCUMENTS.V_FHIR_ENTRY e,
     LATERAL FLATTEN(input => e.resource:identifier) i
WHERE e.resource_type = 'Patient';
```

---

## 3. Encounter → `ENCOUNTER`

| Target | Path | Note |
|---|---|---|
| `status` | `status` | `planned\|arrived\|triaged\|in-progress\|onleave\|finished\|cancelled\|entered-in-error\|unknown` |
| `encounter_type` | `class.code` + `type[0].coding[0].code` | `class` is ActEncounterCode (`AMB`, `IMP`, `EMER`, `SS`) |
| patient link | `subject.reference` | |
| **`event_time`** | `period.start` | actual |
| | `period.end` | |
| `facility_id` | `serviceProvider.reference` | → Organization |
| **`scheduled_time`** | via `appointment[0].reference` → `Appointment.start` | **R2 clock 1** |
| `department_id` | `participant[].individual` → Practitioner → department | indirect |

**`Encounter` alone does not carry the scheduled time.** It must be resolved through `Appointment`. If a bundle omits `Appointment`, `scheduled_time` is genuinely unknown and must be `NULL` — not silently set equal to `period.start`, which would destroy the R2 delay signal.

---

## 4. Observation → `CLINICAL_EVENT` (labs, vitals)

The most important mapping.

| Target | Path | Note |
|---|---|---|
| `status` | `status` | `registered\|preliminary\|final\|amended\|corrected\|cancelled\|entered-in-error\|unknown` |
| `event_type` | `category[0].coding[0].code` | `laboratory\|vital-signs\|imaging\|exam\|procedure\|survey\|therapy\|activity` |
| `code_system` | `code.coding[0].system` | `http://loinc.org` |
| `code` | `code.coding[0].code` | |
| `display` | `code.coding[0].display` or `code.text` | |
| `value_num` | `valueQuantity.value` | choice type — see below |
| `unit` | `valueQuantity.unit` (human) / `.code` (UCUM) | `.system` = `http://unitsofmeasure.org` |
| `value_text` | `valueString` / `valueCodeableConcept.text` | |
| **`abnormal_flag`** | `interpretation[0].coding[0].code` | `H\|L\|N\|A\|AA\|HH\|LL` — the L/H suffix from Dipali's reports |
| ref range | `referenceRange[0].low.value`, `.high.value`, `.text` | |
| `specimen_id` | `specimen.reference` | → Specimen |
| **`event_time`** | `effectiveDateTime` \| `effectivePeriod.start` \| `effectiveInstant` | R2 clock 1 |
| **`source_recorded_at`** | `issued` | R2 clock 2 |
| `missingness_state` | `dataAbsentReason.coding[0].code` | §0.1 |
| encounter link | `encounter.reference` | |

**`effective[x]` is a choice type** — exactly one of `effectiveDateTime`, `effectivePeriod`, `effectiveTiming`, `effectiveInstant` is present. Coalesce:

```sql
COALESCE(
    resource:effectiveDateTime::TIMESTAMP_NTZ,
    resource:effectivePeriod:start::TIMESTAMP_NTZ,
    resource:effectiveInstant::TIMESTAMP_NTZ
) AS event_time
```

**`value[x]` likewise:** `valueQuantity | valueCodeableConcept | valueString | valueBoolean | valueInteger | valueRange | valueRatio | valueSampledData | valueTime | valueDateTime | valuePeriod`.

**Interpretation codes** — system `http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation`:
`H` high · `L` low · `N` normal · `A` abnormal · `HH` critically high · `LL` critically low

This is where Dipali's `10.3 L` and `38 H` belong. **The flag goes in `abnormal_flag`, never in `value_num`** — parsing it into the number corrupts every threshold comparison.

**`component[]`** carries multi-part observations (blood pressure as systolic + diastolic). Each component has its own `code` and `value[x]`. Flatten separately:

```sql
SELECT
    e.resource:id::VARCHAR                          AS obs_id,
    c.value:code:coding[0]:code::VARCHAR            AS component_code,
    c.value:valueQuantity:value::FLOAT              AS component_value,
    c.value:valueQuantity:unit::VARCHAR             AS component_unit
FROM SAARTHI.DOCUMENTS.V_FHIR_ENTRY e,
     LATERAL FLATTEN(input => e.resource:component) c
WHERE e.resource_type = 'Observation';
```

**Full lab mapping:**

```sql
SELECT
    resource:id::VARCHAR                                       AS fhir_id,
    resource:status::VARCHAR                                   AS status,
    resource:category[0]:coding[0]:code::VARCHAR               AS category,
    resource:code:coding[0]:system::VARCHAR                    AS code_system,
    resource:code:coding[0]:code::VARCHAR                      AS code,
    COALESCE(resource:code:coding[0]:display::VARCHAR,
             resource:code:text::VARCHAR)                      AS display,
    resource:valueQuantity:value::FLOAT                        AS value_num,
    resource:valueQuantity:unit::VARCHAR                       AS original_unit,
    resource:valueQuantity:code::VARCHAR                       AS ucum_code,
    resource:valueString::VARCHAR                              AS value_text,
    resource:interpretation[0]:coding[0]:code::VARCHAR          AS abnormal_flag,
    resource:referenceRange[0]:low:value::FLOAT                AS ref_low,
    resource:referenceRange[0]:high:value::FLOAT               AS ref_high,
    SPLIT_PART(resource:specimen:reference::VARCHAR, '/', -1)  AS specimen_id,
    COALESCE(resource:effectiveDateTime::TIMESTAMP_NTZ,
             resource:effectivePeriod:start::TIMESTAMP_NTZ,
             resource:effectiveInstant::TIMESTAMP_NTZ)         AS event_time,
    resource:issued::TIMESTAMP_NTZ                             AS source_recorded_at,
    resource:dataAbsentReason:coding[0]:code::VARCHAR          AS absent_reason,
    SPLIT_PART(resource:subject:reference::VARCHAR, '/', -1)   AS patient_ref,
    SPLIT_PART(resource:encounter:reference::VARCHAR, '/', -1) AS encounter_ref
FROM SAARTHI.DOCUMENTS.V_FHIR_ENTRY
WHERE resource_type = 'Observation';
```

---

## 5. DiagnosticReport → `DOCUMENT` + `DOC_PAGE`

| Target | Path | Note |
|---|---|---|
| `status` | `status` | includes **`appended`** — §0.2 |
| `doc_type` | `code.coding[0].code` | LOINC |
| `effective_at` | `effectiveDateTime` \| `effectivePeriod.start` | specimen collection / study time |
| `signed_at` | `issued` | when this version was released |
| `accession_id` | `specimen[0].reference` | → Specimen.accessionIdentifier |
| linked results | `result[].reference` | → Observations |
| conclusion | `conclusion`, `conclusionCode[]` | |
| the PDF | `presentedForm[0]` | Attachment |

**`presentedForm[]` is an Attachment:** `.contentType` (`application/pdf`), `.data` (base64 inline), `.url` (external), `.title`, `.creation`, `.size`, `.hash` (SHA-1, base64).

```sql
resource:presentedForm[0]:contentType::VARCHAR  AS content_type,
resource:presentedForm[0]:data::VARCHAR         AS base64_pdf,   -- decode → stage → AI_PARSE_DOCUMENT
resource:presentedForm[0]:url::VARCHAR          AS external_url,
resource:presentedForm[0]:hash::VARCHAR         AS attachment_hash
```

Base64 → stage: `TO_BINARY(data, 'BASE64')` written out, then parsed. **`Attachment.hash` is SHA-1**, whereas our dedup (`DOCUMENT.file_hash`) uses SHA-256 — do not conflate them; keep the FHIR hash separately if retained at all.

`Specimen.accessionIdentifier.value` is the accession number (`R21369/24` in Dipali's reports) and is what ties grade/IHC/FISH findings to the same specimen — the key to D3 discordance detection.

---

## 6. Medication → `CLINICAL_EVENT`

**MedicationRequest** (ordered):

| Target | Path |
|---|---|
| `status` | `status` — `active\|on-hold\|cancelled\|completed\|entered-in-error\|stopped\|draft\|unknown` |
| intent | `intent` — `proposal\|plan\|order\|original-order\|reflex-order\|filler-order\|instance-order\|option` |
| drug | `medicationCodeableConcept.coding[0].code` **or** `medicationReference` → Medication |
| `event_time` | `authoredOn` |
| dose | `dosageInstruction[0].doseAndRate[0].doseQuantity.{value,unit}` |
| route | `dosageInstruction[0].route.coding[0].code` |

**MedicationAdministration** (administered):

| Target | Path |
|---|---|
| `status` | `status` — `in-progress\|not-done\|on-hold\|completed\|entered-in-error\|stopped\|unknown` |
| `event_time` | `effectiveDateTime` \| `effectivePeriod.start` |
| dose | `dosage.dose.{value,unit}` |
| links to order | `request.reference` → MedicationRequest |

`medication[x]` is a choice type: inline `medicationCodeableConcept` or `medicationReference` to a contained/external `Medication`. Handle both.

---

## 7. Condition → `CLINICAL_EVENT` (diagnosis, staging)

| Target | Path | Note |
|---|---|---|
| clinical status | `clinicalStatus.coding[0].code` | `active\|recurrence\|relapse\|inactive\|remission\|resolved` |
| verification | `verificationStatus.coding[0].code` | `unconfirmed\|provisional\|differential\|confirmed\|refuted\|entered-in-error` |
| ICD-10 | `code.coding[?system='http://hl7.org/fhir/sid/icd-10'].code` | |
| SNOMED | `code.coding[?system='http://snomed.info/sct'].code` | |
| `event_time` | `onsetDateTime` | |
| `source_recorded_at` | `recordedDate` | |
| **staging** | `stage[0].summary.coding[0].code` | AJCC stage |
| stage evidence | `stage[0].assessment[].reference` | → the report that established it |
| stage system | `stage[0].type.coding[0]` | which staging system |

`verificationStatus` maps usefully onto R3: `provisional` ≈ our `pending`, `refuted` ≈ `explicitly_negative`, `confirmed` ≈ `present`.

`stage[].assessment[]` is valuable — it links a stage to the document that established it, which is exactly our `EVIDENCE_LINK` relation. And `stage[]` being an array means **restaging is natively expressible**, which Dipali needed (pT2N0 → Stage IVA after PET-CT).

---

## 8. Coverage → `COVERAGE` + `HOUSEHOLD`

| Target | Path | Note |
|---|---|---|
| `status` | `status` | `active\|cancelled\|draft\|entered-in-error` |
| `payer_type` | `type.coding[0].code` | |
| `policy_number` | `identifier[0].value` | |
| patient | `beneficiary.reference` | |
| `payer_name` | `payor[0].reference` | → Organization |
| `effective_from/to` | `period.start`, `period.end` | |
| **family/group** | `class[?type='group'].value` | ⚠️ candidate for PM-JAY family ID |
| plan | `class[?type='plan'].value` | |
| `annual_limit` | `costToBeneficiary[]` | limited fit — see note |

`class[]` entries are `{type.coding[0].code, value, name}` with `type` from `http://terminology.hl7.org/CodeSystem/coverage-class` (`group`, `subgroup`, `plan`, `subplan`, `class`, `subclass`, `sequence`, `rxbin`, ...).

⚠️ **The PM-JAY family floater does not map cleanly.** `Coverage.beneficiary` is a single Patient reference, so a ₹5-lakh-per-family limit has no native home. Options: `class[type=group].value` as the family key, or a Group resource. **Needs verification against the NRCeS IG.** Our `HOUSEHOLD` table exists precisely because the base resource is individual-centric — worth saying so, since it shows the modelling was deliberate.

---

## 9. Claim / ClaimResponse → `AUTHORIZATION`

| Target | Path | Note |
|---|---|---|
| pre-auth vs claim | `Claim.use` | `claim \| preauthorization \| predetermination` |
| `status` | `Claim.status` | `active\|cancelled\|draft\|entered-in-error` |
| `requested_at` | `Claim.created` | |
| `package_code` | `Claim.item[0].productOrService.coding[0].code` | PM-JAY package code |
| `requested_amount` | `Claim.total.value` | |
| outcome | `ClaimResponse.outcome` | `queued \| complete \| error \| partial` ← supports our `partial` |
| **`auth_id`** | `ClaimResponse.preAuthRef` | |
| **`valid_until`** | `ClaimResponse.preAuthPeriod.end` | §0.5 |
| `approved_amount` | `ClaimResponse.item[].adjudication[?category='benefit'].amount.value` | |
| `denial_reason` | `ClaimResponse.item[].adjudication[].reason.coding[0]` + `ClaimResponse.disposition` | |
| `responded_at` | `ClaimResponse.created` | |

`ClaimResponse.outcome` has **no `denied` value** — denial is expressed as `complete` with zero/absent benefit adjudication plus a reason code. Our `AUTHORIZATION.status = 'denied'` is therefore a derived value, not a direct copy. Worth noting so the mapping isn't misread as one-to-one.

---

## 10. Canonical system URIs

| Vocabulary | URI |
|---|---|
| LOINC | `http://loinc.org` |
| SNOMED CT | `http://snomed.info/sct` |
| ICD-10 | `http://hl7.org/fhir/sid/icd-10` |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` |
| UCUM (units) | `http://unitsofmeasure.org` |
| Observation interpretation | `http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation` |
| Data absent reason | `http://terminology.hl7.org/CodeSystem/data-absent-reason` |
| Encounter class | `http://terminology.hl7.org/CodeSystem/v3-ActCode` |
| Coverage class | `http://terminology.hl7.org/CodeSystem/coverage-class` |
| Condition clinical status | `http://terminology.hl7.org/CodeSystem/condition-clinical` |
| ⚠️ ABHA number | `https://healthid.ndhm.gov.in` — from `abdm-architecture.md` §3; **verify against NRCeS** |

---

## 11. Worked example — minimal bundle

```json
{
  "resourceType": "Bundle",
  "id": "bundle-meera-cbc-20260908",
  "type": "collection",
  "timestamp": "2026-09-08T16:45:00+05:30",
  "entry": [
    {
      "fullUrl": "urn:uuid:pat-0017",
      "resource": {
        "resourceType": "Patient",
        "id": "pat-0017",
        "identifier": [
          { "system": "https://healthid.ndhm.gov.in", "value": "91-1234-5678-9012" },
          { "system": "https://tmh.example.in/mrn",   "value": "MR/26/010770" }
        ],
        "name": [{ "use": "official", "family": "Devi", "given": ["Meera"] }],
        "gender": "female",
        "birthDate": "1979-03-15",
        "address": [{ "district": "Jhansi", "state": "Uttar Pradesh", "country": "IN" }],
        "communication": [{
          "language": { "coding": [{ "system": "urn:ietf:bcp:47", "code": "hi" }] },
          "preferred": true
        }]
      }
    },
    {
      "fullUrl": "urn:uuid:obs-anc-441",
      "resource": {
        "resourceType": "Observation",
        "id": "obs-anc-441",
        "status": "final",
        "category": [{ "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "laboratory" }]}],
        "code": { "coding": [{
          "system": "http://loinc.org", "code": "751-8",
          "display": "Neutrophils [#/volume] in Blood by Automated count" }]},
        "subject":   { "reference": "urn:uuid:pat-0017" },
        "effectiveDateTime": "2026-09-08T08:30:00+05:30",
        "issued":            "2026-09-08T16:45:00+05:30",
        "valueQuantity": {
          "value": 2100, "unit": "cells/uL",
          "system": "http://unitsofmeasure.org", "code": "/uL"
        },
        "interpretation": [{ "coding": [{
          "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          "code": "N" }]}],
        "referenceRange": [{ "low": { "value": 1500 }, "high": { "value": 8000 } }],
        "specimen": { "reference": "Specimen/SP-LAB-441" }
      }
    }
  ]
}
```

Note `effectiveDateTime` 08:30 (blood drawn) vs `issued` 16:45 (report released) — **an 8-hour gap between R2 clocks 1 and 2, in a single ordinary lab result.** This is why the three-clock model matters, and it comes straight out of the standard.

---

## 12. Changes this forces in `SPEC.md`

| # | Change | Reason |
|---|---|---|
| 1 | Add `DOCUMENT.revision_type` (`original\|appended\|amended\|corrected`) | §0.2 — an addendum is not a supersession, and Dipali's FISH arrived as an append |
| 2 | Add `ASSERTION.fhir_absent_reason` | §0.1 — map R3 onto the standard vocabulary; interoperability signal |
| 3 | Do **not** claim R3 as novel — claim it as *enforced* | §0.1 — FHIR has prior art; no competitor implements it |
| 4 | `scheduled_time` must be `NULL` when no `Appointment` is present | §3 — never default it to `period.start`; that erases the delay signal |
| 5 | Keep `Attachment.hash` (SHA-1) separate from `file_hash` (SHA-256) | §5 |
| 6 | Document that `AUTHORIZATION.status='denied'` is derived, not mapped | §9 — `ClaimResponse.outcome` has no denied value |
| 7 | State that `HOUSEHOLD` exists because `Coverage` is individual-centric | §8 — deliberate modelling, not an oversight |
| 8 | `CLINICAL_EVENT.status` spanning ordered/administered is a stated simplification | §0.4 — FHIR uses two resources |

---

## Verification still required ⚠️

Against NRCeS ABDM FHIR R4 IG v6.5.0 (nrces.in/ndhm/fhir/r4/), before any India-profile claim appears in the submission:

1. ABHA identifier system URI and whether a `type` coding is mandated
2. Whether ABDM constrains `Bundle.type` for health-information exchange
3. India-specific extensions on Patient (caste/category fields exist in some Indian health schemas)
4. How PM-JAY family coverage is represented — `Coverage.class[group]`, a `Group` resource, or an extension
5. Whether NHCX uses base `Claim`/`ClaimResponse` or profiled variants

Items 1 and 4 matter most: 1 underpins R4, and 4 determines whether `HOUSEHOLD` is a workaround or the sanctioned pattern.
