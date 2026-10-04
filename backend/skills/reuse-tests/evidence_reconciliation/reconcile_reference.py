"""Offline REFERENCE implementation of the evidence-reconciliation skill contract (backend/skills/evidence-reconciliation/SKILL.md).

What this is: a deterministic Python statement of the skill's rules, run against a SECOND synthetic schema whose column
names differ from SAARTHI's. It demonstrates the reuse claim (one successful mapping, and ambiguities that are refused,
never guessed). What it is NOT: an LLM agent loading and following SKILL.md. Loading the skill into the Cortex agent
and invoking it is unverified-needs-deploy. Synthetic data only; engineering check, not clinical validation.
"""
import re

# role -> regex over lower-cased column names. A role matched by 0 or >1 columns is NOT mapped (fail closed).
ROLE_PATTERNS = {
    "record_id": r"^(doc|report|rpt|record)_?(id|ref)$",
    "patient": r"^(patient|pt|subject)_?(id|ref)$",
    "concept": r"^(concept|test|analyte|observation)_?(id|code)$",
    "specimen": r"^(specimen|sample|accession)_?(id|ref)$",
    "value": r"(^|_)(value|result|reading|val)(_|$)",
    "version": r"^(rev|revision|version|ver)(_?(no|num|number|seq))?$",
    "supersedes": r"^(supersedes|replaces|prior|amends)_?(doc|report|rpt|record)?(_?id)?$",
    "revision_kind": r"^(rev|revision)_?(kind|type)$|^revision_type$",
}
REQUIRED_ROLES = ("record_id", "patient", "concept", "value", "revision_kind")

REVISION_VOCAB = {"original": "original", "orig": "original", "appended": "appended", "addl": "appended",
                  "additional": "appended", "amended": "amended", "amnd": "amended",
                  "corrected": "corrected", "corr": "corrected"}


class Refusal(Exception):
    """The skill declines to guess. Carries the outcome the gate layer must use (not_evaluated), never a value."""

    def __init__(self, reason, candidates=()):
        super().__init__(reason)
        self.outcome = "not_evaluated"
        self.reason = reason
        self.candidates = list(candidates)


def map_columns(columns):
    mapping = {}
    for role, pat in ROLE_PATTERNS.items():
        hits = [c for c in columns if re.search(pat, c.lower())]
        if len(hits) == 1:
            mapping[role] = hits[0]
        elif len(hits) > 1:
            raise Refusal(f"ambiguous_{role}_column", hits)
    missing = [r for r in REQUIRED_ROLES if r not in mapping]
    if missing:
        raise Refusal("role_not_found:" + ",".join(missing))
    return mapping


def _canon(row, m):
    kind = REVISION_VOCAB.get(str(row[m["revision_kind"]]).lower())
    if kind is None:
        raise Refusal("unknown_revision_kind:" + str(row[m["revision_kind"]]))
    return {"id": row[m["record_id"]], "patient": row[m["patient"]], "concept": row[m["concept"]],
            "specimen": row.get(m["specimen"]) if "specimen" in m else None,
            "value": row[m["value"]], "kind": kind,
            "supersedes": row.get(m["supersedes"]) if "supersedes" in m else None}


def classify(a, b):
    """Relation of canonical row b to canonical row a (same patient and concept), per the SKILL's five relations."""
    if (a["patient"], a["concept"]) != (b["patient"], b["concept"]):
        raise Refusal("different_patient_or_concept")
    if b["supersedes"] == a["id"]:
        if b["kind"] in ("amended", "corrected"):
            return "supersedes"          # prior value stops contributing; a correction re-triggers dependent gates
        if b["kind"] == "appended":
            return "complemented_by"     # an append is not a supersession: the original stays valid
    if a["value"] == b["value"]:
        return "supports"                # agreement strengthens nothing
    if a["specimen"] is None or b["specimen"] is None:
        raise Refusal("specimen_unknown_no_cross_specimen_inference")
    if a["specimen"] != b["specimen"]:
        return "discordant_across_specimens"   # both readings shown; never merge, never pick the later one
    return "conflicting"                 # same specimen, same concept, different value: a human reconciles


def reconcile(columns, rows):
    m = map_columns(columns)
    canon = [_canon(r, m) for r in rows]
    out = []
    for i, a in enumerate(canon):
        for b in canon[i + 1:]:
            if (a["patient"], a["concept"]) != (b["patient"], b["concept"]):
                continue
            first, second = (b, a) if a["supersedes"] == b["id"] else (a, b)
            out.append({"from": first["id"], "to": second["id"], "relation": classify(first, second)})
    superseded = {c["supersedes"] for c in canon if c["supersedes"] and c["kind"] in ("amended", "corrected")}
    return {"mapping": m, "relations": out, "current_ids": [c["id"] for c in canon if c["id"] not in superseded]}
