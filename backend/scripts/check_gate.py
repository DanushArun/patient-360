#!/usr/bin/env python3
"""SAARTHI build gate.

Five mechanical checks that turn promises in the architecture into build failures.
Run before the Day-5 gate, before every merge, and again on Day 15.

    backend/scripts/check_gate.py --all
    backend/scripts/check_gate.py --all --strict     # Day 5 onward: SKIP becomes FAIL

Why each check exists
---------------------
--contracts  A schema with no conforming instance is untested, and a schema that has
             never rejected anything is decorative. Validates the fixtures AND six
             malformed answers the schema must refuse.
--params     A1 is verified: given a reachable parameter the agent fills it from the
             question text. The fix is the ABSENCE of the parameter, so absence is
             what gets checked - in the contract and in the generated agent spec.
--preamble   Eight tool procedures each open with the same bind/authorise/consent
             block. Snowflake has no include mechanism, so the copies are diffed
             against one reference file. Drift becomes a build failure instead of a
             discovery.
--stubs      "Any answer is hard-coded" is a go/no-go failure. Nobody does it on
             purpose; it happens when a Day-3 stub is still being called on Day 14.
--manifest   setup.sql must not reference a file that does not exist. A deploy that
             only works on a machine with leftover state is the most likely way to
             lose Solution Completeness, and it is invisible until tested.

Standard library only, except jsonschema which is used when present.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"
results: list[tuple[str, str, str]] = []


def record(status: str, check: str, detail: str = "") -> None:
    results.append((status, check, detail))


# ---------------------------------------------------------------------------
# --contracts
# ---------------------------------------------------------------------------

NEGATIVE_CONTROLS = {
    "class A carrying a claim": {
        "classification": "CLASS_A", "overall_status": "refused",
        "known_as_of": "2026-09-18T09:00:00", "limitations": [],
        "refusal": {"reason_code": "class_a_clinical_judgment", "message": "x",
                    "practitioner": {"practitioner_id": "P", "name": "n",
                                     "nmc_registration_no": "r"}},
        "claims": [{"text": "she should proceed", "claim_type": "status",
                    "evidence": [{"kind": "structured", "id": "X", "table": "T",
                                  "event_time": "t", "source_recorded_at": "t"}]}],
    },
    "claim with no evidence": {
        "classification": "CLASS_B", "overall_status": "supported",
        "known_as_of": "2026-09-18T09:00:00", "limitations": [],
        "claims": [{"text": "ANC is 2100", "claim_type": "numeric", "evidence": []}],
    },
    "claim carrying a confidence field": {
        "classification": "CLASS_B", "overall_status": "supported",
        "known_as_of": "2026-09-18T09:00:00", "limitations": [],
        "claims": [{"text": "ANC is 2100", "claim_type": "numeric", "confidence": 0.92,
                    "evidence": [{"kind": "structured", "id": "X", "table": "T",
                                  "event_time": "t", "source_recorded_at": "t"}]}],
    },
    "class B marked refused": {
        "classification": "CLASS_B", "overall_status": "refused",
        "known_as_of": "2026-09-18T09:00:00", "limitations": [], "claims": [],
    },
    "class A naming no practitioner": {
        "classification": "CLASS_A", "overall_status": "refused",
        "known_as_of": "2026-09-18T09:00:00", "limitations": [], "claims": [],
    },
    "answer with no known_as_of": {
        "classification": "CLASS_B", "overall_status": "supported",
        "limitations": [], "claims": [],
    },
}


def check_contracts() -> None:
    schema_path = ROOT / "frontend/contracts/answer_schema.json"
    if not schema_path.exists():
        record(FAIL, "contracts", "frontend/contracts/answer_schema.json is missing")
        return

    schema = json.loads(schema_path.read_text())

    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        record(SKIP, "contracts",
               "jsonschema not installed - schema parsed as JSON only. "
               "pip install jsonschema to run the real check.")
        return

    try:
        Draft202012Validator.check_schema(schema)
    except Exception as exc:  # noqa: BLE001
        record(FAIL, "contracts/schema", f"answer_schema.json is not valid draft 2020-12: {exc}")
        return
    record(PASS, "contracts/schema", "answer_schema.json is valid draft 2020-12")

    v = Draft202012Validator(schema)

    fixtures = sorted((ROOT / "frontend/fixtures").glob("answer_*.json"))
    if not fixtures:
        record(SKIP, "contracts/fixtures", "no frontend/fixtures/answer_*.json yet")
    for f in fixtures:
        errs = sorted(v.iter_errors(json.loads(f.read_text())), key=lambda e: list(e.path))
        if errs:
            first = errs[0]
            record(FAIL, f"contracts/fixture {f.name}",
                   f"{list(first.absolute_path)} -> {first.message[:120]}")
        else:
            record(PASS, f"contracts/fixture {f.name}", "validates")

    for name, doc in NEGATIVE_CONTROLS.items():
        if list(v.iter_errors(doc)):
            record(PASS, f"contracts/rejects {name}", "correctly refused")
        else:
            record(FAIL, f"contracts/rejects {name}",
                   "SCHEMA HOLE - this malformed answer validated")


# ---------------------------------------------------------------------------
# --params
# ---------------------------------------------------------------------------

FORBIDDEN = ["patient_id", "patient_name", "encounter_id", "mrn", "abha_ref",
             "source_patient_id"]


def _indented_block(lines: list[str], start: int) -> list[str]:
    """Lines belonging to the block opened at `start`, by indentation."""
    base = len(lines[start]) - len(lines[start].lstrip())
    out = []
    for line in lines[start + 1:]:
        if not line.strip():
            continue
        if (len(line) - len(line.lstrip())) <= base:
            break
        out.append(line)
    return out


def _scan_blocks(path: pathlib.Path, opener: re.Pattern[str],
                 region: tuple[str, str] | None = None) -> list[str]:
    """Every forbidden parameter found inside blocks opened by `opener`."""
    lines = path.read_text().splitlines()
    lo, hi = 0, len(lines)
    if region:
        for i, line in enumerate(lines):
            if re.match(region[0], line):
                lo = i
            elif re.match(region[1], line) and i > lo:
                hi = i
                break
    hits = []
    for i in range(lo, hi):
        if opener.match(lines[i]):
            for line in _indented_block(lines[:hi], i):
                for bad in FORBIDDEN:
                    if re.match(rf"\s*{bad}\s*:", line) or re.search(rf'"{bad}"', line):
                        hits.append(f"{path.name}:{i + 1} block -> {line.strip()[:70]}")
    return hits


def check_params() -> None:
    sig = ROOT / "frontend/contracts/tool_signatures.yaml"
    if sig.exists():
        # Only the agent-visible `tools:` section. bind_patient legitimately takes a
        # patient_id under `internal:` - it is the one place a human's click enters.
        hits = _scan_blocks(sig, re.compile(r"\s*parameters:\s*$"),
                            region=(r"^tools:", r"^internal:"))
        if hits:
            record(FAIL, "params/contract", "; ".join(hits))
        else:
            record(PASS, "params/contract",
                   "no patient selector in any agent-visible tool signature")
    else:
        record(FAIL, "params/contract", "frontend/contracts/tool_signatures.yaml is missing")

    agent = ROOT / "backend/sql/agent/saarthi_agent.sql"
    if not agent.exists():
        record(SKIP, "params/agent", "backend/sql/agent/saarthi_agent.sql not written yet")
        return
    hits = _scan_blocks(agent, re.compile(r"\s*input_schema:\s*$"))
    if hits:
        record(FAIL, "params/agent",
               "A1 REGRESSION - a patient selector is reachable by the agent: "
               + "; ".join(hits))
    else:
        record(PASS, "params/agent", "patient_id absent from every tool input schema")


# ---------------------------------------------------------------------------
# --preamble
# ---------------------------------------------------------------------------

BEGIN = "-- >>> SAARTHI PREAMBLE v1 BEGIN"
END = "-- <<< SAARTHI PREAMBLE v1 END"


def _extract_preamble(text: str) -> list[str] | None:
    if BEGIN not in text or END not in text:
        return None
    body = text.split(BEGIN, 1)[1].split(END, 1)[0]
    return [ln.rstrip() for ln in body.splitlines() if ln.strip()]


def check_preamble() -> None:
    ref_path = ROOT / "backend/sql/procedures/tools/_preamble.sql"
    if not ref_path.exists():
        record(FAIL, "preamble", "backend/sql/procedures/tools/_preamble.sql is missing")
        return
    ref = _extract_preamble(ref_path.read_text())
    if ref is None:
        record(FAIL, "preamble", "reference file has no v1 markers")
        return

    tools = sorted(p for p in (ROOT / "backend/sql/procedures/tools").glob("*.sql")
                   if not p.name.startswith("_"))
    if not tools:
        record(SKIP, "preamble", "no tool procedures written yet (expect 8)")
        return
    if len(tools) != 8:
        record(SKIP, "preamble", f"{len(tools)} of 8 tool procedures written")

    for t in tools:
        got = _extract_preamble(t.read_text())
        if got is None:
            record(FAIL, f"preamble/{t.name}",
                   "no preamble markers - this procedure may be skipping the consent check")
        elif got != ref:
            record(FAIL, f"preamble/{t.name}", "preamble has drifted from the reference copy")
        else:
            record(PASS, f"preamble/{t.name}", "matches the reference copy")


# ---------------------------------------------------------------------------
# --stubs
# ---------------------------------------------------------------------------

def check_stubs() -> None:
    setup = ROOT / "backend/sql/setup.sql"
    if not setup.exists():
        record(FAIL, "stubs", "backend/sql/setup.sql is missing")
        return

    bad = [f"setup.sql:{i + 1}" for i, line in enumerate(setup.read_text().splitlines())
           if re.match(r"\s*EXECUTE IMMEDIATE FROM", line) and "stubs/" in line]
    if bad:
        record(FAIL, "stubs/manifest",
               "setup.sql deploys a stub: " + ", ".join(bad))
    else:
        record(PASS, "stubs/manifest", "setup.sql references no stub")

    leaks = []
    for p in list((ROOT / "backend/sql").rglob("*.sql")) + list((ROOT / "frontend").rglob("*.py")):
        if "stubs" in p.parts:
            continue
        for i, line in enumerate(p.read_text().splitlines()):
            if re.search(r"\bSTUB\.", line) or re.search(r"\bSCHEMA\s+STUB\b", line):
                leaks.append(f"{p.relative_to(ROOT)}:{i + 1}")
    if leaks:
        record(FAIL, "stubs/references",
               "the STUB schema is referenced outside backend/sql/stubs/: " + ", ".join(leaks[:5]))
    else:
        record(PASS, "stubs/references", "no STUB schema reference outside backend/sql/stubs/")


# ---------------------------------------------------------------------------
# --manifest
# ---------------------------------------------------------------------------

MANIFEST_LINE = re.compile(r"^\s*EXECUTE IMMEDIATE FROM\s+'([^']+)'")


def manifest_targets() -> list[str]:
    setup = ROOT / "backend/sql/setup.sql"
    if not setup.exists():
        return []
    return [m.group(1) for m in
            (MANIFEST_LINE.match(ln) for ln in setup.read_text().splitlines()) if m]


CONFLICT_MARKER = re.compile(r"^(<<<<<<< |=======$|>>>>>>> )", re.M)


def check_manifest() -> None:
    # A merge-conflict marker is invalid SQL: EXECUTE IMMEDIATE FROM on the repo
    # stage fails at it, while deploy.sh (which greps only EXECUTE lines) runs
    # both sides of the conflict. Found in setup.sql on 23 Sept.
    conflicted = [str(p.relative_to(ROOT)) for p in sorted((ROOT / "backend/sql").rglob("*.sql"))
                  if CONFLICT_MARKER.search(p.read_text(encoding="utf-8"))]
    if conflicted:
        record(FAIL, "manifest", "unresolved merge-conflict markers in: " + ", ".join(conflicted))
        return
    targets = manifest_targets()
    if not targets:
        record(SKIP, "manifest",
               "no manifest line is active yet - uncomment each as its file lands")
        return
    missing = [t for t in targets if not (ROOT / "backend/sql" / t).resolve().exists()]
    if missing:
        record(FAIL, "manifest", "setup.sql points at files that do not exist: "
               + ", ".join(missing))
    else:
        record(PASS, "manifest", f"{len(targets)} active deploy steps, all resolve")


# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# --models
# ---------------------------------------------------------------------------

# Marked [legacy], end-of-life pending, on Snowflake's published roster.
LEGACY_MODELS = {
    "llama3.1-70b", "claude-4-sonnet", "mistral-large2",
    "mixtral-8x7b", "llama4-maverick", "openai-gpt-4.1", "mistral-7b",
}

MODEL_CALL = re.compile(r"AI_COMPLETE\s*\(\s*(?:model\s*=>\s*)?'([^']+)'", re.IGNORECASE)


def check_models() -> None:
    """R7 depends on pass A and pass B being genuinely different families.

    The original design paired llama3.3-70b with llama3.1-70b and called it
    cross-family. It is not - same Meta lineage, correlated failure modes - and
    nothing in the output would have looked wrong. This check exists because that
    mistake is invisible by inspection and was made once already.
    """
    agent = ROOT / "backend/sql/agent/saarthi_agent.sql"
    if agent.exists():
        text = agent.read_text()
        if re.search(r"orchestration\s*:\s*auto\b", text, re.IGNORECASE):
            record(FAIL, "models/orchestration",
                   "orchestration is 'auto' - it re-selects upward when a stronger "
                   "model lands, changing cost and invalidating measured accuracy. Pin it.")
        else:
            record(PASS, "models/orchestration", "orchestration is pinned, not auto")
    else:
        record(SKIP, "models/orchestration", "backend/sql/agent/saarthi_agent.sql not written yet")

    extract = ROOT / "backend/sql/tasks/extract_assertions.sql"
    if not extract.exists():
        record(SKIP, "models/r7", "backend/sql/tasks/extract_assertions.sql not written yet")
    else:
        found = [m.lower() for m in MODEL_CALL.findall(extract.read_text())]
        distinct = sorted(set(found))
        if len(distinct) < 2:
            record(FAIL, "models/r7",
                   f"R7 needs two models; found {distinct or 'none'}")
        elif all(m.startswith("llama") for m in distinct):
            record(FAIL, "models/r7",
                   f"both passes are Llama ({', '.join(distinct)}) - same family, "
                   "correlated errors. Pass B must be a different vendor.")
        else:
            record(PASS, "models/r7", f"two families: {', '.join(distinct)}")

    # Legacy models anywhere in deployed SQL or in a prompt's frontmatter.
    hits = []
    scan = list((ROOT / "backend/sql").rglob("*.sql")) + list((ROOT / "backend/sql/prompts").glob("*.md"))
    for p in scan:
        if "probes" in p.parts:      # the probe deliberately tests legacy models
            continue
        for i, line in enumerate(p.read_text().splitlines()):
            if line.lstrip().startswith(("--", "#", "⚠")):
                continue             # commentary about legacy models is fine
            for bad in LEGACY_MODELS:
                if re.search(rf"['\"\s:]{re.escape(bad)}['\"\s,]", line):
                    hits.append(f"{p.relative_to(ROOT)}:{i + 1} -> {bad}")
    if hits:
        record(FAIL, "models/legacy",
               "legacy model referenced in shipped code: " + "; ".join(hits[:5]))
    else:
        record(PASS, "models/legacy", "no legacy model in shipped code")


CHECKS = {
    "contracts": check_contracts,
    "params": check_params,
    "preamble": check_preamble,
    "stubs": check_stubs,
    "manifest": check_manifest,
    "models": check_models,
}


def main() -> int:
    ap = argparse.ArgumentParser(description="SAARTHI build gate")
    for name in CHECKS:
        ap.add_argument(f"--{name}", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--strict", action="store_true",
                    help="treat SKIP as failure - use from the Day-5 gate onward")
    args = ap.parse_args()

    selected = [n for n in CHECKS if getattr(args, n)] or (list(CHECKS) if args.all else [])
    if not selected:
        ap.print_help()
        return 2

    for name in selected:
        CHECKS[name]()

    width = max(len(c) for _, c, _ in results) if results else 10
    for status, check, detail in results:
        print(f"{status:5} {check:<{width}}  {detail}")

    failed = sum(1 for s, _, _ in results if s == FAIL)
    skipped = sum(1 for s, _, _ in results if s == SKIP)
    print(f"\n{len(results) - failed - skipped} passed, {failed} failed, {skipped} skipped")

    if failed:
        return 1
    if skipped and args.strict:
        print("--strict: skipped checks count as failures from the Day-5 gate onward")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
