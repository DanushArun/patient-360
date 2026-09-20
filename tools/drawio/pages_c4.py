"""C4 pages: system landscape, context, container, component, deployment."""
from __future__ import annotations

from .model import EDGE, Boundary, Edge, Node, Page, label


def landscape() -> Page:
    n = [
        Node("coord", label("Care Coordinator", "Person", "Assembles the record<br/>before a treatment visit"), "person", 0, 0, height=140),
        Node("onc", label("Treating Oncologist", "Person", "Accountable under<br/>NMC registration"), "person", 1, 0, height=140),
        Node("nav", label("Patient Navigator", "Person", "Hospital-appointed professional.<br/>Coordinates care across facilities."), "person", 2, 0, height=140),
        Node("saarthi", label("SAARTHI", "Software System", "Care-readiness and evidence copilot.<br/>Answers record-state questions with citations."), "focus", 1, 1),
        Node("his", label("Hospital Information System", "Software System", "Admissions, encounters, orders"), "system", 0, 2),
        Node("lis", label("Laboratory Information System", "Software System", "Results as PDF and structured feeds"), "system", 1, 2),
        Node("pacs", label("PACS / Radiology", "Software System", "Imaging reports"), "system", 2, 2),
        Node("abdm", label("ABDM / ABHA", "External System", "National health identity<br/>and consent framework"), "ext", 0, 3),
        Node("nhcx", label("NHCX / Payer", "External System", "Claims, pre-authorisation, PM-JAY"), "ext", 1, 3),
        Node("guide", label("Guideline publishers", "External System", "NCCN, FDA, ESMO, IRDAI, NMC, DPDP"), "ext", 2, 3),
    ]
    e = [
        Edge("coord", "saarthi", "asks what is missing<br/>before a visit"),
        Edge("onc", "saarthi", "reviews evidence,<br/>receives evidence packets"),
        Edge("nav", "saarthi", "asks what to bring,<br/>tracks referral documents"),
        Edge("his", "saarthi", "encounters, orders<br/>[CSV, FHIR R4]"),
        Edge("lis", "saarthi", "results, reports<br/>[PDF, FHIR R4]"),
        Edge("pacs", "saarthi", "imaging reports<br/>[PDF]"),
        Edge("abdm", "saarthi", "identity and consent<br/>artefacts [FHIR R4]"),
        Edge("nhcx", "saarthi", "coverage and authorisation<br/>state [FHIR R4]"),
        Edge("guide", "saarthi", "reference text<br/>[PDF]"),
    ]
    b = [Boundary("eb", "Enterprise boundary · Hospital network", ["saarthi", "his", "lis", "pacs"])]
    return Page("1. System Landscape", n, b, e)


def context() -> Page:
    n = [
        Node("coord", label("Care Coordinator", "Person", "Prepares the record before<br/>a treatment visit. Primary user."), "person", 0, 0, height=150),
        Node("onc", label("Treating Oncologist", "Person", "Makes every clinical decision.<br/>Named via NMC registration."), "person", 1, 0, height=150),
        Node("nav", label("Patient Navigator", "Person", "Hospital-appointed professional.<br/>Restricted view, institutionally accountable."), "person", 2, 0, height=150),
        Node("judge", label("Hackathon Judge", "Person", "Read-only. Reproduces<br/>every claim."), "person", 3, 0, height=150),
        Node("saarthi", label("SAARTHI", "Software System", "Unifies structured, semi-structured and unstructured records into a patient<br/>and member 360. Answers record-state and coverage questions with<br/>page-level citations. Refuses clinical judgment."), "focus", 1, 1, cspan=2),
        Node("src", label("Clinical source systems", "External System", "HIS, LIS, PACS across<br/>multiple facilities"), "ext", 0, 2),
        Node("abdm", label("ABDM / ABHA", "External System", "Identity and consent"), "ext", 1, 2),
        Node("payer", label("Payer / NHCX", "External System", "Coverage, authorisation,<br/>PM-JAY schemes"), "ext", 2, 2),
        Node("refc", label("Regulatory corpus", "External System", "NCCN, FDA labels,<br/>IRDAI, NMC, DPDP"), "ext", 3, 2),
        Node("ticket", label("Ticketing system", "External System", "Receives review tasks"), "ext", 3, 3),
    ]
    e = [
        Edge("coord", "saarthi", "asks what is missing,<br/>receives a bring-list<br/>[Streamlit over HTTPS]"),
        Edge("onc", "saarthi", "reviews cited evidence<br/>and gate outcomes<br/>[Streamlit over HTTPS]"),
        Edge("nav", "saarthi", "asks what to bring,<br/>tracks referral documents<br/>[Streamlit over HTTPS]"),
        Edge("judge", "saarthi", "reproduces security<br/>and eval claims<br/>[read-only role]"),
        Edge("src", "saarthi", "sends records<br/>[CSV, FHIR R4, PDF, JPEG]"),
        Edge("abdm", "saarthi", "identity and consent<br/>artefacts [FHIR R4]"),
        Edge("payer", "saarthi", "coverage and authorisation<br/>state [FHIR R4]"),
        Edge("refc", "saarthi", "reference text [PDF]"),
        Edge("saarthi", "ticket", "creates review task,<br/>idempotent [MCP]"),
    ]
    return Page("2. System Context (C4 L1)", n, [], e)


def container() -> Page:
    n = [
        Node("user", label("Coordinator / Oncologist / Navigator", "Person", "Authenticated Snowflake user, institutionally accountable"), "person", 1, 0, height=140),
        Node("app", label("Care Readiness App", "Container: Streamlit in Snowflake", "6 screens. Ask and Evidence at the centre.<br/>Runs USE SECONDARY ROLES NONE per session."), "system", 0, 1),
        Node("cls", label("Class A/B Classifier", "Container: AI_CLASSIFY", "Routes clinical-judgment questions to<br/>refusal before any retrieval happens."), "ai", 1, 1),
        Node("agent", label("SAARTHI Agent", "Container: Cortex Agent → claude-opus-4-8", "Plans tool calls, ranks passages, phrases answers.<br/>8 generic tools, 4 skills. Cannot see patient_id."), "ai", 2, 1),
        Node("valid", label("Answer Validator", "Container: SQL procedure with AI_FILTER", "6 checks. Strips any claim not supported<br/>by cited evidence. Fails closed."), "enforce", 3, 1),
        Node("engine", label("Evidence and Readiness Engine", "Container: SQL procedures + Dynamic Tables", "16 versioned rules over 5 gates. Decides<br/>every status, number and comparison."), "det", 0, 2),
        Node("tools", label("Tool Layer", "Container: 11 SQL procedures, EXECUTE AS OWNER", "Derives scope from CURRENT_USER. Checks consent at query time.<br/>Returns facts, never conclusions."), "enforce", 1, 2, cspan=2),
        Node("core", label("Governed Clinical Store", "Container: tables + row access policy", "25 tables. Identity, consent, binding, clinical<br/>events, coverage, documents, assertions."), "store", 0, 3, height=160),
        Node("pidx", label("Patient Document Index", "Container: Cortex Search service", "Chunks of patient documents.<br/>Returns IDs only, never content."), "store", 1, 3, height=160),
        Node("ridx", label("Reference Document Index", "Container: Cortex Search service", "Chunks of regulatory text. Physically<br/>separate service. No patient data."), "store", 2, 3, height=160),
        Node("sem", label("Semantic View", "Container: Cortex Analyst + 6 VQRs", "Cohort questions in<br/>natural language."), "store", 3, 3, height=160),
        Node("audit", label("Audit Store", "Container: ANSWER_RUN table", "Evidence pointers, consent id,<br/>rule versions. Never answer text."), "store", 0, 4, height=150),
        Node("extract", label("Extraction Pipeline", "Container: Tasks with AI_PARSE_DOCUMENT + AI_COMPLETE", "Parses documents, extracts typed assertions<br/>under R7 two-pass verification."), "ai", 2, 4, cspan=2),
        Node("srcsys", label("Clinical source systems", "External System", "HIS, LIS, PACS"), "ext", 4, 4),
        Node("mcp", label("MCP Server", "External System", "2 read-only tools"), "ext", 4, 1),
        Node("ticket", label("Ticketing system", "External System", "Review tasks"), "ext", 4, 2),
    ]
    e = [
        Edge("user", "app", "asks a question<br/>[HTTPS]"),
        Edge("app", "cls", "classifies intent<br/>before retrieval [SQL]"),
        Edge("cls", "agent", "forwards Class B<br/>questions only [SQL]"),
        Edge("agent", "tools", "calls tools · no patient_id<br/>in any schema [SQL]"),
        Edge("agent", "valid", "submits draft answer<br/>with evidence ids [SQL]"),
        Edge("valid", "app", "returns validated answer<br/>or strips the claim [SQL]"),
        Edge("tools", "core", "reads scoped rows<br/>[SQL, under RAP]"),
        Edge("tools", "engine", "requests gate outcomes<br/>as of a timestamp [SQL]"),
        Edge("tools", "pidx", "searches with server-injected<br/>filter [Cortex Search]"),
        Edge("tools", "ridx", "searches reference text<br/>by jurisdiction"),
        Edge("tools", "sem", "answers cohort<br/>questions [Analyst]"),
        Edge("app", "audit", "logs evidence pointers<br/>and consent id [SQL]"),
        Edge("srcsys", "extract", "delivers documents and bundles<br/>[Stage, CSV, FHIR R4]"),
        Edge("extract", "core", "writes verified<br/>assertions [SQL]"),
        Edge("extract", "pidx", "feeds chunks<br/>[Dynamic Table]"),
        Edge("mcp", "tools", "invokes read-only tools<br/>[MCP over HTTPS]"),
        Edge("tools", "ticket", "creates review task<br/>[MCP]"),
    ]
    members = ["app", "cls", "agent", "valid", "engine", "tools", "core", "pidx", "ridx", "sem", "audit", "extract"]
    return Page("3. Containers (C4 L2)", n, [Boundary("sb", "System boundary · SAARTHI on Snowflake", members)], e)


def component() -> Page:
    n = [
        Node("tools", label("Tool Layer", "Container: SQL procedures", "Calls the engine with a patient, an encounter<br/>and a known_as_of timestamp"), "enforce", 1, 0),
        Node("gates", label("evaluate_gates", "Component: SQL procedure, EXECUTE AS OWNER", "Single source of truth for readiness. Takes known_as_of as a<br/>parameter — which is why it cannot be a Dynamic Table."), "det", 1, 1, cspan=2),
        Node("prec", label("Rule Precedence Resolver", "Component: SQL over RULE.specificity", "The most specific matching rule suppresses more<br/>general ones for the same gate and concept."), "det", 0, 2),
        Node("harm", label("DT_HARMONIZED_EVENTS", "Component: Dynamic Table", "Normalises units with plausibility rejection. Computes ANC<br/>from a differential and Cockcroft-Gault CrCl."), "det", 1, 2),
        Node("recon", label("Evidence Reconciler", "Component: SQL procedure", "Detects supersession, cross-source conflict<br/>and discordance across specimens."), "det", 2, 2),
        Node("rules", label("RULE catalog", "Component: Snowflake table, versioned", "16 rules over 6 specialties. Threshold, severity,<br/>guideline reference and provenance per rule."), "store_det", 0, 3, height=160),
        Node("bring", label("Bring-List Deriver", "Component: SQL over REFERRAL + outcomes", "Turns every fail and not_evaluated into<br/>a concrete action for a named person."), "det", 1, 3, height=160),
        Node("state", label("READINESS_STATE", "Component: Snowflake table", "Materialised gate outcomes with the<br/>rule version that produced each one."), "store_det", 2, 3, height=160),
        Node("refresh", label("TASK_REFRESH_READINESS", "Container: Snowflake Task", "Materialises the procedure<br/>on a 5-minute schedule"), "system", 3, 1),
        Node("core", label("Governed Clinical Store", "Container: Snowflake tables", "Assertions and clinical events"), "store", 3, 2),
        Node("ridx", label("Reference Document Index", "Container: Cortex Search", "Guideline text cited by a rule"), "store", 3, 3, height=160),
    ]
    e = [
        Edge("tools", "gates", "requests gate outcomes<br/>as of a timestamp [SQL]"),
        Edge("gates", "prec", "resolves which<br/>rule applies [SQL]"),
        Edge("prec", "rules", "reads versioned thresholds<br/>and severity [SQL]"),
        Edge("gates", "harm", "reads normalised,<br/>comparable values [SQL]"),
        Edge("harm", "core", "reads raw events and<br/>verified assertions [SQL]"),
        Edge("gates", "recon", "asks whether evidence conflicts<br/>or was superseded [SQL]"),
        Edge("recon", "core", "reads assertions and<br/>evidence links [SQL]"),
        Edge("gates", "bring", "passes fail and<br/>not_evaluated outcomes [SQL]"),
        Edge("refresh", "gates", "calls on a schedule<br/>[Snowflake Task]"),
        Edge("gates", "state", "writes outcomes with<br/>rule versions [SQL]"),
        Edge("rules", "ridx", "references the guideline text<br/>behind a threshold [doc id]"),
    ]
    members = ["gates", "prec", "harm", "recon", "rules", "bring", "state"]
    b = [Boundary("cb", "Container boundary · Evidence and Readiness Engine", members)]
    return Page("4. Components - Readiness Engine (C4 L3)", n, b, e)


def deployment() -> Page:
    n = [
        Node("ui", label("Care Readiness App UI", "Container: Streamlit in Snowflake", "Served by Snowflake.<br/>No client-side data persistence."), "system", 0, 0),
        Node("rt", label("Procedures and Tasks", "Container: SQL and Snowpark", "11 procedures · 6 Tasks · 5 Dynamic Tables"), "system", 0, 1, cspan=2),
        Node("srch", label("2 Cortex Search services", "Container: managed", "patient index + reference index,<br/>physically separate per R6"), "system", 2, 1),
        Node("agt", label("SAARTHI_AGENT", "Container: Cortex Agent", "orchestration auto resolves to<br/>claude-opus-4-8, 1M context"), "ai", 3, 1),
        Node("tbl", label("Governed tables", "Container: Snowflake tables", "25 built, 7 designed-only. RAP patient_scope<br/>keys on CURRENT_USER. 2 masking policies."), "store", 0, 2, height=170),
        Node("stg", label("3 internal stages", "Container: ENCRYPTION = SNOWFLAKE_SSE", "PATIENT_DOCS · REFERENCE_DOCS · SKILLS.<br/>SSE is mandatory for AI functions."), "store", 1, 2, height=170),
        Node("mdl", label("Inference endpoints", "Container: llama3.3-70b, llama3.1-70b, llama3.1-8b", "extraction pass A · verification pass B · classification"), "ai", 2, 2, cspan=2, height=170),
        Node("roles", label("Role hierarchy and policies", "Container: RBAC + row access policy", "5 roles: APP, COORDINATOR, ONCOLOGIST, FAMILY, JUDGE.<br/>Sessions must run USE SECONDARY ROLES NONE."), "enforce", 0, 3, cspan=2),
        Node("ntf", label("Notification integration", "Container: email + webhook", "Fires on blocker with<br/>days_to_visit ≤ 3"), "system", 0, 4),
        Node("mcps", label("MCP server", "Container: Snowflake-managed", "2 read-only tools.<br/>No patient-scoped tool exposed."), "system", 1, 4),
    ]
    e = [
        Edge("ui", "rt", "invokes procedures<br/>[Snowflake session over TLS]"),
        Edge("ui", "agt", "sends Class B<br/>questions [SQL]"),
        Edge("agt", "rt", "calls generic tools<br/>[SQL]"),
        Edge("rt", "tbl", "reads and writes<br/>under policy [SQL]"),
        Edge("rt", "stg", "reads documents [SQL]"),
        Edge("rt", "srch", "queries with server-injected<br/>filters [Cortex Search]"),
        Edge("rt", "mdl", "extraction and verification<br/>passes [AI_COMPLETE]"),
        Edge("roles", "tbl", "enforces row access<br/>and masking"),
        Edge("rt", "ntf", "sends alerts"),
        Edge("mcps", "rt", "invokes read-only tools<br/>[MCP over HTTPS]"),
    ]
    b = [
        Boundary("dev", "Deployment node · User device — web browser, TLS 1.2+", ["ui"]),
        Boundary("wh", "Deployment node · SAARTHI_AI_WH — virtual warehouse, SMALL, 60s auto-suspend", ["rt"]),
        Boundary("ctx", "Deployment node · Snowflake Cortex — managed AI services", ["srch", "agt", "mdl"]),
        Boundary("dbn", "Deployment node · SAARTHI database — 7 schemas", ["tbl", "stg"]),
        Boundary("gov", "Deployment node · Account-level governance", ["roles"]),
        Boundary("ext", "Deployment node · External endpoints — outbound only", ["ntf", "mcps"]),
        Boundary("sf", "Deployment node · Snowflake account FV11738 — Enterprise, GCP_ME_CENTRAL2 · CORTEX_ENABLED_CROSS_REGION = ANY_REGION", ["wh", "ctx", "dbn", "gov"], pad=22),
    ]
    return Page("5. Deployment", n, b, e)


PAGES = [landscape, context, container, component, deployment]
