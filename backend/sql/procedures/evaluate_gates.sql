-- =============================================================================
-- STEP 14 - evaluate_gates (internal - never exposed to the agent)
-- =============================================================================
-- SPEC.md §4.4. The single source of truth for gate outcomes. R1: every status,
-- number and threshold comparison is computed here by deterministic code
-- against a versioned RULE_CATALOG row - never by the LLM. A scheduled task
-- (TASK_REFRESH_READINESS) materialises the result into READINESS_STATE; the
-- GET_READINESS tool calls it live for time-travel.
--
-- WHY PYTHON (rewritten 23 Sept, previously Snowflake Scripting)
--   Thirty rules, most regimen-specific, with lists of required tests,
--   reduced-dose bands and per-drug limits. The scripting version had grown to
--   ~500 lines of copy-pasted SELECT INTO blocks, and it carried three defects
--   the clinical ledger (evidence/clinical/) caught: renal and hepatic rules
--   that ignored the regimen (a cisplatin patient at CrCl 40 showed ready),
--   eleven rules that returned no evidence ids, and no known_as_of cutoff on
--   anything outside the simple-threshold shape. The rule logic below is plain
--   Python so backend/tests/test_evaluate_gates.py can run every rule locally
--   against a fake session, with no account.
--
-- CONTRACT (unchanged): evaluate_gates(patient_id, encounter_id, known_as_of)
--   -> {patient_id, encounter_id, regimen, gates: [{gate, rule_id,
--       rule_version, outcome, severity, reason, evidence_ids, derived,
--       known_as_of}]}
--   outcome is one of pass | fail | not_evaluated | conflicting (R3: missing
--   evidence is not_evaluated, never pass and never fail). A rule that does not
--   apply to this patient (LVEF on FOLFOX) is omitted, not reported.
--
-- EVIDENCE CUTOFF (R2): every event, document and authorisation is read as it
--   was known at known_as_of (ingested_at <= known_as_of). Ages are counted in
--   calendar days to the encounter the evidence has to be fresh for, exactly
--   as DATEDIFF('day', ...) counts them. Rules are always the current version:
--   a replay shows today's rules applied to what was known then.
--
-- REGIMEN: the patient's current TREATMENT_PLAN row -> REGIMEN_REGISTRY gives
--   the drugs, cycle interval and threshold_profile, the key into each rule's
--   threshold_json.per_regimen. Unknown regimen -> every rule applies with its
--   conservative default (unknown scope is not "does not apply", R3).
CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.evaluate_gates(
    p_patient_id VARCHAR, p_encounter_id VARCHAR, p_known_as_of VARCHAR DEFAULT NULL)
  RETURNS VARIANT
  LANGUAGE PYTHON
  RUNTIME_VERSION = '3.11'
  PACKAGES = ('snowflake-snowpark-python')
  HANDLER = 'run'
  COMMENT = 'Contract 2 procedure 10. R1: the single source of truth for gate outcomes. Not an agent tool.'
  EXECUTE AS OWNER
AS
$$
import json
import re

TS = "%Y-%m-%dT%H:%M:%S"
FLUOROPYRIMIDINES = ("fluorouracil", "capecitabine")


# ------------------------------------------------------------------ helpers --

def _rows(session, sql, params=None):
    return [r.as_dict() for r in session.sql(sql, params=params or []).collect()]


def _json(value):
    if value is None or isinstance(value, (dict, list)):
        return value
    return json.loads(value)


def days(earlier, later):
    """Calendar days from earlier to later - the count DATEDIFF('day') gives."""
    return (later.date() - earlier.date()).days


def num(v):
    if v is None:
        return "?"
    v = float(v)
    if v.is_integer():
        return f"{int(v):,}" if abs(v) >= 10000 else str(int(v))
    return f"{v:g}"


def day(ts):
    return ts.strftime("%Y-%m-%d") if ts else "?"


class Ctx:
    """Everything the rules read, fetched once, cut off at known_as_of."""

    def __init__(self, known_as_of, scheduled, patient, encounter, plan, regimen,
                 diagnoses, events, id_map, coverage, authorization, documents, assertions,
                 conflicted=None):
        self.known_as_of = known_as_of
        self.scheduled = scheduled
        self.patient = patient or {}
        self.encounter = encounter or {}
        self.plan = plan
        self.regimen = regimen
        self.diagnoses = diagnoses
        # Newest first. Two results with the same event_time are the same
        # measurement reported twice (an amended report, an addendum): the one
        # recorded later supersedes (R2 source_recorded_at), never the other way.
        self.events = sorted(events, key=lambda e: (e["EVENT_TIME"] or scheduled,
                                                    e.get("SOURCE_RECORDED_AT") or e["EVENT_TIME"] or scheduled),
                             reverse=True)
        self.id_map = id_map
        self.coverage = coverage
        self.authorization = authorization
        self.documents = documents
        self.assertions = assertions
        # event_id -> ids of verified document readings that contradict it, where
        # nothing supports the record value (reconcile_evidence, R3).
        self.conflicted = conflicted or {}

    # regimen ---------------------------------------------------------------
    @property
    def regimen_known(self):
        return self.regimen is not None

    @property
    def profile(self):
        return self.regimen["THRESHOLD_PROFILE"] if self.regimen else None

    @property
    def agents(self):
        return [a.lower() for a in (_json(self.regimen["AGENTS"]) or [])] if self.regimen else []

    @property
    def protocol(self):
        return self.regimen["PROTOCOL_REF"] if self.regimen else None

    @property
    def myelosuppressive(self):
        return None if self.regimen is None else bool(self.regimen["MYELOSUPPRESSIVE"])

    @property
    def cycle_days(self):
        return (self.regimen or {}).get("CYCLE_DAYS") or 21

    @property
    def cycle_number(self):
        return self.encounter.get("CYCLE_NUMBER")

    def on(self, *agents):
        """True if the regimen includes any of these drugs; unknown regimen -> True."""
        return (not self.regimen_known) or any(a in self.agents for a in agents)

    # patient ---------------------------------------------------------------
    @property
    def female(self):
        return (self.patient.get("GENDER") or "").lower() == "female"

    @property
    def age(self):
        dob = self.patient.get("DOB")
        if dob is None:
            return None
        s = self.scheduled.date()
        return s.year - dob.year - ((s.month, s.day) < (dob.month, dob.day))

    @property
    def breast(self):
        return any((d or "").startswith("C50") for d in self.diagnoses)

    @property
    def scope_known(self):
        return self.plan is not None or bool(self.diagnoses)

    # evidence --------------------------------------------------------------
    def history(self, concept, status=None, before=None):
        out = [e for e in self.events if e["CONCEPT_NAME"] == concept
               and e["PLAUSIBILITY_STATE"] == "present"
               and (status is None or e["STATUS"] == status)
               and (before is None or (e["EVENT_TIME"] and e["EVENT_TIME"] <= before))]
        return out

    def latest(self, concept, status=None, before=None):
        h = self.history(concept, status, before)
        return h[0] if h else None

    def latest_unreadable(self, concept):
        """True if the newest reading of concept is implausible (R3: unreadable)."""
        for e in self.events:
            if e["CONCEPT_NAME"] == concept:
                return e["PLAUSIBILITY_STATE"] == "unreadable"
        return False

    def age_days(self, event):
        return days(event["EVENT_TIME"], self.scheduled)

    def docs(self, doc_type):
        return [d for d in self.documents if d["DOC_TYPE"] == doc_type
                and (d["STATUS"] or "active") == "active"]


def result(outcome, reason, evidence=(), derived=None):
    return {"outcome": outcome, "reason": reason,
            "evidence_ids": [e for e in evidence if e], "derived": derived}


# -------------------------------------------------------------- rule shapes --

def fresh_value(ctx, concept, max_age, unreadable_ok=False):
    """(event, None) when a usable value exists, else (None, result)."""
    if ctx.latest_unreadable(concept) and not unreadable_ok:
        return None, result("not_evaluated", f"latest {concept} reading is outside the plausible range "
                                             f"(recorded as unreadable, R3) - repeat the test")
    ev = ctx.latest(concept)
    if ev is None:
        return None, result("not_evaluated", f"no {concept} result on record as of {ctx.known_as_of.strftime(TS)}")
    if ev["EVENT_ID"] in ctx.conflicted:
        return None, result("conflicting", f"{concept} {num(ev['VALUE_NUM'])} on record disagrees with a verified "
                                           "reading of a source document - both surfaced for human reconciliation, "
                                           "never resolved automatically",
                            [ev["EVENT_ID"]] + ctx.conflicted[ev["EVENT_ID"]])
    age = ctx.age_days(ev)
    if max_age is not None and age > max_age:
        return None, result("fail", f"{concept} {num(ev['VALUE_NUM'])} is {age} days old at the visit; "
                                    f"it must be within {int(max_age)} days", [ev["EVENT_ID"]], ev["DERIVATION"])
    return ev, None


def blood_count(ctx, rule, tj):
    """CLIN-ANC-001 / CLIN-PLT-001 v2 - per-regimen full-dose threshold."""
    if ctx.myelosuppressive is False:
        return None
    concept, max_age = tj["concept"], tj.get("max_age_days")
    per = tj.get("per_regimen", {})
    if ctx.profile in per:
        thr, basis = per[ctx.profile], f"{ctx.profile} ({ctx.protocol})"
    else:
        thr = tj["value"]
        basis = "default (no regimen-specific threshold on record)" if ctx.regimen_known else "default (regimen not on record)"
    ev, early = fresh_value(ctx, concept, max_age)
    if early:
        return early
    v = ev["VALUE_NUM"]
    band = tj.get("reduced_dose_band", {}).get(ctx.profile)
    ids, deriv = [ev["EVENT_ID"]], ev["DERIVATION"]
    if v >= thr:
        return result("pass", f"{concept} {num(v)} meets the {basis} full-dose threshold {num(thr)}", ids, deriv)
    if band and band[0] <= v < band[1]:
        return result("fail", f"{concept} {num(v)} is in the {ctx.profile} reduced-dose band "
                              f"({num(band[0])} to under {num(band[1])}) - full dose needs {num(thr)}; "
                              f"prescriber dose decision required before the chair ({ctx.protocol})", ids, deriv)
    floor = band[0] if band else thr
    return result("fail", f"{concept} {num(v)} is below {num(floor)}, the {basis} delay threshold - "
                          "delay per protocol", ids, deriv)


def simple_threshold(ctx, rule, tj):
    """v1 shape: concept + operator + value (+ max_age_days). ENDO-HBA1C-001."""
    ev, early = fresh_value(ctx, tj["concept"], tj.get("max_age_days"))
    if early:
        return early
    v, thr, op = ev["VALUE_NUM"], tj["value"], tj["operator"]
    ok = {">=": v >= thr, "<": v < thr, ">": v > thr, "<=": v <= thr}.get(op)
    if ok is None:
        return result("not_evaluated", f"unrecognised operator {op}")
    word = "meets" if ok else "does not meet"
    return result("pass" if ok else "fail", f"{tj['concept']} {num(v)} {word} {op} {num(thr)}",
                  [ev["EVENT_ID"]], ev["DERIVATION"])


def dexa(ctx, rule, tj):
    """ENDO-DEXA-001 - T-score band sets the surveillance interval (NCCN)."""
    if ctx.scope_known and not ctx.breast:
        return None
    ev = ctx.latest("T_SCORE")
    if ev is None:
        return result("not_evaluated", "no DEXA T-score on record")
    t, age = ev["VALUE_NUM"], ctx.age_days(ev)
    band, limit = (("normal, T>=-1.0", 730) if t >= -1.0 else
                   ("osteopenia, -2.5<T<-1.0", 365) if t > -2.5 else ("osteoporosis, T<=-2.5", 365))
    outcome = "fail" if age > limit else "pass"
    return result(outcome, f"DEXA T-score {num(t)} ({band}) - {limit // 365 * 12}-month interval, "
                           f"last scan {age} days old, {'overdue' if age > limit else 'within interval'}",
                  [ev["EVENT_ID"]])


def crcl(ctx, rule, tj):
    """CLIN-CRCL-001 v2 - Cockcroft-Gault against the regimen's own minimum."""
    per = tj["per_regimen_min_crcl"]
    if ctx.regimen_known:
        if ctx.profile not in per:
            return None
        thr, basis = per[ctx.profile], f"{ctx.profile} ({ctx.protocol})"
    else:
        thr, basis = tj["unknown_regimen_min_crcl"], "strictest listed minimum (regimen not on record)"
    cr, early = fresh_value(ctx, "CREATININE", tj.get("max_age_days"))
    if early:
        return early
    wt = ctx.latest("WEIGHT")
    if wt is None or ctx.age_days(wt) > tj.get("weight_max_age_days", 30):
        return result("not_evaluated", "creatinine clearance needs a body weight within "
                                       f"{tj.get('weight_max_age_days', 30)} days; "
                                       + ("none on record" if wt is None else f"latest is {ctx.age_days(wt)} days old"),
                      [cr["EVENT_ID"]])
    age = ctx.age
    if age is None:
        return result("not_evaluated", "creatinine clearance needs date of birth", [cr["EVENT_ID"], wt["EVENT_ID"]])
    value = (140 - age) * wt["VALUE_NUM"] * (0.85 if ctx.female else 1.0) / (72 * cr["VALUE_NUM"])
    derived = (f"Cockcroft-Gault: (140 - {age}) x {num(wt['VALUE_NUM'])} kg"
               f"{' x 0.85' if ctx.female else ''} / (72 x {num(cr['VALUE_NUM'])} mg/dL) = {value:.1f} mL/min")
    ids = [cr["EVENT_ID"], wt["EVENT_ID"]]
    band = tj.get("reduced_dose_band", {}).get(ctx.profile)
    if value >= thr:
        return result("pass", f"CrCl {value:.1f} mL/min meets the {basis} minimum {num(thr)}", ids, derived)
    if band and band[0] <= value < band[1]:
        return result("fail", f"CrCl {value:.1f} mL/min is in the {ctx.profile} reduced-dose band "
                              f"({num(band[0])}-{num(band[1])}): cisplatin at 80% per {ctx.protocol} - "
                              "prescriber dose decision required", ids, derived)
    floor = band[0] if band else thr
    return result("fail", f"CrCl {value:.1f} mL/min is below {num(floor)}, the {basis} hold threshold - "
                          "hold per protocol", ids, derived)


def bilirubin(ctx, rule, tj):
    """CLIN-BILI-001 v2 - strictest full-dose limit among the regimen's drugs."""
    uln, per = tj["uln_mg_dl"], tj["per_agent"]
    limits = []
    for agent, spec in per.items():
        if agent in ctx.agents:
            if "bilirubin_mg_dl_max" in spec:
                limits.append((agent, spec["bilirubin_mg_dl_max"], f"{num(spec['bilirubin_mg_dl_max'])} mg/dL", spec.get("action")))
            else:
                x = spec["bilirubin_x_uln_max"]
                limits.append((agent, x * uln, f"{num(x)} x ULN = {num(x * uln)} mg/dL", spec.get("action")))
    if not ctx.regimen_known:
        m = tj["unknown_regimen_mg_dl_max"]
        limits = [("unknown regimen", m, f"{num(m)} mg/dL", None)]
    if not limits:
        return None
    agent, limit, text, action = min(limits, key=lambda x: x[1])
    ev, early = fresh_value(ctx, "BILIRUBIN", tj.get("max_age_days"))
    if early:
        return early
    v = ev["VALUE_NUM"]
    if v <= limit + 1e-9:
        return result("pass", f"bilirubin {num(v)} mg/dL within the full-dose limit for {agent} ({text})", [ev["EVENT_ID"]])
    return result("fail", f"bilirubin {num(v)} mg/dL is above the full-dose limit for {agent} ({text})"
                          + (f" - {action}" if action else ""), [ev["EVENT_ID"]])


def lvef_current(ctx, rule, tj):
    """SURV-LVEF-001 v2 - recency, value, and an echo after the last anthracycline."""
    if not ctx.on("trastuzumab"):
        return None
    ev = ctx.latest("LVEF")
    if ev is None:
        return result("not_evaluated", "no LVEF (echo/MUGA) on record")
    age, v, ids = ctx.age_days(ev), ev["VALUE_NUM"], [ev["EVENT_ID"]]
    if age > tj["max_age_days"]:
        return result("fail", f"LVEF {num(v)}% is {age} days old; the Herceptin label requires one every 3 months "
                              f"({tj['max_age_days']} days)", ids)
    lo, hi = tj.get("discretion_band", [45, 50])
    if v < lo:
        return result("fail", f"LVEF {num(v)}% is below {lo}% - excluded from trastuzumab (BRAJTTW)", ids)
    if v < tj["min_value"]:
        return result("fail", f"LVEF {num(v)}% is in the {lo}-{hi}% band - trastuzumab only at the physician's "
                              "discretion (BRAJTTW p1); needs a documented decision", ids)
    if tj.get("after_last_anthracycline"):
        doxo = ctx.latest("DOXORUBICIN", status="administered", before=ctx.scheduled)
        if doxo and ev["EVENT_TIME"] < doxo["EVENT_TIME"]:
            return result("fail", f"latest LVEF ({day(ev['EVENT_TIME'])}) predates the last doxorubicin dose "
                                  f"({day(doxo['EVENT_TIME'])}); BRAJTR requires LVEF >= 50% after the AC portion",
                          ids + [doxo["EVENT_ID"]])
    return result("pass", f"LVEF {num(v)}% measured {age} days ago - within 90 days and at least {tj['min_value']}%", ids)


def lvef_delta(ctx, rule, tj):
    """SURV-LVEF-002 - hold on a >=16 point drop, or >=10 with LVEF under 50."""
    if not ctx.on("trastuzumab"):
        return None
    h = ctx.history("LVEF")
    if len(h) < 2:
        return result("not_evaluated", f"the decline rule needs a baseline and a current LVEF; "
                                       f"{len(h)} on record", [e["EVENT_ID"] for e in h])
    base, cur = h[-1], h[0]
    drop = base["VALUE_NUM"] - cur["VALUE_NUM"]
    ids = [base["EVENT_ID"], cur["EVENT_ID"]]
    trend = f"{num(base['VALUE_NUM'])}% -> {num(cur['VALUE_NUM'])}% (drop {num(drop)} points)"
    if drop >= 16:
        return result("fail", f"LVEF {trend} - hold trastuzumab (>= 16 points from baseline)", ids)
    if cur["VALUE_NUM"] < 50 and drop >= 10:
        return result("fail", f"LVEF {trend} with current below 50% - hold trastuzumab (>= 10 points)", ids)
    return result("pass", f"LVEF {trend} - within the label's continue thresholds", ids)


def panel(ctx, rule, tj):
    """CLIN-PANEL-001 - every test the protocol lists 'before each treatment'."""
    extra = tj["per_regimen"].get(ctx.profile, []) if ctx.regimen_known else []
    required = (tj["cbc_if_myelosuppressive"] if ctx.myelosuppressive is not False else []) + extra
    if not required:
        return None
    max_age, found, missing, stale, unreadable = tj["max_age_days"], [], [], [], []
    for concept in required:
        if ctx.latest_unreadable(concept):
            unreadable.append(concept)
            continue
        ev = ctx.latest(concept)
        if ev is None:
            missing.append(concept)
        elif ctx.age_days(ev) > max_age:
            stale.append(f"{concept} ({ctx.age_days(ev)} days)")
            found.append(ev["EVENT_ID"])
        else:
            found.append(ev["EVENT_ID"])
    where = ctx.protocol or "default CBC"
    if not (missing or stale or unreadable):
        return result("pass", f"all {len(required)} pre-cycle tests for {ctx.profile or 'this patient'} "
                              f"({where}) are within {max_age} days: {', '.join(required)}", found)
    parts = ([f"missing {', '.join(missing)}"] if missing else []) + \
            ([f"older than {max_age} days: {', '.join(stale)}"] if stale else []) + \
            ([f"unreadable: {', '.join(unreadable)}"] if unreadable else [])
    return result("fail", f"{'; '.join(parts)} - {where} lists these before each treatment", found)


def hbv(ctx, rule, tj):
    """SAFE-HBV-001 - HBsAg and anti-HBc on record (advisory)."""
    found, missing = [], []
    for c in tj["required"]:
        ev = ctx.latest(c)
        (found.append((c, ev)) if ev else missing.append(c))
    if missing:
        return result("fail", f"hepatitis B screening incomplete - no {', '.join(missing)} on record "
                              "(advisory: therapy is not delayed for the result)", [e["EVENT_ID"] for _, e in found])
    return result("pass", "hepatitis B screening on record: " +
                  ", ".join(f"{c} {e['VALUE_TEXT'] or num(e['VALUE_NUM'])} ({day(e['EVENT_TIME'])})" for c, e in found),
                  [e["EVENT_ID"] for _, e in found])


def pregnancy(ctx, rule, tj):
    """SAFE-PREG-001 - pregnancy status before trastuzumab (age < 50 proxy)."""
    if not (ctx.regimen_known and "trastuzumab" in ctx.agents and ctx.female
            and ctx.age is not None and ctx.age < 50):
        return None
    ev = ctx.latest("BETA_HCG", before=ctx.scheduled)
    if ev is None:
        return result("fail", f"no pregnancy test on record for a {ctx.age}-year-old woman on trastuzumab - "
                              "the Herceptin label requires verifying pregnancy status before initiation")
    text = (ev["VALUE_TEXT"] or "").lower()
    if "negative" in text:
        return result("pass", f"pregnancy test negative ({day(ev['EVENT_TIME'])})", [ev["EVENT_ID"]])
    if "positive" in text:
        return result("fail", f"pregnancy test POSITIVE ({day(ev['EVENT_TIME'])}) - trastuzumab carries a boxed "
                              "embryo-fetal toxicity warning; treating practitioner decision required", [ev["EVENT_ID"]])
    return result("not_evaluated", f"pregnancy test result unreadable: '{ev['VALUE_TEXT']}'", [ev["EVENT_ID"]])


def dpyd(ctx, rule, tj):
    """SAFE-DPYD-001 - DPYD result, or fluoropyrimidine already tolerated."""
    if not (ctx.regimen_known and any(a in ctx.agents for a in FLUOROPYRIMIDINES)):
        return None
    ev = ctx.latest("DPYD")
    if ev is not None:
        text = (ev["VALUE_TEXT"] or "").lower()
        if any(w in text for w in ("poor", "intermediate", "reduced", "deficien")):
            return result("fail", f"DPYD result '{ev['VALUE_TEXT']}' - reduced enzyme activity; dose from the DPYD "
                                  "activity score (BC Cancer Drug Manual appendix) before the drug is prepared",
                          [ev["EVENT_ID"]])
        return result("pass", f"DPYD result on record: {ev['VALUE_TEXT']} ({day(ev['EVENT_TIME'])})", [ev["EVENT_ID"]])
    if (ctx.cycle_number or 0) > 1:
        return result("pass", f"no DPYD result, but this is cycle {ctx.cycle_number}: the fluoropyrimidine was "
                              "tolerated in earlier cycles (protocol: 'not required if ... tolerated')")
    return result("fail", "no DPYD result on record before the first fluoropyrimidine cycle "
                          f"({ctx.protocol} baseline test)")


def anthracycline(ctx, rule, tj):
    """DOSE-ANTHRA-001 - lifetime doxorubicin including this cycle."""
    if not (ctx.regimen_known and "doxorubicin" in ctx.agents):
        return None
    doses = ctx.history("DOXORUBICIN", status="administered", before=ctx.scheduled)
    prior_cycles = max((ctx.cycle_number or 1) - 1, 0)
    ids = [d["EVENT_ID"] for d in doses]
    if len(doses) < prior_cycles:
        return result("not_evaluated", f"cycle {ctx.cycle_number}: only {len(doses)} of {prior_cycles} earlier "
                                       "doxorubicin doses have an administration record - lifetime total unknown, "
                                       "not assumed", ids)
    given = sum(d["VALUE_NUM"] or 0 for d in doses)
    planned = tj["planned_dose_mg_m2"].get(ctx.profile, 60)
    total, limit = given + planned, tj["max_cumulative_mg_m2"]
    derived = f"{num(given)} mg/m2 given ({len(doses)} doses) + {num(planned)} mg/m2 planned = {num(total)} mg/m2"
    if total > limit:
        return result("fail", f"lifetime doxorubicin would reach {num(total)} mg/m2 - over {limit}: cardiac "
                              "assessment required first (BRAJAC)", ids, derived)
    return result("pass", f"lifetime doxorubicin {num(total)} mg/m2 after this cycle - under {limit}", ids, derived)


def trastuzumab_gap(ctx, rule, tj):
    """DOSE-HLOAD-001 - repeat the loading dose after a gap over 6 weeks."""
    if not (ctx.regimen_known and "trastuzumab" in ctx.agents):
        return None
    last = ctx.latest("TRASTUZUMAB", status="administered", before=ctx.scheduled)
    if last is None:
        if (ctx.cycle_number or 1) <= 1:
            return result("pass", "first trastuzumab dose - the 8 mg/kg loading dose is part of the plan")
        return result("not_evaluated", f"cycle {ctx.cycle_number} but no earlier trastuzumab administration on "
                                       "record - interval since last dose unknown")
    gap = days(last["EVENT_TIME"], ctx.scheduled)
    if gap > tj["max_gap_days"]:
        return result("fail", f"last trastuzumab dose {gap} days before the visit (over 6 weeks) - repeat the "
                              f"{tj['loading_dose']} loading dose (BRAJTTW/BRAJTR)", [last["EVENT_ID"]])
    return result("pass", f"last trastuzumab dose {gap} days before the visit - maintenance dose, no reload",
                  [last["EVENT_ID"]])


def pemetrexed_vitamins(ctx, rule, tj):
    """SAFE-PEMVIT-001 - B12 within 9 weeks and folic acid on record."""
    if not (ctx.regimen_known and "pemetrexed" in ctx.agents):
        return None
    b12 = ctx.latest(tj["b12_concept"], before=ctx.scheduled)
    fol = ctx.latest(tj["folate_concept"], before=ctx.scheduled)
    problems, ids = [], []
    if b12 is None or ctx.age_days(b12) > tj["b12_max_age_days"]:
        problems.append("no vitamin B12 injection within 9 weeks" if b12 is None
                        else f"last vitamin B12 injection {ctx.age_days(b12)} days ago (over 63)")
    if b12:
        ids.append(b12["EVENT_ID"])
    if fol is None or ctx.age_days(fol) > tj["folate_max_age_days"]:
        problems.append("no current folic acid record")
    if fol:
        ids.append(fol["EVENT_ID"])
    if problems:
        return result("fail", "; ".join(problems) + " - LUAVPP makes supplementation mandatory", ids)
    return result("pass", f"vitamin B12 {ctx.age_days(b12)} days ago and folic acid on record", ids)


def inr_on_warfarin(ctx, rule, tj):
    """SAFE-INR-001 - INR within 7 days if warfarin is on record."""
    if not (ctx.regimen_known and any(a in ctx.agents for a in tj["agents"])):
        return None
    w = ctx.latest(tj["trigger_concept"], before=ctx.scheduled)
    if w is None or ctx.age_days(w) > tj["trigger_window_days"]:
        return None
    ev = ctx.latest(tj["concept"])
    if ev is None or ctx.age_days(ev) > tj["max_age_days"]:
        return result("fail", "on warfarin with a fluoropyrimidine but "
                              + ("no INR on record" if ev is None else f"INR is {ctx.age_days(ev)} days old")
                              + f" - {ctx.protocol} requires INR before each cycle", [w["EVENT_ID"]])
    return result("pass", f"on warfarin; INR {num(ev['VALUE_NUM'])} {ctx.age_days(ev)} days ago",
                  [w["EVENT_ID"], ev["EVENT_ID"]])


def weight_current(ctx, rule, tj):
    """DOSE-WT-001 - a weight within one cycle interval (advisory)."""
    if not ctx.regimen_known:
        return None
    ev = ctx.latest("WEIGHT")
    limit = ctx.cycle_days
    if ev is None:
        return result("fail", "no body weight on record - weigh at the visit; doses are weight/BSA based")
    age = ctx.age_days(ev)
    if age > limit:
        return result("fail", f"last weight {num(ev['VALUE_NUM'])} kg is {age} days old (cycle is {limit} days) - "
                              "re-weigh at the visit before the dose is calculated", [ev["EVENT_ID"]])
    return result("pass", f"weight {num(ev['VALUE_NUM'])} kg recorded {age} days ago - within one cycle", [ev["EVENT_ID"]])


def consent(ctx, rule, tj):
    """DOC-CONSENT-001 - signed chemo consent covering the current plan."""
    docs = [d for d in ctx.docs(tj["doc_type"]) if d["SIGNED_AT"] and d["SIGNED_AT"] <= ctx.scheduled]
    if not docs:
        return result("fail", "no signed chemotherapy consent on file")
    d = max(docs, key=lambda x: x["SIGNED_AT"])
    decided = (ctx.plan or {}).get("DECIDED_AT")
    if decided and d["SIGNED_AT"] < decided:
        return result("fail", f"consent signed {day(d['SIGNED_AT'])} predates the current plan "
                              f"(version {ctx.plan['VERSION']}, decided {day(decided)}) - a new consent is needed",
                      [d["DOC_ID"]])
    return result("pass", f"chemotherapy consent signed {day(d['SIGNED_AT'])}, covering the current plan", [d["DOC_ID"]])


def mdt(ctx, rule, tj):
    """DOC-MDT-001 - current plan decided by a tumour board."""
    if ctx.plan is None:
        return result("not_evaluated", "no treatment plan on record")
    forum = ctx.plan.get("DECISION_FORUM")
    ids = [ctx.plan["PLAN_ID"]]
    if forum in tj["decision_forum_in"]:
        return result("pass", f"plan version {ctx.plan['VERSION']} decided by {forum.replace('_', ' ')} "
                              f"on {day(ctx.plan.get('DECIDED_AT'))}", ids)
    return result("fail", f"plan version {ctx.plan['VERSION']} was decided in {forum or 'an unrecorded forum'} - "
                          "PM-JAY requires a multidisciplinary tumour-board decision (HBP 2.2, 3.9)", ids)


def order(ctx, rule, tj):
    """DOC-ORDER-001 - signed chemo order within this cycle interval."""
    window = ctx.cycle_days
    docs = [d for d in ctx.docs(tj["doc_type"]) if d["SIGNED_AT"] and d["EFFECTIVE_AT"]
            and 0 <= days(d["EFFECTIVE_AT"], ctx.scheduled) <= window]
    if not docs:
        return result("fail", f"no signed chemotherapy order dated within the {window}-day cycle before the visit")
    d = max(docs, key=lambda x: x["EFFECTIVE_AT"])
    return result("pass", f"signed chemotherapy order dated {day(d['EFFECTIVE_AT'])}", [d["DOC_ID"]])


def discharge(ctx, rule, tj):
    """DOC-DISCH-001 - previous cycle's discharge plan on file (advisory)."""
    if (ctx.cycle_number or 1) <= 1:
        return None
    window = 2 * ctx.cycle_days
    docs = [d for d in ctx.docs(tj["doc_type"]) if d["EFFECTIVE_AT"]
            and 0 <= days(d["EFFECTIVE_AT"], ctx.scheduled) <= window]
    if not docs:
        return result("fail", f"no discharge summary from the previous cycle (within {window} days) - next-cycle "
                              "date and pre-cycle tests may not have been given to the family")
    d = max(docs, key=lambda x: x["EFFECTIVE_AT"])
    return result("pass", f"previous cycle's discharge summary dated {day(d['EFFECTIVE_AT'])}", [d["DOC_ID"]])


def allergy(ctx, rule, tj):
    """DOC-ALLERGY-001 - verified allergy history (advisory)."""
    a = [x for x in ctx.assertions if x["PREDICATE"] == tj["predicate"]]
    if not a:
        return result("fail", "no verified allergy history on record (including 'no known drug allergy')")
    return result("pass", f"allergy history recorded: {a[0]['VALUE']}", [a[0]["ASSERTION_ID"]])


# ---------------------------------------------------- documentation rules --

def pathology_final(ctx, rule, tj):
    """DOC-PATH-001 - a final histopathology report on file."""
    path = [e for e in ctx.events if e["EVENT_TYPE"] == "pathology"]
    final = [e["EVENT_ID"] for e in path if e["STATUS"] == "final"]
    pending = [e["EVENT_ID"] for e in path if e["STATUS"] in ("preliminary", "pending")]
    if final:
        return result("pass", f"{len(final)} pathology report(s) in final status", final)
    if pending:
        return result("not_evaluated", f"{len(pending)} pathology report(s) preliminary/pending - awaiting final", pending)
    return result("fail", "no pathology report on record")


def _ihc_score(text):
    t = (text or "").lower().replace(" ", "")
    for s in ("3+", "2+", "1+", "0"):
        if f"ihc={s}" in t:
            return s
    return None


def discordance(ctx, rule, tj):
    """DOC-DISC-001 - HER2 differs across specimens: surface, never resolve."""
    ihc = [e for e in ctx.history("HER2_IHC") if e["SPECIMEN_ID"]]
    by_spec = {}
    for e in ihc:
        by_spec.setdefault(e["SPECIMEN_ID"], e)
    scores = {s: _ihc_score(e["VALUE_TEXT"]) for s, e in by_spec.items()}
    ids = [e["EVENT_ID"] for e in by_spec.values()]
    if len({v for v in scores.values() if v}) > 1:
        return result("conflicting", "HER2 IHC differs across specimens (" +
                      ", ".join(f"{s}: {v}" for s, v in scores.items()) +
                      ") - both readings surfaced for human reconciliation, never auto-resolved", ids)
    if len(by_spec) > 1:
        return result("pass", f"HER2 read on {len(by_spec)} specimens with the same IHC score", ids)
    return result("pass", "no cross-specimen discordance on record", ids)


def her2(ctx, rule, tj):
    """DOC-HER2-001 - IHC 0/1+/3+ final; 2+ needs FISH (ASCO/CAP 2018)."""
    if ctx.scope_known and not ctx.breast:
        return None
    ihc = ctx.latest("HER2_IHC")
    if ihc is None:
        return result("fail", "no HER2 IHC recorded")
    if _ihc_score(ihc["VALUE_TEXT"]) != "2+":
        return result("pass", f"HER2 status final from IHC alone: {ihc['VALUE_TEXT']}", [ihc["EVENT_ID"]])
    fish = [e for e in ctx.history("HER2_FISH") if e["STATUS"] == "final"
            and e["EVENT_TIME"] and e["EVENT_TIME"] >= ihc["EVENT_TIME"]]
    if not fish:
        return result("not_evaluated", f"HER2 IHC 2+ ({ihc['VALUE_TEXT']}) - FISH reflex required, no FISH result on "
                                       "record yet", [ihc["EVENT_ID"]])
    f = fish[0]
    ratio = re.search(r"ratio=([0-9.]+)", f["VALUE_TEXT"] or "")
    copies = re.search(r"copies=([0-9.]+)", f["VALUE_TEXT"] or "")
    ids = [ihc["EVENT_ID"], f["EVENT_ID"]]
    if not (ratio and copies):
        return result("not_evaluated", f"FISH on record but ratio/copy number unreadable ({f['VALUE_TEXT']})", ids)
    r, c = float(ratio.group(1)), float(copies.group(1))
    if r >= 2.0 and c >= 4.0:
        return result("pass", f"HER2 final: IHC 2+ reflexed to FISH, amplified (ratio {r:g}, {c:g} copies/cell - "
                              "ASCO/CAP 2018 group 1)", ids)
    if r < 2.0 and c < 4.0:
        return result("pass", f"HER2 final: IHC 2+ reflexed to FISH, not amplified (ratio {r:g}, {c:g} copies/cell - "
                              "ASCO/CAP 2018 group 5)", ids)
    return result("not_evaluated", f"FISH ratio {r:g} with {c:g} copies/cell is ASCO/CAP 2018 group 2-4 - concurrent "
                                   "IHC review required, not final", ids)


def surgical_clearance(ctx, rule, tj):
    """SURG-CLEAR-001 - three verified assertions after a surgical interruption."""
    if not ctx.docs("surgical_note"):
        return None
    got = {}
    for a in ctx.assertions:
        got.setdefault(a["PREDICATE"], a)
    need = ["wound_healing_status", "infection_status", "surgical_clearance_signed_by_practitioner"]
    missing = [n for n in need if n not in got]
    ids = [got[n]["ASSERTION_ID"] for n in need if n in got]
    if missing:
        return result("not_evaluated", "surgical clearance needs three verified assertions; missing: "
                                       + ", ".join(missing), ids)
    w, i, s = (got[n]["VALUE"] for n in need)
    if w not in ("adequate", "healed"):
        return result("fail", f"wound_healing_status is '{w}' - required: adequate or healed", ids)
    if i != "resolved":
        return result("fail", f"infection_status is '{i}' - required: resolved", ids)
    return result("pass", f"surgical clearance verified: wound={w}, infection={i}, signed by {s}", ids)


# ---------------------------------------------------- identity / coverage --

def id_link(ctx, rule, tj):
    linked = [m for m in ctx.id_map if m["LINK_STATUS"] in ("abha_linked", "manually_verified")]
    if linked:
        return result("pass", f"{len(linked)} verified identifier link(s) (abha_linked or manually_verified)",
                      [m["MAP_ID"] for m in linked])
    return result("fail", "no verified identifier link on file - abha_linked or manually_verified required")


def id_quarantine(ctx, rule, tj):
    q = [m for m in ctx.id_map if m["LINK_STATUS"] == "quarantined"]
    if q:
        return result("fail", f"{len(q)} quarantined identity match(es) - reconcile before any evidence counts (R4)",
                      [m["MAP_ID"] for m in q])
    return result("pass", "no quarantined identity match on record")


def coverage_limit(ctx, rule, tj):
    c = ctx.coverage
    if c is None or c["ANNUAL_LIMIT"] is None:
        return result("not_evaluated", "no coverage row on file")
    ids = [c["COVERAGE_ID"]]
    if (c["USED_AMOUNT"] or 0) < c["ANNUAL_LIMIT"]:
        return result("pass", f"used {num(c['USED_AMOUNT'])} of annual limit {num(c['ANNUAL_LIMIT'])} - patient-level "
                              "figure; the family-floater balance is not known (R3)", ids)
    return result("fail", f"used {num(c['USED_AMOUNT'])} meets or exceeds annual limit {num(c['ANNUAL_LIMIT'])}", ids)


def coverage_auth(ctx, rule, tj):
    a = ctx.authorization
    if a is None:
        return result("not_evaluated", "no pre-authorisation on record for this patient/encounter")
    ids, status, letter = [a["AUTH_ID"]], a["STATUS"], a["LETTER_STATUS"]
    if letter and letter != status:
        return result("conflicting", f"pre-auth system status is '{status}' but the letter says '{letter}' - "
                                     "human reconciliation required", ids)
    if status == "approved":
        return result("pass", "pre-authorisation approved and current", ids)
    if status == "pending":
        return result("not_evaluated", "pre-authorisation pending - decision not yet issued", ids)
    if status == "expired":
        return result("fail", "pre-authorisation expired - renewal required", ids)
    return result("fail", f"pre-authorisation status: {status}", ids)


RULES = {
    "CLIN-ANC-001": blood_count, "CLIN-PLT-001": blood_count, "CLIN-CRCL-001": crcl,
    "CLIN-BILI-001": bilirubin, "CLIN-PANEL-001": panel, "ENDO-HBA1C-001": simple_threshold,
    "ENDO-DEXA-001": dexa, "SURV-LVEF-001": lvef_current, "SURV-LVEF-002": lvef_delta,
    "SAFE-HBV-001": hbv, "SAFE-PREG-001": pregnancy, "SAFE-DPYD-001": dpyd,
    "SAFE-PEMVIT-001": pemetrexed_vitamins, "SAFE-INR-001": inr_on_warfarin,
    "DOSE-ANTHRA-001": anthracycline, "DOSE-HLOAD-001": trastuzumab_gap, "DOSE-WT-001": weight_current,
    "DOC-PATH-001": pathology_final, "DOC-DISC-001": discordance, "DOC-HER2-001": her2,
    "DOC-CONSENT-001": consent, "DOC-MDT-001": mdt, "DOC-ORDER-001": order,
    "DOC-DISCH-001": discharge, "DOC-ALLERGY-001": allergy, "SURG-CLEAR-001": surgical_clearance,
    "ID-LINK-001": id_link, "ID-QUAR-001": id_quarantine,
    "COV-LIMIT-001": coverage_limit, "COV-AUTH-001": coverage_auth,
}


def evaluate(ctx, rules):
    """Pure: context + current rule rows -> gate list. Tested without an account."""
    gates = []
    for r in rules:
        fn = RULES.get(r["RULE_ID"])
        tj = _json(r["THRESHOLD_JSON"]) or {}
        if fn is None:
            res = result("not_evaluated", f"rule {r['RULE_ID']} has no evaluator")
        else:
            try:
                res = fn(ctx, r, tj)
            except Exception as exc:  # fail closed: an evaluator error is never a pass
                res = result("not_evaluated", f"evaluator error ({type(exc).__name__}: {exc}) - not evaluated, "
                                              "never passed by default")
        if res is None:
            continue
        gates.append({"gate": r["GATE"], "rule_id": r["RULE_ID"], "rule_version": r["RULE_VERSION"],
                      "outcome": res["outcome"], "severity": r["SEVERITY"], "reason": res["reason"],
                      "evidence_ids": res["evidence_ids"], "derived": res["derived"],
                      "known_as_of": ctx.known_as_of.strftime(TS)})
    return gates


# --------------------------------------------------------------- fetching --

def load(session, patient_id, encounter_id, known_as_of_text):
    kao = _rows(session, "SELECT COALESCE(TRY_TO_TIMESTAMP_NTZ(?), CURRENT_TIMESTAMP()::TIMESTAMP_NTZ) AS K",
                [known_as_of_text])[0]["K"]
    enc = _rows(session, "SELECT scheduled_time, cycle_number FROM SAARTHI.CORE.ENCOUNTER WHERE encounter_id = ?",
                [encounter_id])
    encounter = enc[0] if enc else {}
    scheduled = encounter.get("SCHEDULED_TIME") or kao
    patient = (_rows(session, "SELECT dob, gender FROM SAARTHI.CORE.PATIENT WHERE patient_id = ?", [patient_id]) or [None])[0]
    plan = (_rows(session, """
        SELECT plan_id, version, regimen_code, regimen_display, decided_at, decision_forum
          FROM SAARTHI.CORE.TREATMENT_PLAN
         WHERE patient_id = ? AND (decided_at IS NULL OR decided_at <= ?)
         QUALIFY ROW_NUMBER() OVER (ORDER BY version DESC, decided_at DESC NULLS LAST) = 1""",
                  [patient_id, kao]) or [None])[0]
    regimen = None
    if plan and plan["REGIMEN_CODE"]:
        regimen = (_rows(session, """
            SELECT regimen_code, agents, cycle_days, myelosuppressive, threshold_profile, protocol_ref
              FROM SAARTHI.OPERATIONAL.REGIMEN_REGISTRY WHERE regimen_code = ?""", [plan["REGIMEN_CODE"]]) or [None])[0]
    events = _rows(session, """
        SELECT event_id, event_type, concept_name, value_num, value_text, status, plausibility_state,
               event_time, source_recorded_at, derivation, specimen_id, code
          FROM SAARTHI.CORE.DT_HARMONIZED_EVENTS
         WHERE patient_id = ? AND ingested_at <= ?""", [patient_id, kao])
    diagnoses = [e["CODE"] for e in events if e["EVENT_TYPE"] == "diagnosis"]
    id_map = _rows(session, "SELECT map_id, link_status FROM SAARTHI.CORE.ID_MAP WHERE patient_id = ?", [patient_id])
    coverage = (_rows(session, """
        SELECT coverage_id, used_amount, annual_limit FROM SAARTHI.CORE.COVERAGE
         WHERE patient_id = ? ORDER BY priority ASC NULLS LAST LIMIT 1""", [patient_id]) or [None])[0]
    authorization = (_rows(session, """
        SELECT auth_id, status, letter_status FROM SAARTHI.CORE.AUTHORIZATION
         WHERE patient_id = ? AND (encounter_id = ? OR encounter_id IS NULL)
           AND (expires_at IS NULL OR expires_at > ?)          -- valid AT THE VISIT
           AND (requested_at IS NULL OR requested_at <= ?)     -- and known by known_as_of
         ORDER BY decided_at DESC NULLS LAST, requested_at DESC NULLS LAST LIMIT 1""",
                           [patient_id, encounter_id, scheduled, kao]) or [None])[0]
    documents = _rows(session, """
        SELECT doc_id, doc_type, signed_at, effective_at, status FROM SAARTHI.DOCUMENTS.DOCUMENT
         WHERE patient_id = ? AND scope = 'patient' AND ingested_at <= ?""", [patient_id, kao])
    assertions = _rows(session, """
        SELECT assertion_id, predicate, value FROM SAARTHI.EVIDENCE.ASSERTION
         WHERE subject = ? AND verification_status = 'verified'
         ORDER BY assertion_id DESC""", [patient_id])
    conflicted = {r["EVENT_ID"]: _json(r["ASSERTION_IDS"]) for r in _rows(session, """
        SELECT l.target_id AS event_id, ARRAY_AGG(l.assertion_id) AS assertion_ids
          FROM SAARTHI.EVIDENCE.EVIDENCE_LINK l
          JOIN SAARTHI.EVIDENCE.ASSERTION a
            ON a.assertion_id = l.assertion_id AND a.verification_status = 'verified'
          JOIN SAARTHI.CORE.CLINICAL_EVENT ce ON ce.event_id = l.target_id AND ce.patient_id = ?
         WHERE l.relation = 'conflicts_with' AND l.target_type = 'clinical_event'
           AND NOT EXISTS (SELECT 1 FROM SAARTHI.EVIDENCE.EVIDENCE_LINK s
                            WHERE s.target_id = l.target_id AND s.relation = 'supports')
         GROUP BY l.target_id""", [patient_id])}
    return Ctx(kao, scheduled, patient, encounter, plan, regimen, diagnoses, events,
               id_map, coverage, authorization, documents, assertions, conflicted)


def current_rules(session):
    return _rows(session, """
        SELECT rule_id, rule_version, gate, severity, threshold_json
          FROM SAARTHI.OPERATIONAL.RULE_CATALOG
         WHERE effective_to IS NULL
         QUALIFY ROW_NUMBER() OVER (PARTITION BY rule_id ORDER BY rule_version DESC) = 1
         ORDER BY specificity DESC, rule_id""")


def run(session, p_patient_id, p_encounter_id, p_known_as_of=None):
    ctx = load(session, p_patient_id, p_encounter_id, p_known_as_of)
    return {"patient_id": p_patient_id, "encounter_id": p_encounter_id,
            "regimen": ctx.plan["REGIMEN_CODE"] if ctx.plan else None,
            "gates": evaluate(ctx, current_rules(session))}
$$;
