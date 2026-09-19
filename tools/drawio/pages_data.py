"""Data pages: two ERD subject areas and two state machines."""
from __future__ import annotations

from .model import EDGE, EDGE_ER, EDGE_FAIL, Edge, Entity, Node, Page, label


def erd_identity() -> Page:
    n = [
        Entity("org", "ORGANIZATION", ["org_id  PK", "type  hospital_network / lab / payer / scheme", "state"], 0, 0),
        Entity("fac", "FACILITY", ["facility_id  PK", "org_id  FK", "hfr_id  ABDM Health Facility Registry", "facility_type  hub / spoke / lab / imaging", "district"], 1, 0),
        Entity("dept", "DEPARTMENT", ["department_id  PK", "facility_id  FK", "specialty  8 values, 6 carry rules"], 2, 0),
        Entity("prac", "PRACTITIONER", ["practitioner_id  PK", "facility_id  FK", "nmc_registration_no  names the decider", "snowflake_user  joins CURRENT_USER", "active"], 3, 0),
        Entity("ct", "CARE_TEAM", ["care_team_id  PK", "practitioner_id  FK", "patient_id  FK", "role_type  treating / coordinator /", "    consulting / family_caretaker", "active_from  relationship has a lifetime", "active_to  expiry, not deletion"], 2, 1, dy=40),
        Entity("cons", "CONSENT", ["consent_id  PK", "patient_id  FK", "purpose_code  treatment / coordination /", "    claim / second_opinion", "data_categories  clinical / financial / identity", "date_range_from  WHICH RECORDS", "valid_until  CONSENT LIFETIME", "status  active / revoked / expired", "artifact_hash  signed consent document", "abdm_consent_ref  nullable"], 3, 1, dy=40),
        Entity("pat", "PATIENT", ["patient_id  PK", "abha_ref  NULLABLE - most have none", "household_id  FK"], 1, 1, dy=40),
        Entity("idm", "ID_MAP", ["id_map_id  PK", "patient_id  FK", "identifier_type  7 types, 0 were ABHA", "match_status  linked / quarantined"], 0, 1, dy=40),
        Entity("bind", "PATIENT_BINDING", ["binding_id  PK", "session_id  CURRENT_SESSION()",
            "snowflake_user", "patient_id  FK", "care_team_id  FK", "consent_id  FK",
            "bound_at", "released_at", "-- WHICH patient the question is about", "-- set by a human click, append-only"], 2, 2, dy=150),
        Entity("hh", "HOUSEHOLD", ["household_id  PK", "scheme_id  PM-JAY family floater"], 0, 2, dy=110),
    ]
    e = [
        Edge("org", "fac", "operates", EDGE_ER),
        Edge("fac", "dept", "contains", EDGE_ER),
        Edge("fac", "prac", "employs", EDGE_ER),
        Edge("dept", "prac", "staffs", EDGE_ER),
        Edge("prac", "ct", "holds relationship through", EDGE_ER),
        Edge("pat", "ct", "is subject of", EDGE_ER),
        Edge("pat", "cons", "grants", EDGE_ER),
        Edge("fac", "cons", "is granted", EDGE_ER),
        Edge("pat", "idm", "is identified by", EDGE_ER),
        Edge("hh", "pat", "includes", EDGE_ER),
        Edge("pat", "bind", "is bound as subject of", EDGE_ER),
        Edge("ct", "bind", "authorised the binding", EDGE_ER),
    ]
    return Page("9. ERD - Identity, Organisation, Consent", n, [], e)


def erd_clinical() -> Page:
    n = [
        Entity("pat", "PATIENT", ["patient_id  PK"], 0, 0, width=240),
        Entity("enc", "ENCOUNTER", ["encounter_id  PK", "scheduled_time  NULL if no FHIR Appointment", "    - NEVER defaulted to period.start", "gap_type  includes clinical_complication"], 1, 0),
        Entity("cev", "CLINICAL_EVENT", ["event_id  PK", "event_type  lab / imaging / medication /", "    procedure / vitals / pathology", "event_time  R2 clock 1 - when it happened", "source_recorded_at  R2 clock 2 - when recorded", "status  ordered / administered / dispensed", "abnormal_flag  H or L - NEVER in value_num", "value_num"], 2, 0),
        Entity("cov", "COVERAGE", ["coverage_id  PK", "patient_id  FK", "household_id  FK  PM-JAY floater"], 3, 0),
        Entity("auth", "AUTHORIZATION", ["authorization_id  PK", "status  includes partial and conflicting", "denial_is_curable  60-70 percent are"], 3, 1, dy=60),
        Entity("doc", "DOCUMENT", ["doc_id  PK", "scope  patient / reference - R6 starts here", "revision_type  original / appended /", "    amended / corrected", "file_hash  SHA-256, ours, for dedup", "attachment_hash  SHA-1, from FHIR", "source_quality  clean_pdf / scanned / photo /", "    rotated_photo / handwritten", "signed_at  R2 clock 2", "ingested_at  R2 clock 3", "supersedes_doc_id  FK", "ingestion_method  6 values incl whatsapp_photo"], 0, 1, dy=60),
        Entity("dpage", "DOC_PAGE", ["doc_id  FK", "page_index", "text  ROW ACCESS POLICY - governed content"], 1, 1, dy=60),
        Entity("dchunk", "DOC_CHUNK", ["chunk_id  PK", "text  NO row access policy - F4 forces this", "patient_id  filter attribute only, not content"], 1, 2, dy=140),
        Entity("asrt", "ASSERTION", ["assertion_id  PK", "doc_id  FK", "missingness_state  R3 - 7 states, never NULL", "fhir_absent_reason  maps R3 to FHIR", "extraction_confidence", "verification_status  R7 verified / conflicting /", "    unverified / single_pass", "pass1_value  R7 audit trail", "pass2_value  R7 audit trail", "char_start  exact span for a clickable citation"], 2, 1, dy=60),
        Entity("elink", "EVIDENCE_LINK", ["link_id  PK", "relation  supports / conflicts_with /", "    supersedes / complemented_by /", "    discordant_across_specimens"], 2, 2, dy=140),
        Entity("onto", "CLINICAL_ONTOLOGY", ["concept_id  PK", "canonical_name", "is_safety_critical  drives R7 two-pass"], 3, 2, dy=140),
    ]
    e = [
        Edge("pat", "enc", "attends", EDGE_ER),
        Edge("pat", "cev", "is subject of", EDGE_ER),
        Edge("pat", "doc", "owns", EDGE_ER),
        Edge("pat", "cov", "is covered by", EDGE_ER),
        Edge("enc", "cev", "occurs during", EDGE_ER),
        Edge("doc", "dpage", "paginates into", EDGE_ER),
        Edge("doc", "dchunk", "chunks into", EDGE_ER),
        Edge("doc", "asrt", "yields", EDGE_ER),
        Edge("asrt", "elink", "relates through", EDGE_ER),
        Edge("onto", "asrt", "normalises", EDGE_ER),
        Edge("onto", "cev", "normalises", EDGE_ER),
        Edge("cov", "auth", "is requested against", EDGE_ER),
    ]
    return Page("10. ERD - Clinical, Documents, Evidence", n, [], e)


def state_assertion() -> Page:
    n = [
        Node("start", "", "terminal", 1, 0, width=40, height=40, dx=130, dy=110),
        Node("extracted", label("Extracted", None, "Pass A complete"), "state", 1, 1),
        Node("single", label("SinglePass", None, "concept not safety-critical"), "state", 0, 2),
        Node("await", label("AwaitingVerification", None, "concept is safety-critical"), "state", 2, 2),
        Node("verified", label("Verified", None, "Pass B agrees"), "state_det", 2, 3),
        Node("conflict", label("Conflicting", None, "Pass B disagrees"), "state_bad", 3, 3),
        Node("unver", label("Unverified", None, "Pass B errored or timed out"), "state_bad", 4, 3),
        Node("asserted", label("Asserted", None, "normalised via ontology"), "state_det", 1, 4),
        Node("review", label("HumanReview", None, "gate returns not_evaluated"), "state", 3, 4, cspan=2),
        Node("comple", label("Complemented", None, "an appended document adds detail"), "state", 0, 5),
        Node("superseded", label("Superseded", None, "a corrected document arrives"), "state", 1, 5),
        Node("discard", label("Discarded", None, "clinician rejects both reads"), "state_bad", 3, 5),
        Node("end", "", "terminal", 1, 6, width=40, height=40, dx=130),
        Node("note1", "The transition that does NOT exist is the important one.<br/><br/>There is no edge from Conflicting or Unverified to<br/>Asserted. A value cannot reach the asserted state<br/>without cross-family agreement or explicit human<br/>confirmation. R7 is enforced by the ABSENCE of a<br/>transition, which is stronger than a validation rule<br/>someone could bypass.", "note", 4, 5, height=230),
    ]
    e = [
        Edge("start", "extracted"),
        Edge("extracted", "single", "not safety-critical"),
        Edge("extracted", "await", "safety-critical"),
        Edge("await", "verified", "Pass B agrees"),
        Edge("await", "conflict", "Pass B disagrees", EDGE_FAIL),
        Edge("await", "unver", "Pass B errored", EDGE_FAIL),
        Edge("single", "asserted", "normalise"),
        Edge("verified", "asserted", "normalise"),
        Edge("conflict", "review", "gate → not_evaluated"),
        Edge("unver", "review", "gate → not_evaluated"),
        Edge("review", "verified", "clinician confirms a value"),
        Edge("review", "discard", "clinician rejects both reads"),
        Edge("asserted", "superseded", "corrected document arrives"),
        Edge("asserted", "comple", "appended document adds detail"),
        Edge("comple", "asserted", "still current, now richer"),
        Edge("superseded", "end"),
    ]
    return Page("12. State - Assertion Verification Lifecycle", n, [], e)


def state_document() -> Page:
    n = [
        Node("start", "", "terminal", 1, 0, width=40, height=40, dx=130, dy=110),
        Node("reg", label("Registered", None, "file lands on stage"), "state", 1, 1),
        Node("dup", label("Duplicate", None, "SHA-256 file_hash already seen"), "state_bad", 0, 2),
        Node("unread", label("Unreadable", None, "parse failed or quality too low"), "state_bad", 2, 2),
        Node("active", label("Active", None, "parsed, assertions extracted"), "state_det", 1, 2),
        Node("append", label("Appended", None, "ADDITIONAL REPORT arrives"), "state", 0, 3),
        Node("amend", label("Amended", None, "source issues a revision"), "state", 1, 3),
        Node("corr", label("Corrected", None, "source states a prior value was wrong"), "state_bad", 2, 3),
        Node("sup", label("SupersededPrior", None, "prior version marked superseded"), "state", 1, 4),
        Node("review", label("HumanReview", None, "appears on the bring-list"), "state", 3, 2),
        Node("end", "", "terminal", 0, 4, width=40, height=40, dx=130),
        Node("note1", "The real FISH result arrived at Appended,<br/>two weeks after the IHC. The original<br/>stays valid — an append COMPLETES<br/>the record.", "note", 3, 3, height=120),
        Node("note2", "A Corrected document means a prior<br/>clinical decision may have rested on the<br/>wrong value. Different action entirely<br/>from an append.", "note", 3, 4, height=120),
    ]
    e = [
        Edge("start", "reg"),
        Edge("reg", "dup", "hash already seen"),
        Edge("reg", "unread", "parse failed"),
        Edge("reg", "active", "parsed"),
        Edge("active", "append", "ADDITIONAL REPORT"),
        Edge("active", "amend", "revision issued"),
        Edge("active", "corr", "prior value wrong"),
        Edge("append", "active", "original remains valid"),
        Edge("amend", "sup", "mark prior superseded"),
        Edge("corr", "sup", "mark prior superseded"),
        Edge("sup", "active", "new version becomes current"),
        Edge("unread", "review", "no legible copy"),
        Edge("review", "reg", "a better copy is obtained"),
        Edge("dup", "end"),
    ]
    return Page("13. State - Document Revision Lifecycle", n, [], e)


PAGES = [erd_identity, erd_clinical, state_assertion, state_document]
