"""Generates the Low Level Design diagram (05-lld.drawio).

Written as a generator rather than by hand because the LLD contains ~40 boxes of
tabular content; hand-authoring that much mxGraph XML is error-prone and hard to
revise. Re-run this script after editing the content dictionaries below.

Run: python3 build_lld.py
"""

W = 2120
cells = []
_id = [0]


def nid(p="c"):
    _id[0] += 1
    return f"{p}{_id[0]}"


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def box(x, y, w, h, value, style):
    v = (str(value).replace("&", "&amp;").replace("<", "&lt;")
         .replace(">", "&gt;").replace('"', "&quot;"))
    cells.append(f'<mxCell id="{nid()}" value="{v}" style="{style}" vertex="1" '
                 f'parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" '
                 f'as="geometry" /></mxCell>')


def text(x, y, w, h, value, size=10, color="#1F2937", bold=False, italic=False, align="left"):
    st = (f"text;html=1;whiteSpace=wrap;overflow=block;strokeColor=none;fillColor=none;"
          f"align={align};verticalAlign=top;fontSize={size};fontColor={color};")
    if bold:
        st += "fontStyle=1;"
    elif italic:
        st += "fontStyle=2;"
    box(x, y, w, h, value, st)


def panel(x, y, w, h, stroke="#E2E8F0"):
    box(x, y, w, h, "", f"rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;"
                        f"strokeColor={stroke};dashed=1;")


def card(x, y, w, h, title, lines, stroke="#2563EB", mono=False):
    body = "<br>".join(
        f'<font color="#64748B">{l}</font>' if not l.startswith("*")
        else f'<font color="#B45309">{l[1:]}</font>' for l in lines)
    val = f"<b>{title}</b><br>{body}"
    st = (f"rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor={stroke};"
          f"fontSize=9;fontColor=#1F2937;align=left;verticalAlign=top;spacingLeft=8;"
          f"spacingTop=4;spacingRight=6;")
    box(x, y, w, h, val, st)


# ---------------------------------------------------------------- section A
TABLES = [
    ("PATIENT", "#64748B", [
        "patient_id  PK", "tenant_id  PK", "abha_ref", "created_at"]),
    ("ID_MAP", "#B45309", [
        "map_id  PK", "patient_id  FK", "source_system", "source_patient_id",
        "link_status", "  abha_linked | verified | quarantined",
        "link_evidence", "linked_by", "linked_at"]),
    ("CONSENT", "#B45309", [
        "consent_id  PK", "patient_id  FK", "purpose", "provider_id",
        "date_from / date_to", "expires_at", "status",
        "  active | expired | revoked", "artefact_ref", "granted_at / revoked_at"]),
    ("ENCOUNTER", "#64748B", [
        "encounter_id  PK", "patient_id  FK", "org_id", "scheduled_time",
        "event_time", "encounter_type", "status", "cycle_number"]),
    ("CLINICAL_EVENT", "#64748B", [
        "event_id  PK", "patient_id  FK", "encounter_id  FK",
        "event_type", "  diagnosis|lab|imaging|drug",
        "code_system / code / display", "value_num / value_unit",
        "status", "  ordered|administered|billed",
        "specimen_id / accession_id",
        "*event_time", "*source_recorded_at", "*ingested_at", "source_system"]),
    ("COVERAGE", "#64748B", [
        "coverage_id  PK", "patient_id  FK", "payer_type",
        "  scheme | insurer | self", "member_id", "valid_from / valid_to"]),
    ("AUTHORIZATION", "#64748B", [
        "auth_id  PK", "patient_id  FK", "coverage_id  FK", "service_code",
        "requested_for_date", "status", "  pending|approved|rejected",
        "amount", "decided_at", "source_system", "ingested_at"]),
    ("DOCUMENT", "#64748B", [
        "doc_id  PK", "patient_id  FK  (null = rulebook)",
        "scope", "  patient | rulebook", "doc_type", "version",
        "supersedes_doc_id  FK", "file_hash", "accession_id",
        "signed_at / effective_at", "ingested_at", "page_count"]),
    ("DOC_PAGE", "#64748B", [
        "doc_id  PK FK", "page_index  PK", "text", "char_count"]),
    ("DOC_CHUNK", "#64748B", [
        "chunk_id  PK", "doc_id  FK", "page_index", "char_start / char_end",
        "text", "embedding  VECTOR(1024)"]),
    ("ASSERTION", "#2563EB", [
        "assertion_id  PK", "patient_id  FK", "doc_id  FK", "page_index",
        "*char_start / char_end", "subject / predicate",
        "value_text / value_num / value_unit", "negated",
        "*missingness_state", "  present|pending|not_received",
        "  |conflicting|unreadable|superseded",
        "extractor_version", "created_at"]),
    ("EVIDENCE_LINK", "#2563EB", [
        "link_id  PK", "assertion_id  FK", "target_type",
        "  doc_page | table_row", "target_id", "relation",
        "  supports|conflicts_with|supersedes"]),
    ("REVIEW_ISSUE", "#64748B", [
        "issue_id  PK", "patient_id  FK", "encounter_id  FK",
        "rule_id / rule_version", "gate",
        "state", "  open|evidence_received|closed",
        "reason", "evidence_ids  ARRAY", "opened_at / closed_at"]),
    ("TASK", "#64748B", [
        "task_id  PK", "issue_id  FK", "owner", "state", "decision", "reason",
        "due_at", "*idempotency_key", "actor", "created_at / updated_at"]),
    ("ANSWER_RUN", "#64748B", [
        "run_id  PK", "patient_id / role / tenant_id", "question",
        "*known_as_of", "answer_status",
        "  supported|partial|insufficient",
        "claims  JSON [{text, evidence_ids}]", "tool_calls  JSON",
        "model_version", "validation_result  JSON", "latency_ms", "created_at"]),
    ("ACCESS_LOG", "#64748B", [
        "log_id  PK", "tenant_id", "actor / role", "action",
        "target_type / target_id", "at"]),
]

# ---------------------------------------------------------------- section B
MAPPING = [
    ("Blood count from the lab system",
     "HL7 v2 ORU^R01  OBX segment",
     "CLINICAL_EVENT",
     "event_type=lab · code=LOINC 6690-2 · value_num=OBX-5 · value_unit=OBX-6 · "
     "event_time=OBX-14 · source_recorded_at=MSH-7 · status=administered",
     "Unit string normalised to 10^9/L. A result with no unit is stored unreadable, never guessed."),
    ("Pathology report PDF",
     "file on a stage + AI_PARSE_DOCUMENT",
     "DOCUMENT + DOC_PAGE + ASSERTION",
     "doc_type=pathology · accession_id parsed from the header · one DOC_PAGE per page · "
     "ASSERTION per finding with char offsets",
     "If the report says an addendum follows, an ASSERTION with missingness_state=pending is written."),
    ("Final addendum arriving later",
     "same accession, new file",
     "DOCUMENT.supersedes_doc_id",
     "new version row · old version kept · EVIDENCE_LINK relation=supersedes",
     "The older statement is marked superseded, never deleted. Historical answers still resolve."),
    ("Pre-authorisation from the scheme portal",
     "portal export or NHCX message",
     "AUTHORIZATION",
     "service_code · requested_for_date · status · decided_at · source_system=TMS",
     "The table's status and an approval letter's text are compared. If they differ, both are kept."),
    ("Approval letter PDF from an insurer",
     "upload or payer feed",
     "DOCUMENT + ASSERTION",
     "ASSERTION subject=authorization predicate=status value_text=approved, "
     "linked to AUTHORIZATION row",
     "This is the classic conflict: table says pending, letter says approved. Surfaced, not resolved."),
    ("Record from the previous hospital",
     "national network, FHIR R4 bundle",
     "ENCOUNTER + CLINICAL_EVENT + DOCUMENT",
     "source_system=<that hospital> · ID_MAP row created · CONSENT row must already exist",
     "Fetched only under a valid consent slip. No slip, no fetch — and the screen says so."),
    ("Photo of a paper report",
     "family upload, JPEG/PDF",
     "DOCUMENT (scope=patient)",
     "parsed the same way · confidence of parse recorded · patient_id from the uploading session",
     "Marked as unverified provenance until a person confirms it belongs to this patient."),
    ("Government / quality / privacy document",
     "public PDF, versioned by effective date",
     "DOCUMENT (scope=rulebook, patient_id NULL)",
     "indexed into the rulebook search service only",
     "Physically separate index. Can never appear in a patient-scoped ranked list."),
]

# ---------------------------------------------------------------- section C
MODELS = [
    ("Page parser", "AI_PARSE_DOCUMENT", [
        "mode = LAYOUT, page_split = TRUE",
        "in: staged PDF / image  →  out: text per page, tables as markdown",
        "runs once per file at ingestion; result cached by file_hash",
        "*failure: page marked unreadable, file parked, never silently skipped"]),
    ("Fact extractor", "Claude · JSON schema mode", [
        "temperature 0, strict schema, retries 2",
        "in: one page of text  →  out: typed ASSERTION rows + char offsets",
        "schema forbids free text; every field is enumerated or numeric",
        "*offsets are re-checked against the page; a non-matching span is rejected"]),
    ("Embeddings", "arctic-embed-l-v2.0", [
        "1024 dimensions, chunk ≈ 512 tokens with overlap",
        "two separate indexes: patient scope and rulebook scope",
        "*rebuilt on document supersession so stale text stops being retrievable"]),
    ("Reranker", "Cortex Search built-in", [
        "hybrid keyword + vector, then rerank",
        "top-k 8 for patient scope, top-k 5 for rulebooks",
        "*scope filter is applied before the search call, never after"]),
    ("Question classifier", "small LLM + deterministic rules", [
        "in: the user's question  →  out: class A (medical judgment) or B (record state)",
        "rules run first and win; the model only handles the ambiguous remainder",
        "*class A is refused for every role, including doctors"]),
    ("Tool router", "Cortex Agent", [
        "tool list is fixed at six; no dynamic tool registration",
        "temperature 0, max 6 tool calls per question",
        "*has no database credential of its own — every tool is a bounded server function"]),
    ("Answer writer", "Claude via Cortex COMPLETE", [
        "in: retrieved facts + evidence IDs only  →  out: sentences + claim/evidence map",
        "system prompt forbids any fact not present in the supplied context",
        "*the prompt is not the control — the proof checker below is"]),
    ("Proof checker", "deterministic code · no model", [
        "for each claim: evidence exists · in scope · version matches · typed check passes",
        "number, date, status and unit comparisons done in code",
        "*a claim that fails is deleted and the deletion is written to ANSWER_RUN"]),
]

# ---------------------------------------------------------------- section D
TOOLS = [
    ("get_patient_facts", "(patient_id, domain, known_as_of) → rows[]",
     "parameterised SQL. Scope injected server-side. Returns only rows with "
     "ingested_at ≤ known_as_of."),
    ("get_readiness", "(patient_id, encounter_id, known_as_of) → gates[]",
     "each gate: {gate, outcome, rule_id, rule_version, inputs[], evidence_ids[]}. "
     "outcome ∈ pass | fail | not_evaluated | conflicting."),
    ("search_patient_documents", "(patient_id, query, known_as_of) → passages[]",
     "Cortex Search, patient index. Mandatory filters: tenant, patient, version, as-of. "
     "Returns doc_id, page_index, char range, text."),
    ("search_reference_documents", "(query, jurisdiction, effective_date) → passages[]",
     "rulebook index only. Carries no patient identifier at all, by construction."),
    ("cohort_query", "(question) → aggregate + query_id",
     "Cortex Analyst over the semantic view. Returns the metric definition, filters and "
     "supporting row set, not just a number."),
    ("create_review_task", "(issue_id, owner, due_at, idempotency_key) → task_id",
     "the only write path. Requires an explicit user action. Re-sending the same "
     "idempotency_key returns the existing task rather than creating a second one."),
]

# ---------------------------------------------------------------- section E
SCREENS = [
    ("1 · Review queue", "who needs attention before their visit", [
        "row per upcoming encounter, sorted by days-to-visit then severity",
        "columns: patient · visit date · open gates · owner · age of oldest gap",
        "each gate chip shows its outcome colour and opens its rule + evidence",
        "filter: my patients / unassigned / overdue",
        "*score is labelled 'documentation & coverage review priority' — never 'risk'"]),
    ("2 · Patient 360", "the two-minute answer, then the detail", [
        "TOP — readiness strip: five gates, one line each, no scrolling required",
        "then, in the order a doctor actually reads:",
        "  pathology & biomarkers (version, superseded badge, page link)",
        "  imaging & scans (staleness vs protocol)",
        "  bloods (value, unit, collected-at, source lab)",
        "  history: encounters, regimen, cycle number",
        "right rail: coverage status, approvals, open conflicts",
        "*a gate with no data renders not_evaluated in neutral grey, never green"]),
    ("3 · Ask + evidence", "one cited answer, proof beside it", [
        "question box with suggested questions for the current patient",
        "answer pane: each sentence carries its evidence chips inline",
        "clicking a chip opens the evidence drawer at the exact page, line highlighted",
        "header shows answer_status and the as-of time the answer was bound to",
        "*medical-judgment questions return a refusal card naming the treating team"]),
    ("4 · Chase & close", "the gap becomes work that finishes", [
        "issue detail: rule, version, why it fired, all supporting evidence",
        "assign owner, set due date, add a note",
        "when new evidence arrives the issue flips to 'evidence received — review pending'",
        "accept / reject with a mandatory reason; both are recorded with actor and time",
        "*acknowledging never alters a source fact; it records a human decision about it"]),
    ("Family view (role-scoped)", "read-only, derived, never generative", [
        "renders only issues a coordinator has already reviewed and released",
        "shows a document checklist: what to bring, why, and by when",
        "no clinical values, no free-text answers, no evidence drawer",
        "*asking a medical question returns the same refusal for every role"]),
]


def build():
    y = 100
    text(40, 22, 1600, 30, "Low Level Design — schema, mappings, models, contracts and screens",
         size=22, bold=True)
    text(40, 52, 1700, 20,
         "Everything the high level design says exists, specified to the level someone can build "
         "it from. Read alongside 04-hld-full-stack.", size=12, color="#64748B")

    # ---- A: data model
    text(40, y, 900, 20, "A · DATA MODEL — every table, its keys, and the fields that carry meaning",
         size=13, bold=True)
    text(40, y + 20, 1700, 16,
         "PK = primary key · FK = foreign key · amber fields are the ones that make the system "
         "safe rather than merely functional.", size=10, color="#B45309", italic=True)
    ty = y + 46
    col_x = [40, 460, 880, 1300, 1720]
    col_y = [ty] * 5
    for i, (name, stroke, cols) in enumerate(TABLES):
        c = i % 5
        h = 26 + 11 * len(cols)
        card(col_x[c], col_y[c], 400, h, name, cols, stroke=stroke)
        col_y[c] += h + 14
    y = max(col_y) + 16

    # ---- B: source mapping
    text(40, y, 1200, 20, "B · WHERE EACH FIELD COMES FROM — source to target mapping",
         size=13, bold=True)
    text(40, y + 20, 1700, 16,
         "The join between 'a system sent us something' and 'a row exists that an answer can cite'.",
         size=10, color="#64748B", italic=True)
    my = y + 44
    hdr = ["What arrives", "In what form", "Becomes", "Field mapping", "Rule that protects it"]
    widths = [300, 300, 250, 620, 610]
    hx = 40
    for h_, w_ in zip(hdr, widths):
        text(hx + 8, my, w_ - 16, 16, h_, size=10, bold=True)
        hx += w_
    my += 20
    for row in MAPPING:
        hx = 40
        h = 54
        for j, (val, w_) in enumerate(zip(row, widths)):
            col = "#B45309" if j == 4 else "#1F2937" if j < 3 else "#64748B"
            st = (f"rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#E2E8F0;"
                  f"fontSize=9;fontColor={col};align=left;verticalAlign=top;spacingLeft=8;"
                  f"spacingTop=5;spacingRight=6;")
            box(hx, my, w_, h, val, st)
            hx += w_
        my += h
    y = my + 26

    # ---- C: models
    text(40, y, 1200, 20, "C · THE MODELS — exact job, settings, and what happens when each fails",
         size=13, bold=True)
    text(40, y + 20, 1700, 16,
         "No model produces a status, a number, or a gate outcome. Those come from SQL rules. "
         "Amber lines are the failure behaviour.", size=10, color="#B45309", italic=True)
    cy = y + 44
    for i, (name, impl, lines) in enumerate(MODELS):
        cx = 40 + (i % 4) * 520
        if i % 4 == 0 and i:
            cy += 116
        title = f"{name}  —  {impl}"
        card(cx, cy, 500, 104, title, lines, stroke="#2F7D4F")
    y = cy + 132

    # ---- D: tool contracts
    text(40, y, 1200, 20, "D · TOOL CONTRACTS — the only six ways into the data",
         size=13, bold=True)
    text(40, y + 20, 1700, 16,
         "Scope is bound by the server before any of these run. The model chooses which to call; "
         "it cannot change what they are allowed to see.", size=10, color="#64748B", italic=True)
    dy = y + 44
    for name, sig, note in TOOLS:
        val = (f'<b>{name}</b>  <font color="#2F7D4F">{sig}</font>'
               f'<br><font color="#64748B">{note}</font>')
        st = ("rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#2563EB;"
              "fontSize=9;fontColor=#1F2937;align=left;verticalAlign=middle;spacingLeft=10;")
        box(40, dy, 2040, 44, val, st)
        dy += 50
    y = dy + 20

    # ---- E: dashboard
    text(40, y, 1200, 20, "E · THE DASHBOARD — every screen, what is on it, and in what order",
         size=13, bold=True)
    text(40, y + 20, 1700, 16,
         "Screen 2's ordering is not a preference: it follows the order clinicians are documented "
         "to read a chart in. Amber lines are the safety rules.", size=10, color="#B45309",
         italic=True)
    sy = y + 44
    for i, (name, sub, lines) in enumerate(SCREENS):
        cx = 40 + (i % 3) * 700
        if i % 3 == 0 and i:
            sy += 190
        card(cx, sy, 680, 178, f"{name}  —  {sub}", lines, stroke="#2563EB")
    y = sy + 206

    box(40, y, 2040, 44,
        "<b>Ordering rule for every screen:</b>  the answer first, the evidence one click "
        "away, the raw record two.  Nothing on any screen is generated without a citation "
        "that resolves.  <b>Synthetic patient data only — no real medical record is used "
        "anywhere in this system.</b>",
        "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#E2E8F0;fontSize=10;"
        "fontColor=#64748B;align=left;spacingLeft=12;")
    return y + 80


height = build()
xml = (f'<mxGraphModel dx="{W}" dy="{height}" grid="0" gridSize="10" guides="1" tooltips="1" '
       f'connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="{W}" '
       f'pageHeight="{height}" math="0" shadow="0" background="#FFFFFF" adaptiveColors="0">'
       f'<root><mxCell id="0" /><mxCell id="1" parent="0" />'
       + "".join(cells) + "</root></mxGraphModel>")

with open("05-lld.drawio", "w") as f:
    f.write(xml)
print(f"wrote 05-lld.drawio  ({len(cells)} cells, {W}x{height})")
