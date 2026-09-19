"""Flow pages: trust boundaries, sequence, R7 extraction, pipeline, decisions."""
from __future__ import annotations

from .model import (
    EDGE,
    EDGE_FAIL,
    EDGE_STRAIGHT,
    STYLE,
    Boundary,
    Edge,
    Free,
    Node,
    Page,
    PointEdge,
    label,
)


def trust_boundaries() -> Page:
    n = [
        Node("u", label("Human user", "External entity", "Authenticated Snowflake user"), "plain", 0, 0),
        Node("q", label("Question text", "Data flow", "Free-form natural language"), "plain", 1, 0),
        Node("sess", label("Session hardening", "Process", "USE SECONDARY ROLES NONE<br/>⚠ F7 · without this a secondary ACCOUNTADMIN<br/>satisfies the privilege check"), "enforce", 0, 1, cspan=2),
        Node("cls", label("Class A/B classifier", "Process", "AI_CLASSIFY"), "ai", 2, 1),
        Node("ag", label("SAARTHI Agent", "Process", "⚠ A1 · given a raw search tool it derives patient_id from the<br/>question and injects the filter itself. Agent-generated<br/>filters are worthless as a scope control."), "ai", 0, 2, cspan=3),
        Node("scope", label("Selection + authorisation", "Process", "SELECTION: PATIENT_BINDING for CURRENT_SESSION()<br/>set by a human click, never by question text<br/>AUTHORISATION: CURRENT_USER → PRACTITIONER → CARE_TEAM<br/>⚠ F3 · CURRENT_USER survives owner's-rights elevation"), "enforce", 0, 3),
        Node("cons", label("Consent check", "Process", "Evaluated at query time, not at ingest.<br/>The binding is a record of selection,<br/>NEVER a cached authorisation."), "enforce", 1, 3),
        Node("inj", label("Server-side filter injection", "Process", "@eq patient filter · ⚠ F6"), "enforce", 2, 3),
        Node("idx", label("DOC_CHUNK index", "Data store", "NO row access policy<br/>⚠ F5 · Cortex Search runs with owner's rights and IGNORES<br/>row access policies. ⚠ F4 · a service cannot be created over<br/>a RAP-protected table. So this store returns IDs, never content."), "store_det", 0, 4, cspan=2, height=170),
        Node("page", label("DOC_PAGE content", "Data store", "ROW ACCESS POLICY on CURRENT_USER.<br/>The only place governed<br/>content lives."), "store_det", 2, 4, height=170),
        Node("val", label("Answer validator", "Process", "6 checks, strips<br/>unsupported claims"), "enforce", 0, 5),
        Node("out", label("Cited answer", "Data flow"), "plain", 1, 5),
        Node("deny", label("Empty result", "Data flow", "FAIL CLOSED"), "failed", 2, 5),
    ]
    e = [
        Edge("u", "q", "1 · submits"),
        Edge("q", "sess", "2 · enters session"),
        Edge("sess", "cls", "3 · classify before<br/>any retrieval"),
        Edge("cls", "ag", "4 · Class B only"),
        Edge("cls", "deny", "Class A · refused here", EDGE_FAIL),
        Edge("ag", "scope", "5 · calls generic tool ·<br/>patient_id absent from schema"),
        Edge("scope", "cons", "6 · scope resolved"),
        Edge("cons", "deny", "no valid consent or<br/>no care relationship", EDGE_FAIL),
        Edge("cons", "inj", "7 · authorised"),
        Edge("inj", "idx", "8 · search with<br/>injected filter"),
        Edge("idx", "page", "9 · IDs only, no content"),
        Edge("page", "val", "10 · resolve content<br/>under policy"),
        Edge("val", "out", "11 · validated"),
        Edge("val", "deny", "claim unsupported", EDGE_FAIL),
    ]
    b = [
        Boundary("tb1", "TRUST BOUNDARY 1 · untrusted input", ["u", "q"], style="trust"),
        Boundary("tb2", "TRUST BOUNDARY 2 · application session", ["sess", "cls"], style="trust"),
        Boundary("tb3", "TRUST BOUNDARY 3 · agent, treated as untrusted", ["ag"], style="trust"),
        Boundary("tb4", "TRUST BOUNDARY 4 · owner's-rights procedures, the only trusted code", ["scope", "cons", "inj"], style="trust"),
        Boundary("tb5", "TRUST BOUNDARY 5 · data at rest", ["idx", "page"], style="trust"),
    ]
    return Page("6. Trust Boundaries (DFD)", n, b, e)


_ACTORS = [
    ("Coordinator", "Person"),
    ("Care Readiness App", "Streamlit"),
    ("Class A/B Classifier", "AI_CLASSIFY"),
    ("SAARTHI Agent", "Cortex Agent"),
    ("Tool Layer", "owner's rights"),
    ("Readiness Engine", "SQL rules"),
    ("Governed Store", "tables under RAP"),
    ("Answer Validator", "AI_FILTER"),
    ("Audit Store", "ANSWER_RUN"),
]

_MESSAGES = [
    (0, 1, "1 · ask 'what is missing before Thursday?'"),
    (1, 1, "2 · USE SECONDARY ROLES NONE"),
    (1, 2, "3 · classify intent"),
    (2, 3, "4 · forward Class B only"),
    (3, 3, "5 · plan tool calls · patient_id not in any schema"),
    (3, 4, "6 · get_readiness, search_patient_documents, get_timeline"),
    (4, 4, "7 · CURRENT_USER → PRACTITIONER → CARE_TEAM → CONSENT"),
    (4, 5, "8 · evaluate 5 gates as of known_as_of"),
    (5, 6, "9 · read harmonised events and verified assertions"),
    (6, 5, "10 · rows plus evidence ids"),
    (5, 4, "11 · gate outcomes plus rule versions"),
    (4, 3, "12 · facts only, never conclusions"),
    (3, 3, "13 · phrase answer from supplied facts (R1)"),
    (3, 7, "14 · draft answer plus evidence ids"),
    (7, 7, "15 · 6 checks including polarity via AI_FILTER"),
    (7, 1, "16 · validated answer, citations, known_as_of"),
    (1, 8, "17 · log evidence pointers, consent id, rule versions"),
    (1, 0, "18 · answer with clickable page-level evidence"),
]


def sequence() -> Page:
    lane_w, gap, top, first, step = 190, 70, 40, 150, 62
    height = first + step * len(_MESSAGES) + 40
    nodes = []
    centres = []
    for i, (name, tech) in enumerate(_ACTORS):
        x = 60 + i * (lane_w + gap)
        centres.append(x + lane_w // 2)
        nodes.append(
            Free(f"a{i}", label(name, tech), STYLE["lifeline"], x, top, lane_w, height)
        )
    edges = []
    for j, (src, dst, text) in enumerate(_MESSAGES):
        y = first + j * step
        if src == dst:
            x = centres[src]
            edges.append(PointEdge(x, y, x + 120, y + 26, text, EDGE + "rounded=1;"))
        else:
            edges.append(PointEdge(centres[src], y, centres[dst], y, text, EDGE_STRAIGHT))
    return Page("7. Dynamic - Question to Cited Answer", nodes, [], edges)


def extraction() -> Page:
    n = [
        Node("doc", label("Document on stage", "Data store", "SNOWFLAKE_SSE required (F9)"), "store", 1, 0),
        Node("parse", label("1 · TASK parse_documents", "Process: AI_PARSE_DOCUMENT LAYOUT page_split", "Dedup on SHA-256 file_hash"), "ai", 1, 1),
        Node("page", label("2 · DOC_PAGE", "Data store under row access policy", "text plus source_quality"), "store_det", 1, 2),
        Node("route", label("3 · Document-type routing", "Process", "lab · pathology · imaging<br/>discharge · claim"), "plain", 1, 3),
        Node("pa", label("4 · PASS A - extraction", "Process: AI_COMPLETE llama3.3-70b", "Type-specific prompt"), "ai", 1, 4),
        Node("safe", label("5 · is_safety_critical<br/>on CLINICAL_ONTOLOGY?", None, None), "diamond", 1, 5, height=140),
        Node("pb", label("6 · PASS B - verification", "Process: AI_COMPLETE llama3.1-70b", "DIFFERENT model family"), "ai", 2, 5),
        Node("cmp", label("7 · pass1_value equals<br/>pass2_value?", None, None), "diamond", 2, 6, height=140),
        Node("single", label("single_pass", "State", "Non-critical, one read accepted"), "state", 0, 6),
        Node("verified", label("verified", "State", "Value asserted"), "state_det", 1, 7),
        Node("conflict", label("conflicting", "State", "Value NOT asserted"), "state_bad", 2, 7),
        Node("failb", label("Pass B errored", "State", "Value NOT asserted · FAIL CLOSED"), "state_bad", 3, 7),
        Node("norm", label("8 · Normalisation", "Process", "UNIT_REGISTRY plus CLINICAL_ONTOLOGY"), "det", 0, 8),
        Node("gok", label("9 · Gate evaluates normally", None, None), "det", 1, 9),
        Node("gne", label("9 · Gate returns not_evaluated", None, "NOT fail — we do not know"), "state_bad", 2, 9, cspan=2),
    ]
    e = [
        Edge("doc", "parse"), Edge("parse", "page"), Edge("page", "route"),
        Edge("route", "pa"), Edge("pa", "safe"),
        Edge("safe", "single", "no"),
        Edge("safe", "pb", "yes"),
        Edge("pb", "cmp"),
        Edge("cmp", "verified", "agree"),
        Edge("cmp", "conflict", "differ"),
        Edge("pb", "failb", "error or timeout", EDGE_FAIL),
        Edge("single", "norm"), Edge("verified", "norm"),
        Edge("norm", "gok"),
        Edge("conflict", "gne"), Edge("failb", "gne"),
    ]
    return Page("8. Dynamic - Document to Verified Assertion (R7)", n, [], e)


def pipeline() -> Page:
    n = [
        Node("stg", label("Internal stage", "Data store: SNOWFLAKE_SSE", "PDF, JPEG, PNG"), "store", 0, 0),
        Node("raw", label("RAW_FHIR_BUNDLE", "Data store: VARIANT", "semi-structured JSON"), "store", 1, 0),
        Node("csv", label("Staging tables", "Data store", "structured CSV per source"), "store", 2, 0),
        Node("s1", label("Stream on directory table", "Change data capture"), "plain", 0, 1),
        Node("s2", label("Stream on FHIR staging", "Change data capture"), "plain", 1, 1),
        Node("s3", label("Stream on documents", "Change data capture"), "plain", 2, 1),
        Node("t1", label("parse_documents", "Task", "AI_PARSE_DOCUMENT"), "ai", 0, 2),
        Node("t2", label("flatten_fhir", "Task", "LATERAL FLATTEN"), "ai", 1, 2),
        Node("t3", label("extract_assertions", "Task", "R7 two-pass"), "ai", 2, 2),
        Node("t4", label("reconcile_evidence", "Task", "discordance detection"), "ai", 3, 2),
        Node("d1", label("DT_HARMONIZED_EVENTS", "Dynamic Table", "units, ANC, CrCl"), "det", 0, 3),
        Node("d2", label("DT_DOC_CHUNK", "Dynamic Table", "no row access policy"), "det", 1, 3),
        Node("d3", label("DT_REVIEW_QUEUE", "Dynamic Table"), "det", 2, 3),
        Node("d4", label("DT_SCHEME_ELIGIBILITY", "Dynamic Table"), "det", 3, 3),
        Node("d5", label("DT_TREATMENT_PLAN", "Dynamic Table"), "det", 4, 3),
        Node("t5", label("TASK_REFRESH_READINESS", "Task", "calls evaluate_gates procedure"), "det", 1, 4, cspan=2),
        Node("rs", label("READINESS_STATE", "Data store", "outcomes plus rule versions"), "store_det", 1, 5, cspan=2),
        Node("t6", label("TASK_NOTIFY", "Task", "blocker AND days_to_visit ≤ 3"), "det", 3, 5),
    ]
    e = [
        Edge("stg", "s1"), Edge("raw", "s2"), Edge("s1", "t1"), Edge("s2", "t2"),
        Edge("t1", "s3"), Edge("s3", "t3"), Edge("t3", "t4"),
        Edge("csv", "d1"), Edge("t2", "d1"), Edge("t4", "d1"), Edge("t1", "d2"),
        Edge("d1", "t5"), Edge("d3", "t5"), Edge("d4", "t5"), Edge("d5", "t5"),
        Edge("t5", "rs"), Edge("rs", "t6"),
    ]
    b = [
        Boundary("ing", "INGESTION · three paths, as the brief names them", ["stg", "raw", "csv"]),
        Boundary("cdc", "CHANGE DATA CAPTURE", ["s1", "s2", "s3"]),
        Boundary("tsk", "TASKS · the only place AI functions may run", ["t1", "t2", "t3", "t4"]),
        Boundary("dyn", "DYNAMIC TABLES · deterministic only", ["d1", "d2", "d3", "d4", "d5"]),
    ]
    return Page("11. Pipeline Topology", n, b, e)


def class_routing() -> Page:
    n = [
        Node("q", label("Incoming question", "Data flow"), "plain", 1, 0),
        Node("cls", label("Classify", "AI_CLASSIFY"), "ai", 1, 1),
        Node("amb", label("Ambiguous?", None, None), "diamond", 2, 1, height=130),
        Node("a", label("CLASS A - clinical judgment", None, "should she proceed · is this safe · prognosis<br/>dosing · what would you do"), "enforce", 0, 2),
        Node("b", label("CLASS B - record and coverage state", None, "what do we have · what is missing<br/>what contradicts what · is this authorised"), "det", 2, 2),
        Node("ref", label("REFUSED for every role", "Enforcement point", "including the treating oncologist"), "enforce", 0, 3),
        Node("pkt", label("EVIDENCE_PACKET", None, "addressed to the named practitioner<br/>via nmc_registration_no"), "plain", 0, 4),
        Node("ans", label("Answered deterministically", None, "with page-level citations"), "det", 2, 3),
    ]
    e = [
        Edge("q", "cls"),
        Edge("cls", "a", "Class A"),
        Edge("cls", "b", "Class B"),
        Edge("cls", "amb"),
        Edge("amb", "a", "yes · default to the safe side"),
        Edge("a", "ref"), Edge("ref", "pkt"), Edge("b", "ans"),
    ]
    return Page("14. Decision - Class A/B Routing", n, [], e)


def gate_outcomes() -> Page:
    n = [
        Node("in", label("Patient, encounter, known_as_of", "Data flow"), "plain", 1, 0),
        Node("proc", label("evaluate_gates", "Process: SQL procedure", "Single source of truth. No model."), "det", 1, 1),
        Node("spec", label("Resolve precedence", "Process", "most specific rule wins<br/>per gate and concept"), "det", 1, 2),
        Node("ev", label("Is the required evidence<br/>present and verified?", None, None), "diamond", 1, 3, height=140),
        Node("cf", label("Do two sources<br/>disagree?", None, None), "diamond", 1, 4, height=140),
        Node("th", label("Does the value meet the<br/>versioned threshold?", None, None), "diamond", 1, 5, height=140),
        Node("o3", label("not_evaluated", "Outcome", "ACTION · obtain this evidence"), "state", 0, 3),
        Node("o4", label("conflicting", "Outcome", "ACTION · a human must reconcile"), "state", 0, 4),
        Node("o2", label("fail", "Outcome", "ACTION · fix this thing"), "state_bad", 0, 5),
        Node("o1", label("pass", "Outcome", "no action"), "state_det", 2, 5),
        Node("bring", label("Bring-list", None, "addressed to a named person"), "det", 0, 6),
        Node("rs", label("READINESS_STATE", "Data store", "with the rule version that decided it"), "store_det", 2, 6),
    ]
    e = [
        Edge("in", "proc"), Edge("proc", "spec"), Edge("spec", "ev"),
        Edge("ev", "o3", "no · missing, unreadable,<br/>or R7 conflicting"),
        Edge("ev", "cf", "yes"),
        Edge("cf", "o4", "yes"),
        Edge("cf", "th", "no"),
        Edge("th", "o1", "yes"),
        Edge("th", "o2", "no"),
        Edge("o2", "bring"), Edge("o3", "bring"), Edge("o4", "bring"),
        Edge("o1", "rs"), Edge("bring", "rs"),
    ]
    return Page("15. Decision - Gate Outcomes", n, [], e)


PAGES = [trust_boundaries, sequence, extraction, pipeline, class_routing, gate_outcomes]
