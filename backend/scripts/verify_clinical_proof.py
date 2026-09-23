#!/usr/bin/env python3
"""Verify the clinical-completeness ledger (evidence/clinical/).

Proves, mechanically, so a reader needs neither medical training nor trust in
whoever wrote the ledger:

  1. Sources   - every cited document is the one that was cited (sha256). A
                 changed hash means the publisher revised it: quotes are still
                 checked, and the source is flagged for re-review.
  2. Quotes    - every quoted requirement appears word for word on its stated
                 page (whitespace and typographic quotes normalised; nothing
                 else).
  3. Rules     - every SAARTHI rule the ledger cites exists in rules.sql.
  4. Numbers   - every threshold the ledger compares is read from that rule's
                 threshold_json and compared here, so "matches" / "stricter" /
                 "looser" is computed, not asserted.
  5. Honesty   - a requirement's declared status must agree with (4): a rule
                 looser than its source must be declared unsafe, one stricter
                 must be declared conflict or unsafe.

Then computes coverage and writes evidence/clinical/REPORT.md, plus
clinician_review.csv for expert sign-off. Exits non-zero if any quote, rule,
number or status check fails.

    python3 backend/scripts/verify_clinical_proof.py            # download + verify
    python3 backend/scripts/verify_clinical_proof.py --offline  # use the cache only
    python3 backend/scripts/verify_clinical_proof.py --locate BRAJAC "CBC & Diff"

Requires pdftotext (poppler: `brew install poppler` / `apt install poppler-utils`)
and PyYAML.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
LEDGER_DIR = ROOT / "evidence" / "clinical"
CACHE = LEDGER_DIR / ".cache"
RULES_SQL = ROOT / "backend" / "sql" / "data" / "rules.sql"
REPORT = LEDGER_DIR / "REPORT.md"
REVIEW_SHEET = LEDGER_DIR / "clinician_review.csv"

STATUSES = ["covered", "partial", "conflict", "unsafe", "missing", "out_of_scope"]
LAYER_ORDER = ["regimen", "drug", "administration", "guideline", "payer"]


# ---------------------------------------------------------------- text -----

_TYPOGRAPHY = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"',
                             "–": "-", "—": "-", "•": " ", "": " ",
                             "": " ", " ": " "})


def norm(text: str) -> str:
    """Whitespace- and typography-insensitive form. Words and numbers untouched."""
    text = unicodedata.normalize("NFKC", text).translate(_TYPOGRAPHY)
    return re.sub(r"\s+", " ", text).strip()


def pdf_pages(path: Path) -> list[list[str]]:
    """Per page, the text in two independent extraction modes (layout and
    reading order): a table row survives in one or the other."""
    pages: list[list[str]] = []
    for flags in (["-layout"], []):
        out = subprocess.run(["pdftotext", *flags, str(path), "-"],
                             capture_output=True, text=True, check=True).stdout
        for i, page in enumerate(out.split("\f")):
            if i == len(pages):
                pages.append([])
            pages[i].append(norm(page))
    return pages


def xml_pages(path: Path) -> list[list[str]]:
    text = html.unescape(re.sub(r"<[^>]+>", " ", path.read_text(encoding="utf-8")))
    return [[norm(text)]]


# ------------------------------------------------------------- sources -----

def fetch(sid: str, src: dict, offline: bool) -> tuple[Path | None, str]:
    if "path" in src:
        path = ROOT / src["path"]
        return (path, "ok") if path.exists() else (None, f"missing file {src['path']}")
    suffix = ".xml" if "fullTextXML" in src["url"] else ".pdf"
    path = CACHE / f"{sid}{suffix}"
    if not path.exists():
        if offline:
            return None, "not cached (run without --offline)"
        CACHE.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(src["url"], headers={"User-Agent": "SAARTHI-verifier/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            path.write_bytes(resp.read())
    return path, "ok"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --------------------------------------------------------------- rules -----

def load_rules() -> dict[str, dict]:
    """rule_id -> threshold_json, parsed from the deploy file itself."""
    sql = RULES_SQL.read_text(encoding="utf-8")
    rules, versions = {}, {}
    for m in re.finditer(r"VALUES \('([A-Z0-9-]+)',\s*(\d+),.*?PARSE_JSON\('(.*?)'\)", sql, re.S):
        rid, ver = m.group(1), int(m.group(2))
        if ver >= versions.get(rid, 0):          # the current version is the highest
            rules[rid], versions[rid] = json.loads(m.group(3)), ver
    return rules


def dig(obj: dict, path: str):
    for key in path.split("."):
        if not isinstance(obj, dict) or key not in obj:
            return None
        obj = obj[key]
    return obj


def fmt(v: float) -> str:
    return f"{v:,.0f}" if float(v).is_integer() and abs(v) >= 100 else f"{v:g}"


def compare(c: dict, rules: dict) -> dict:
    rule_value = dig(rules.get(c["rule"], {}), c["path"])
    out = dict(c, rule_value=rule_value)
    if not isinstance(rule_value, (int, float)):
        out.update(outcome="unreadable", band=f"{c['rule']}.{c['path']} is not a number in rules.sql")
        return out
    src, rv, tol, unit = float(c["source_value"]), float(rule_value), float(c.get("tolerance", 0)), c["unit"]
    if abs(rv - src) <= tol * abs(src):
        out.update(outcome="match", band="")
        return out
    stricter = (rv > src) if c["kind"] == "min" else (rv < src)
    lo, hi = sorted((src, rv))
    if c["kind"] == "min":
        band = (f"{c['label']} from {fmt(lo)} to just under {fmt(hi)} {unit}: "
                + ("source treats, SAARTHI blocks" if stricter else "source holds or reduces, SAARTHI passes"))
    elif c["kind"] == "max":
        band = (f"{c['label']} above {fmt(lo)} up to {fmt(hi)} {unit}: "
                + ("source treats, SAARTHI blocks" if stricter else "source holds or reduces, SAARTHI passes"))
    else:
        band = (f"{c['label']} of {fmt(lo + 1)} to {fmt(hi)} {unit}: "
                + ("source accepts, SAARTHI blocks" if stricter else "source requires a new one, SAARTHI accepts"))
    out.update(outcome="rule_stricter" if stricter else "rule_looser", band=band)
    return out


# --------------------------------------------------------------- main ------

def load_sources(offline: bool):
    """Fetch, fingerprint and extract every source. Returns (sources, texts, rows, errors)."""
    if not shutil.which("pdftotext"):
        sys.exit("pdftotext not found - install poppler (brew install poppler / apt install poppler-utils)")
    sources = yaml.safe_load((LEDGER_DIR / "sources.yaml").read_text())["sources"]
    texts, source_rows, errors = {}, [], []
    for sid, src in sources.items():
        path, state = fetch(sid, src, offline)
        if path is None:
            errors.append(f"source {sid}: {state}")
            source_rows.append((sid, src, "UNAVAILABLE", state))
            continue
        digest = sha256(path)
        integrity = "unchanged" if digest == src["sha256"] else "REVISED BY PUBLISHER - re-review quotes"
        texts[sid] = xml_pages(path) if path.suffix == ".xml" else pdf_pages(path)
        source_rows.append((sid, src, integrity, digest[:12]))
    return sources, texts, source_rows, errors


def verify(offline: bool = False) -> dict:
    """Run every check. Returns the ledger, per-requirement results and all errors."""
    sources, texts, source_rows, errors = load_sources(offline)
    ledger = yaml.safe_load((LEDGER_DIR / "requirements.yaml").read_text())
    reqs, regimens = ledger["requirements"], ledger["regimens"]
    rules = load_rules()
    results = []
    for r in reqs:
        res = {"req": r, "problems": [], "compares": []}
        sid, page = r["source"], r.get("page")
        pages = texts.get(sid)
        # 2. quotes
        for q in r["quotes"]:
            nq = norm(q)
            if pages is None:
                res["problems"].append(f"source {sid} unavailable")
                continue
            if page is None:
                found = any(nq in m for modes in pages for m in modes)
                where = "whole document"
            else:
                found = 0 < page <= len(pages) and any(nq in m for m in pages[page - 1])
                where = f"p.{page}"
            if not found:
                elsewhere = [i + 1 for i, modes in enumerate(pages) if any(nq in m for m in modes)]
                hint = f" (found on p.{', '.join(map(str, elsewhere))})" if elsewhere else " (not in document)"
                res["problems"].append(f"quote not on {where}{hint}: \"{q}\"")
        # 3. rules
        for rid in r["saarthi"].get("rules", []):
            if rid not in rules:
                res["problems"].append(f"rule {rid} not in rules.sql")
        # 4. numbers
        for c in r.get("compare", []):
            cr = compare(c, rules)
            res["compares"].append(cr)
            if cr["outcome"] == "unreadable":
                res["problems"].append(cr["band"])
        # 5. honesty - declared status must agree with computed numbers
        status = r["saarthi"]["status"]
        outcomes = {c["outcome"] for c in res["compares"]}
        impl_unsafe = r.get("implementation", {}).get("verdict") == "unsafe"
        if status not in STATUSES:
            res["problems"].append(f"unknown status {status}")
        if "rule_looser" in outcomes and status != "unsafe":
            res["problems"].append(f"a rule is looser than its source, so status must be unsafe, not {status}")
        if "rule_stricter" in outcomes and status not in ("conflict", "unsafe"):
            res["problems"].append(f"a rule is stricter than its source, so status must be conflict, not {status}")
        if impl_unsafe and status != "unsafe":
            res["problems"].append(f"implementation verdict is unsafe, so status must be unsafe, not {status}")
        if status == "unsafe" and not ("rule_looser" in outcomes or impl_unsafe):
            res["problems"].append("status unsafe needs a looser number or an unsafe implementation finding")
        if status in ("covered", "partial", "conflict", "unsafe") and not r["saarthi"].get("rules"):
            res["problems"].append(f"status {status} must name the rule(s)")
        results.append(res)

    errors += [f"{res['req']['id']}: {p}" for res in results for p in res["problems"]]
    return {"sources": sources, "source_rows": source_rows, "regimens": regimens,
            "results": results, "errors": errors}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--offline", action="store_true", help="use cached sources only")
    ap.add_argument("--locate", nargs=2, metavar=("SOURCE", "TEXT"), help="print the pages TEXT appears on")
    args = ap.parse_args()

    if args.locate:
        sid, needle = args.locate
        _, texts, _, _ = load_sources(args.offline)
        hits = [i + 1 for i, modes in enumerate(texts.get(sid, [])) if any(norm(needle) in m for m in modes)]
        print(f"{sid}: {'pages ' + ', '.join(map(str, hits)) if hits else 'not found'}")
        return 0

    v = verify(args.offline)
    write_report(v["results"], v["source_rows"], v["sources"], v["regimens"], v["errors"])
    write_review_sheet(v["results"], v["sources"])
    print_summary(v["results"], v["errors"])
    return 1 if v["errors"] else 0


def write_review_sheet(results, sources) -> None:
    """One row per requirement for a clinician to mark. Two or more reviewers'
    answers give an item-level content validity index: the share who mark a
    row "required", the method the AIIMS Jodhpur checklist itself used."""
    import csv
    with REVIEW_SHEET.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "applies_to", "requirement_in_plain_english", "exact_quote", "source", "page",
                    "saarthi_status_claimed",
                    "REVIEWER: required before a cycle in your practice? (yes/no)",
                    "REVIEWER: is the claimed SAARTHI status right? (yes/no)",
                    "REVIEWER: comment"])
        for r in results:
            q = r["req"]
            w.writerow([q["id"], " ".join(q["applies_to"]), q["plain"], " … ".join(q["quotes"]),
                        sources[q["source"]]["title"], q.get("page", ""), q["saarthi"]["status"], "", "", ""])
        w.writerow(["NEW-1", "", "REVIEWER: anything you check before a cycle that is not listed above", "", "", "", "", "", "", ""])


# ------------------------------------------------------------- report ------

def tally(rs) -> Counter:
    return Counter(r["req"]["saarthi"]["status"] for r in rs)


def pct_line(c: Counter) -> str:
    scored = sum(c[s] for s in STATUSES if s != "out_of_scope")
    if not scored:
        return "-"
    return (f"{c['covered']}/{scored} fully met ({100 * c['covered'] / scored:.0f}%) · "
            f"{c['covered'] + c['partial']}/{scored} met or partly met "
            f"({100 * (c['covered'] + c['partial']) / scored:.0f}%)")


def counts_cells(c: Counter) -> str:
    return " | ".join(str(c[s]) for s in STATUSES)


def print_summary(results, errors) -> None:
    c = tally(results)
    print(f"requirements: {len(results)}  quotes verified: "
          f"{sum(len(r['req']['quotes']) for r in results) - sum(1 for r in results for p in r['problems'] if p.startswith('quote'))}"
          f"/{sum(len(r['req']['quotes']) for r in results)}")
    print("status:", ", ".join(f"{s} {c[s]}" for s in STATUSES))
    print("coverage:", pct_line(c))
    for e in errors:
        print("FAIL", e)
    print(f"report: {REPORT}")


def write_report(results, source_rows, sources, regimens, errors) -> None:
    L = []
    c = tally(results)
    n_quotes = sum(len(r["req"]["quotes"]) for r in results)
    bad_quotes = sum(1 for r in results for p in r["problems"] if p.startswith("quote"))
    L += ["# Clinical completeness - verification report", "",
          "Generated by `backend/scripts/verify_clinical_proof.py`. Do not edit by hand; "
          "edit `requirements.yaml` / `sources.yaml` and re-run.", "",
          f"**Verification: {'PASS' if not errors else 'FAIL - ' + str(len(errors)) + ' problem(s)'}** · "
          f"{len(results)} requirements · {n_quotes - bad_quotes}/{n_quotes} quotes found verbatim · "
          f"{len(source_rows)} sources", "",
          f"**Coverage (out-of-scope excluded): {pct_line(c)}**", "",
          "| covered | partial | conflict | unsafe | missing | out of scope |",
          "|---|---|---|---|---|---|", f"| {counts_cells(c)} |", ""]

    if errors:
        L += ["## Problems", ""] + [f"- {e}" for e in errors] + [""]

    L += ["## By layer", "", "| layer | covered | partial | conflict | unsafe | missing | out of scope | coverage |",
          "|---|---|---|---|---|---|---|---|"]
    by_layer = defaultdict(list)
    for r in results:
        by_layer[sources[r["req"]["source"]]["layer"]].append(r)
    for layer in LAYER_ORDER:
        lc = tally(by_layer[layer])
        L.append(f"| {layer} | {counts_cells(lc)} | {pct_line(lc)} |")

    L += ["", "## By regimen (day-care cohort)", "",
          "Each regimen's own requirements plus the requirements that apply to every patient.", "",
          "| regimen | patients | covered | partial | conflict | unsafe | missing | out of scope | coverage |",
          "|---|---|---|---|---|---|---|---|---|"]
    for reg, meta in regimens.items():
        rs = [r for r in results if reg in r["req"]["applies_to"] or "ALL" in r["req"]["applies_to"]]
        rc = tally(rs)
        L.append(f"| {reg} | {', '.join(meta['patients'])} | {counts_cells(rc)} | {pct_line(rc)} |")

    checks = defaultdict(list)
    for r in results:
        checks[r["req"]["check"]].append(r["req"]["saarthi"]["status"])
    worst = {k: max(v, key=lambda s: ["out_of_scope", "covered", "partial", "conflict", "missing", "unsafe"].index(s))
             for k, v in checks.items()}
    wc = Counter(worst.values())
    L += ["", "## Distinct checks", "",
          f"The {len(results)} requirements reduce to {len(worst)} distinct checks "
          "(e.g. 'weight each visit' is required by two protocols). Each check takes the worst status of its requirements.", "",
          "| covered | partial | conflict | unsafe | missing | out of scope |", "|---|---|---|---|---|---|",
          f"| {counts_cells(wc)} |", ""]

    L += ["## Numbers compared against rules.sql", "",
          "Read from each rule's `threshold_json`; the outcome is computed by the script.", "",
          "| req | rule | source says | rule says | outcome | who is affected |", "|---|---|---|---|---|---|"]
    for r in results:
        for cr in r["compares"]:
            L.append(f"| {r['req']['id']} | `{cr['rule']}` | {fmt(cr['source_value'])} {cr['unit']} | "
                     f"{fmt(cr['rule_value']) if isinstance(cr['rule_value'], (int, float)) else '?'} {cr['unit']} | "
                     f"{cr['outcome'].replace('_', ' ')} | {cr['band'] or '-'} |")

    impl = [r for r in results if "implementation" in r["req"]]
    if impl:
        L += ["", "## Evaluator behaviour found by reading the code", "",
              "Open findings need the stated live case; fixed ones name the test that now proves the fix.", ""]
        for r in impl:
            im = r["req"]["implementation"]
            proof = (f"*Fixed; test:* `{im['test']}`" if im.get("verdict") == "fixed"
                     else f"*Test:* {im['expect']['patient']} → expect {im['expect']['outcome']}.")
            L += [f"- **{r['req']['id']}** ({im.get('verdict')}) `{im['file']}` - {im['finding']} {proof}"]

    for status, title in [("unsafe", "Unsafe - SAARTHI can pass a patient the source says to hold or reduce"),
                          ("conflict", "Conflict - SAARTHI blocks or applies where the source does not"),
                          ("missing", "Missing - no rule checks this"),
                          ("partial", "Partial"), ("covered", "Covered"), ("out_of_scope", "Out of scope (Class A)")]:
        rs = [r for r in results if r["req"]["saarthi"]["status"] == status]
        if not rs:
            continue
        L += ["", f"## {title} ({len(rs)})", ""]
        for r in rs:
            q = r["req"]
            where = f"{q['source']} p.{q['page']}" if q.get("page") else q["source"]
            finding = q["saarthi"].get("finding", "")
            rules_ = ", ".join(f"`{x}`" for x in q["saarthi"].get("rules", [])) or "none"
            L += [f"**{q['id']}** · {', '.join(q['applies_to'])} · {where} · rules: {rules_}  ",
                  f"> {' … '.join(q['quotes'])}  ",
                  f"{q['plain']}" + (f" *{finding}*" if finding else ""), ""]

    L += ["## Sources", "", "| id | layer | document | revised | integrity |", "|---|---|---|---|---|"]
    for sid, src, integrity, digest in source_rows:
        link = f"[{src['title']}]({src['url']})" if "url" in src else f"{src['title']} (`{src['path']}`)"
        L.append(f"| {sid} | {src['layer']} | {link} | {src.get('revised', '-')} | {integrity} |")
    L += ["", "Engineering verification of rule content against published protocols is not clinical validation. "
          "A clinician's review of this ledger is the next step (see evidence/clinical/README.md).", ""]
    REPORT.write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
