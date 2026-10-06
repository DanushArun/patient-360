# ABDM / ABHA Architecture — What R4 Must Model

**Researched 2026-09-16. Validates or corrects R4 (ABHA-anchored identity, never joined on name).**

> **Headline finding: R4 is architecturally correct but aspirationally positioned.** ABHA exists and is real infrastructure — 780M+ ABHA numbers created as of mid-2026. But ground-level adoption in clinical workflows is thin: most hospitals still run on facility MRNs, and the consent-mediated data flow ABDM envisions is operational at only a fraction of registered facilities. R4 should model the ABHA shape (because it is the national direction and the correct identity anchor) while acknowledging that in current Indian reality, the system must also handle patients who have no ABHA, facilities that don't query it, and identity resolution that falls back to manual verification.

---

## 1. ABHA — the identity layer

### What it is
- **ABHA Number**: 14-digit unique health identifier, generated via Aadhaar eKYC or driving licence/PAN-based verification.
- **ABHA Address**: A user-friendly handle (e.g., `rajesh.kumar@abdm`) linked to the ABHA number. Used for discovery and linking.
- **Not the same as Aadhaar**: ABHA is a health-domain identifier. It can be created via Aadhaar but is a separate number. A patient can have an ABHA without sharing their Aadhaar with the hospital.

### Adoption numbers (mid-2026)
- **780M+ ABHA numbers created** (NHA dashboard). Misleading — bulk creation by state governments during PM-JAY enrollment means many ABHAs are dormant (created for scheme enrollment, never used for clinical data linking).
- **Active health records linked**: far fewer. NHA claims 250M+ health records on ABDM, but records-per-ABHA ratio is low.
- **Facility registrations**: 280,000+ Health Facility Registry entries. "Registered" ≠ "actively exchanging data via ABDM APIs."

### The identity resolution problem ABHA solves
One Indian cancer patient simultaneously holds:
1. An ABHA number (if created)
2. A hub hospital MRN (e.g., Tata Memorial registration number)
3. A spoke hospital MRN (e.g., district hospital registration)
4. A PM-JAY beneficiary ID (Ayushman card number)
5. An insurer member ID (if privately insured)
6. An Aadhaar number (not supposed to be used as health ID, but commonly is)

**Without ABHA**: linking records across these requires name+DOB+gender fuzzy matching — exactly how wrong-patient merges happen in oncology, where consequences are catastrophic.

**With ABHA**: the 14-digit number is the canonical anchor. Each facility's MRN maps to it via `ID_MAP`. Only works if the facility actually queries/creates the ABHA at registration.

---

## 2. HIU / HIP / Consent Manager architecture

### The actors
- **HIP (Health Information Provider)**: facility that holds the data (hospital, lab, pharmacy).
- **HIU (Health Information User)**: facility or app requesting the data.
- **Consent Manager**: mediates consent between patient and HIP/HIU. Patient grants/revokes through a Consent Manager (typically ABDM gateway or PHR app).

### Data flow (simplified)
1. Patient visits HIU (e.g., hub hospital).
2. HIU discovers patient's linked HIPs via ABDM gateway using ABHA address.
3. HIU sends consent request: what data, from which HIP, for what purpose, for how long.
4. Patient approves via PHR app or Consent Manager.
5. HIP encrypts and sends data to HIU via ABDM Health Information Exchange.
6. HIU decrypts and uses data for consented purpose and duration.

### What actually happens in practice
- **Most hospitals don't initiate discovery/consent flows.** They ask the patient to bring reports.
- **PHR apps** (ABHA app, private PHR apps) are the primary mechanism — but adoption is low.
- **Lab chains** (SRL, Metropolis, Dr. Lal PathLabs) are among more active HIPs — push reports to ABDM.
- **Government hospitals** in states like Andhra Pradesh, Kerala have higher adoption due to state mandates.
- **Private tertiary hospitals** (Apollo, Max, Fortis) registered but active exchange is inconsistent.

---

## 3. NRCeS FHIR R4 IG for ABDM v6.5.0

### Key resources relevant to patient-360
| FHIR Resource | Maps to our table | Notes |
|---|---|---|
| Patient | PATIENT + ID_MAP | Must carry ABHA identifier |
| Encounter | ENCOUNTER | |
| Condition | CLINICAL_EVENT (type=diagnosis) | |
| Observation | CLINICAL_EVENT (type=lab/imaging) | |
| MedicationRequest | CLINICAL_EVENT (type=medication) | |
| DiagnosticReport | DOCUMENT | Lab/pathology reports |
| DocumentReference | DOCUMENT | Links to actual PDFs/images |
| Composition | DOCUMENT | Discharge summary bundle |
| Coverage | COVERAGE | |
| Claim / ClaimResponse | CLAIM / AUTHORIZATION | |

### Identity in FHIR
Patient.identifier carries the ABHA number as: `system: "https://healthid.ndhm.gov.in"`, `value: "14-digit-number"`. Facility MRNs are additional identifiers with facility-specific system URIs. This is exactly the `ID_MAP` model.

---

## 4. Gap between design and ground reality

| What ABDM envisions | What actually happens |
|---|---|
| Patient identified by ABHA at every facility | Most facilities still use own MRN; ABHA created but rarely queried for linking |
| Consent-mediated data exchange via HIE | Patient carries plastic folder or phone photos between facilities |
| Structured FHIR bundles exchanged digitally | Scanned PDFs, handwritten prescriptions, phone camera images |
| Real-time data availability across facilities | Reports arrive days later, often by WhatsApp photo |
| Patient controls access via PHR app | Most patients don't know ABHA exists or have never used the app |

---

## 5. Consent mechanics

- **Purpose-bound**: must specify data type, date range, HIP, purpose, and expiry.
- **Revocable at any time**: Consent Manager notifies HIU, which must stop using data.
- **Signed and logged**: ABDM gateway maintains audit trail.
- **For our system**: consent modeled as first-class entity (CONSENT table in plan.md §5 is correct). Consent state must be checked at query time, not just at ingest.
- **DPDP intersection**: ABDM consent prefigures DPDP model but is not the same thing (see law-dpdp.md). An ABDM Consent Manager ≠ a DPDP Consent Manager (different registration, different legal basis).

---

## 6. ABHA vs Aadhaar vs MRNs

| Identifier | Scope | Uniqueness | At registration? | Used for linking? |
|---|---|---|---|---|
| ABHA number | National health | Unique/person | Only if eKYC done | Yes (design) / Rarely (practice) |
| ABHA address | National health | User-chosen | After ABHA creation | Discovery only |
| Aadhaar | National (all) | Unique/person | Commonly collected | Not supposed to be (but commonly is) |
| Hub MRN | Single facility | Unique/facility | Yes | Within facility only |
| Spoke MRN | Single facility | Unique/facility | Yes | Within facility only |
| PM-JAY ID | Scheme | Unique/family or individual | If enrolled | Claims only |
| Insurer member ID | Insurer | Unique/policy | If insured | Claims only |

---

## 7. Design implications

1. **R4 is validated but must handle the no-ABHA case.** Generator should produce patients with and without ABHA. No-ABHA patient gets system-generated canonical ID, with ID_MAP entries for each facility MRN, link_status = manually_verified or quarantined.

2. **CONSENT table must check at query time.** Consent valid at ingest but revoked before query must block the query. Aligns with ABDM + DPDP s.6.

3. **Model the WhatsApp-photo reality.** Some documents should be "received via informal channel" — with ingestion_method flag, lower confidence, unverified against originating facility.

4. **FHIR shape is worth modeling without live ABDM.** NRCeS IG resources map to our data model. Framing tables as "FHIR-aligned" costs nothing and signals ABDM-readiness.

5. **`ID_MAP.link_status` enum is correct.** `abha_linked | manually_verified | quarantined` models the spectrum from clean ABHA linkage to unresolved ambiguity. Quarantine contributes no evidence — this is the critical safety property.

---

## Sources

NHA ABDM Dashboard (abdm.gov.in) · NRCeS FHIR R4 IG v6.5.0 (nrces.in/ndhm/fhir/r4/) · ABDM Sandbox docs (sandbox.abdm.gov.in) · PIB press releases on ABHA adoption · DPDP intersection: see law-dpdp.md.
