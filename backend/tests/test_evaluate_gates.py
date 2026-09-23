"""Rule logic of evaluate_gates, run locally with no Snowflake account.

The procedure body is Python inside backend/sql/procedures/evaluate_gates.sql.
This test loads that exact source (between the $$ markers), builds contexts by
hand, and checks each rule against the outcome its governing document implies
(evidence/clinical/requirements.yaml). Rule thresholds come from
backend/sql/data/rules.sql, the file the deploy loads - so a threshold edited
there without the evaluator agreeing fails here.

What this does not test: the SQL that fetches the context (known_as_of cutoffs,
joins). That runs on a live account in backend/scripts/run_rule_fixtures.py.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SQL = (ROOT / "backend/sql/procedures/evaluate_gates.sql").read_text()
ENGINE: dict = {}
exec(compile(SQL.split("$$")[1], "evaluate_gates.py", "exec"), ENGINE)

VISIT = datetime(2026, 9, 25, 9, 30)


def _rules() -> list[dict]:
    """Current (highest) version of every rule in rules.sql, as RULE_CATALOG rows."""
    text = (ROOT / "backend/sql/data/rules.sql").read_text()
    rows: dict[str, dict] = {}
    for m in re.finditer(r"VALUES \('([A-Z0-9-]+)', (\d+), '(\w+)',.*?PARSE_JSON\('(.*?)'\),.*?'(blocker|advisory)'",
                         text, re.S):
        rid, ver = m.group(1), int(m.group(2))
        if rid not in rows or rows[rid]["RULE_VERSION"] < ver:
            rows[rid] = {"RULE_ID": rid, "RULE_VERSION": ver, "GATE": m.group(3),
                         "THRESHOLD_JSON": m.group(4), "SEVERITY": m.group(5)}
    return list(rows.values())


RULES = _rules()

REGIMENS = {  # mirrors backend/sql/data/regimens.sql
    "AC": (["doxorubicin", "cyclophosphamide"], 21, True, "BRAJAC"),
    "AC-TH": (["paclitaxel", "trastuzumab"], 21, True, "BRAJACTT"),
    "TH": (["paclitaxel", "trastuzumab"], 7, True, "BRAJTTW"),
    "H-MAINT": (["trastuzumab"], 21, False, "BRAJTR"),
    "FOLFOX": (["oxaliplatin", "fluorouracil", "leucovorin"], 14, True, "GIAJFFOX"),
    "CAPOX": (["capecitabine", "oxaliplatin"], 21, True, "GIGAVCOX"),
    "CIS-RT-HN": (["cisplatin"], 21, True, "HNLAPRT"),
    "CIS-RT-CX": (["cisplatin"], 7, True, "GOCXCRT"),
    "PEM-CARBO": (["pemetrexed", "carboplatin"], 21, True, "LUAVPP"),
}

_n = 0


def ev(concept, value=None, days_before=0.5, text=None, status="final", event_type="lab",
       plausible=True, specimen=None, code=None):
    global _n
    _n += 1
    return {"EVENT_ID": f"E{_n}-{concept}", "EVENT_TYPE": event_type, "CONCEPT_NAME": concept,
            "VALUE_NUM": value, "VALUE_TEXT": text, "STATUS": status,
            "PLAUSIBILITY_STATE": "present" if plausible else "unreadable",
            "EVENT_TIME": VISIT - timedelta(days=days_before), "DERIVATION": None,
            "SPECIMEN_ID": specimen, "CODE": code}


def ctx(regimen="AC", events=(), cycle=3, dob=date(1970, 1, 1), gender="female", docs=(),
        assertions=(), forum="tumour_board", plan_decided_days=100, known_as_of=None):
    if regimen:
        agents, cycle_days, myelo, proto = REGIMENS[regimen]
        reg = {"REGIMEN_CODE": regimen, "AGENTS": json.dumps(agents), "CYCLE_DAYS": cycle_days,
               "MYELOSUPPRESSIVE": myelo, "THRESHOLD_PROFILE": regimen, "PROTOCOL_REF": proto}
        plan = {"PLAN_ID": "P1", "VERSION": 1, "REGIMEN_CODE": regimen, "DECISION_FORUM": forum,
                "DECIDED_AT": VISIT - timedelta(days=plan_decided_days)}
    else:
        reg, plan = None, None
    return ENGINE["Ctx"](known_as_of or VISIT - timedelta(hours=12), VISIT,
                         {"DOB": dob, "GENDER": gender}, {"CYCLE_NUMBER": cycle}, plan, reg,
                         ["C50.9"], list(events), [{"MAP_ID": "M1", "LINK_STATUS": "manually_verified"}],
                         None, None, list(docs), list(assertions))


def gate(c, rule_id):
    out = [g for g in ENGINE["evaluate"](c, RULES) if g["rule_id"] == rule_id]
    return out[0] if out else None


def outcome(c, rule_id):
    g = gate(c, rule_id)
    return g["outcome"] if g else "not_applicable"


# ---------------------------------------------------------- blood counts ------

@pytest.mark.parametrize("regimen,anc,expected", [
    ("FOLFOX", 1300, "pass"),       # GIAJFFOX p4: hold only below 1.2
    ("FOLFOX", 1100, "fail"),
    ("CAPOX", 1250, "pass"),        # GIGAVCOX p4
    ("TH", 1050, "pass"),           # BRAJTTW p5: >= 1.0 full dose
    ("CIS-RT-CX", 900, "pass"),     # GOCXCRT p2: >= 0.8 proceed
    ("CIS-RT-HN", 1200, "fail"),    # HNLAPRT p3: 1.0-1.5 is the 75% band
    ("PEM-CARBO", 1600, "pass"),
    ("PEM-CARBO", 1400, "fail"),    # LUAVPP p2: < 1.5 delay
])
def test_anc_uses_the_regimen_threshold(regimen, anc, expected):
    assert outcome(ctx(regimen, [ev("ANC", anc)]), "CLIN-ANC-001") == expected


@pytest.mark.parametrize("regimen,plt,expected", [
    ("AC", 95000, "pass"),          # BRAJAC p2: >= 90 full dose
    ("AC", 82000, "fail"),          # 70-89: 75% band
    ("FOLFOX", 80000, "pass"),      # >= 75
    ("CIS-RT-CX", 85000, "pass"),   # >= 80
    ("CIS-RT-HN", 95000, "fail"),   # 75-100: 75% band
])
def test_platelets_use_the_regimen_threshold(regimen, plt, expected):
    assert outcome(ctx(regimen, [ev("PLT", plt)]), "CLIN-PLT-001") == expected


def test_reduced_dose_band_is_named_in_the_reason():
    g = gate(ctx("AC", [ev("PLT", 82000)]), "CLIN-PLT-001")
    assert "reduced-dose band" in g["reason"] and "BRAJAC" in g["reason"]


def test_blood_counts_do_not_apply_to_trastuzumab_alone():
    c = ctx("H-MAINT", [ev("ANC", 500), ev("PLT", 20000)])  # BRAJTR p2: CBC optional
    assert outcome(c, "CLIN-ANC-001") == "not_applicable"
    assert outcome(c, "CLIN-PLT-001") == "not_applicable"


def test_unknown_regimen_falls_back_to_the_conservative_default():
    assert outcome(ctx(None, [ev("ANC", 1300)]), "CLIN-ANC-001") == "fail"


def test_stale_count_fails_and_names_its_age():
    g = gate(ctx("FOLFOX", [ev("ANC", 3000, days_before=11)]), "CLIN-ANC-001")
    assert g["outcome"] == "fail" and "11 days old" in g["reason"]


def test_missing_count_is_not_evaluated_never_pass():
    assert outcome(ctx("AC", []), "CLIN-ANC-001") == "not_evaluated"


def test_unreadable_latest_value_is_not_evaluated():
    c = ctx("AC", [ev("PLT", 250000, days_before=3), ev("PLT", 9, days_before=0.5, plausible=False)])
    assert outcome(c, "CLIN-PLT-001") == "not_evaluated"


# ---------------------------------------------------------------- renal -------

def renal(regimen, creat, weight=60, dob=date(1970, 1, 1), gender="female", creat_days=0.5):
    return ctx(regimen, [ev("CREATININE", creat, days_before=creat_days), ev("WEIGHT", weight, event_type="vitals")],
               dob=dob, gender=gender)


def test_cisplatin_head_and_neck_at_crcl_40_is_held():
    # The v1 evaluator showed this patient as ready ("meets carboplatin 30 minimum only").
    c = renal("CIS-RT-HN", creat=1.55)          # (140-56)*60*0.85/(72*1.55) = 38.4
    assert outcome(c, "CLIN-CRCL-001") == "fail"


def test_cisplatin_head_and_neck_45_to_60_is_the_80_percent_band():
    g = gate(renal("CIS-RT-HN", creat=1.1), "CLIN-CRCL-001")   # 54.1 mL/min
    assert g["outcome"] == "fail" and "80%" in g["reason"]


def test_cervix_cisplatin_uses_its_own_minimum_of_50():
    assert outcome(renal("CIS-RT-CX", creat=1.1), "CLIN-CRCL-001") == "pass"   # 54 >= 50
    assert outcome(renal("CIS-RT-CX", creat=1.3), "CLIN-CRCL-001") == "fail"   # 45.8 < 50


def test_pemetrexed_below_45_is_held():
    assert outcome(renal("PEM-CARBO", creat=1.4), "CLIN-CRCL-001") == "fail"   # 42.5


def test_crcl_does_not_apply_to_regimens_without_a_renal_gate():
    assert outcome(renal("TH", creat=3.0), "CLIN-CRCL-001") == "not_applicable"


def test_crcl_needs_a_fresh_creatinine():
    g = gate(renal("CIS-RT-HN", creat=0.8, creat_days=12), "CLIN-CRCL-001")
    assert g["outcome"] == "fail" and "12 days old" in g["reason"]


def test_crcl_derivation_is_shown():
    g = gate(renal("CIS-RT-HN", creat=0.8), "CLIN-CRCL-001")
    assert g["derived"].startswith("Cockcroft-Gault") and len(g["evidence_ids"]) == 2


# -------------------------------------------------------------- hepatic -------

def test_doxorubicin_bilirubin_above_1_2_is_not_ready():
    # The v1 evaluator passed anything up to 1.8 mg/dL for every regimen.
    assert outcome(ctx("AC", [ev("BILIRUBIN", 1.5)]), "CLIN-BILI-001") == "fail"
    assert outcome(ctx("AC", [ev("BILIRUBIN", 1.0)]), "CLIN-BILI-001") == "pass"


def test_paclitaxel_limit_is_1_25_times_uln():
    assert outcome(ctx("TH", [ev("BILIRUBIN", 1.45)]), "CLIN-BILI-001") == "pass"   # 1.21 x ULN
    assert outcome(ctx("TH", [ev("BILIRUBIN", 1.6)]), "CLIN-BILI-001") == "fail"    # 1.33 x ULN


def test_bilirubin_rule_skips_regimens_with_no_hepatic_limit():
    assert outcome(ctx("FOLFOX", [ev("BILIRUBIN", 3.0)]), "CLIN-BILI-001") == "not_applicable"


# ----------------------------------------------------------------- panel ------

def test_head_and_neck_panel_lists_what_is_missing():
    evs = [ev(c, 1) for c in ("HEMOGLOBIN", "WBC", "ANC", "PLT", "CREATININE", "SODIUM", "POTASSIUM",
                              "CALCIUM", "ALBUMIN")]
    g = gate(ctx("CIS-RT-HN", evs), "CLIN-PANEL-001")
    assert g["outcome"] == "fail" and "MAGNESIUM" in g["reason"] and "HNLAPRT" in g["reason"]


def test_complete_panel_passes_and_cites_every_result():
    evs = [ev(c, 1) for c in ("HEMOGLOBIN", "WBC", "ANC", "PLT", "CREATININE")]
    g = gate(ctx("CIS-RT-CX", evs), "CLIN-PANEL-001")
    assert g["outcome"] == "pass" and len(g["evidence_ids"]) == 5


def test_panel_does_not_apply_to_trastuzumab_alone():
    assert outcome(ctx("H-MAINT", []), "CLIN-PANEL-001") == "not_applicable"


# ------------------------------------------------------------------ LVEF ------

def test_lvef_in_the_discretion_band_fails_with_the_band_named():
    g = gate(ctx("TH", [ev("LVEF", 47, days_before=20, event_type="imaging")]), "SURV-LVEF-001")
    assert g["outcome"] == "fail" and "discretion" in g["reason"]


def test_lvef_older_than_90_days_fails():
    assert outcome(ctx("H-MAINT", [ev("LVEF", 60, days_before=118, event_type="imaging")]), "SURV-LVEF-001") == "fail"


def test_lvef_must_postdate_the_last_anthracycline_dose():
    evs = [ev("LVEF", 62, days_before=60, event_type="imaging"),
           ev("DOXORUBICIN", 60, days_before=30, status="administered", event_type="medication")]
    assert outcome(ctx("H-MAINT", evs), "SURV-LVEF-001") == "fail"


def test_lvef_rules_do_not_apply_without_trastuzumab():
    assert outcome(ctx("FOLFOX", []), "SURV-LVEF-001") == "not_applicable"


def test_lvef_decline_of_16_points_holds():
    evs = [ev("LVEF", 66, days_before=100, event_type="imaging"), ev("LVEF", 49, days_before=5, event_type="imaging")]
    assert outcome(ctx("TH", evs), "SURV-LVEF-002") == "fail"


# ------------------------------------------------------- screening rules ------

def test_pregnancy_test_required_for_woman_under_50_on_trastuzumab():
    c = ctx("TH", dob=date(1987, 2, 14))
    assert outcome(c, "SAFE-PREG-001") == "fail"
    c = ctx("TH", [ev("BETA_HCG", text="negative", days_before=40)], dob=date(1987, 2, 14))
    assert outcome(c, "SAFE-PREG-001") == "pass"


def test_pregnancy_rule_does_not_apply_at_52_or_to_men():
    assert outcome(ctx("TH", dob=date(1974, 3, 11)), "SAFE-PREG-001") == "not_applicable"
    assert outcome(ctx("TH", dob=date(1987, 1, 1), gender="male"), "SAFE-PREG-001") == "not_applicable"


def test_hbv_screening_is_advisory_and_lists_what_is_missing():
    g = gate(ctx("AC", [ev("HBSAG", text="non-reactive")]), "SAFE-HBV-001")
    assert g["outcome"] == "fail" and g["severity"] == "advisory" and "ANTI_HBC" in g["reason"]


def test_dpyd_required_before_first_fluoropyrimidine_cycle_only():
    assert outcome(ctx("FOLFOX", cycle=1), "SAFE-DPYD-001") == "fail"
    assert outcome(ctx("FOLFOX", cycle=5), "SAFE-DPYD-001") == "pass"      # tolerated earlier cycles
    assert outcome(ctx("FOLFOX", [ev("DPYD", text="intermediate metabolizer (AS 1.0)")], cycle=1),
                   "SAFE-DPYD-001") == "fail"
    assert outcome(ctx("AC", cycle=1), "SAFE-DPYD-001") == "not_applicable"


# ------------------------------------------------------------ dose rules ------

def doxo(n):
    return [ev("DOXORUBICIN", 60, days_before=21 * (i + 1), status="administered", event_type="medication")
            for i in range(n)]


def test_cumulative_doxorubicin_under_400_passes():
    assert outcome(ctx("AC", doxo(2), cycle=3), "DOSE-ANTHRA-001") == "pass"      # 120 + 60


def test_cumulative_doxorubicin_over_400_fails():
    assert outcome(ctx("AC", doxo(6), cycle=7), "DOSE-ANTHRA-001") == "fail"      # 360 + 60


def test_missing_dose_history_is_unknown_not_zero():
    assert outcome(ctx("AC", doxo(1), cycle=3), "DOSE-ANTHRA-001") == "not_evaluated"


def test_trastuzumab_gap_over_six_weeks_needs_the_loading_dose():
    late = [ev("TRASTUZUMAB", 6, days_before=50, status="administered", event_type="medication")]
    ontime = [ev("TRASTUZUMAB", 6, days_before=21, status="administered", event_type="medication")]
    assert outcome(ctx("H-MAINT", late, cycle=9), "DOSE-HLOAD-001") == "fail"
    assert outcome(ctx("H-MAINT", ontime, cycle=9), "DOSE-HLOAD-001") == "pass"


def test_pemetrexed_needs_b12_and_folic_acid():
    assert outcome(ctx("PEM-CARBO"), "SAFE-PEMVIT-001") == "fail"
    vit = [ev("VITAMIN_B12", 1000, days_before=40, status="administered", event_type="medication"),
           ev("FOLIC_ACID", 0.4, days_before=3, status="dispensed", event_type="medication")]
    assert outcome(ctx("PEM-CARBO", vit), "SAFE-PEMVIT-001") == "pass"


def test_inr_rule_only_applies_with_warfarin_on_record():
    assert outcome(ctx("CAPOX"), "SAFE-INR-001") == "not_applicable"
    w = [ev("WARFARIN", 5, days_before=10, status="dispensed", event_type="medication")]
    assert outcome(ctx("CAPOX", w), "SAFE-INR-001") == "fail"
    assert outcome(ctx("CAPOX", w + [ev("INR", 2.1, days_before=2)]), "SAFE-INR-001") == "pass"


# ------------------------------------------------------- documentation --------

def doc(doc_type, days_before, signed=True):
    t = VISIT - timedelta(days=days_before)
    return {"DOC_ID": f"D-{doc_type}-{days_before}", "DOC_TYPE": doc_type, "SIGNED_AT": t if signed else None,
            "EFFECTIVE_AT": t, "STATUS": "active"}


def test_consent_signed_before_the_current_plan_does_not_cover_it():
    assert outcome(ctx("AC", docs=[doc("chemo_consent", 150)], plan_decided_days=100), "DOC-CONSENT-001") == "fail"
    assert outcome(ctx("AC", docs=[doc("chemo_consent", 90)], plan_decided_days=100), "DOC-CONSENT-001") == "pass"


def test_plan_decided_outside_a_tumour_board_fails():
    assert outcome(ctx("AC", forum="opd"), "DOC-MDT-001") == "fail"
    assert outcome(ctx("AC", forum="tumour_board"), "DOC-MDT-001") == "pass"


def test_chemo_order_must_fall_within_the_cycle():
    assert outcome(ctx("TH", docs=[doc("chemo_order", 10)]), "DOC-ORDER-001") == "fail"   # weekly: 7 days
    assert outcome(ctx("TH", docs=[doc("chemo_order", 1)]), "DOC-ORDER-001") == "pass"


def test_discharge_summary_needed_after_cycle_one_only():
    assert outcome(ctx("AC", cycle=1), "DOC-DISCH-001") == "not_applicable"
    assert outcome(ctx("AC", cycle=3), "DOC-DISCH-001") == "fail"
    assert outcome(ctx("AC", cycle=3, docs=[doc("discharge_summary", 21)]), "DOC-DISCH-001") == "pass"


def test_her2_discordance_across_specimens_is_conflicting():
    evs = [ev("HER2_IHC", text="ihc=2+", specimen="S1", event_type="pathology", days_before=60),
           ev("HER2_IHC", text="ihc=3+", specimen="S2", event_type="pathology", days_before=20)]
    assert outcome(ctx("TH", evs), "DOC-DISC-001") == "conflicting"


def test_addendum_recorded_later_supersedes_the_original_result():
    orig = ev("PLT", 95000, days_before=1)
    add = dict(ev("PLT", 85000, days_before=1), STATUS="amended", EVENT_TIME=orig["EVENT_TIME"],
               SOURCE_RECORDED_AT=orig["EVENT_TIME"] + timedelta(days=3))
    orig["SOURCE_RECORDED_AT"] = orig["EVENT_TIME"] + timedelta(hours=2)
    g = gate(ctx("AC", [add, orig]), "CLIN-PLT-001")
    assert g["outcome"] == "fail" and g["evidence_ids"] == [add["EVENT_ID"]]


@pytest.mark.parametrize("anc,plt,expected", [(1600, 95000, "pass"), (1200, 95000, "fail")])
def test_deep_case_three_weekly_paclitaxel_uses_brajactt(anc, plt, expected):
    c = ctx("AC-TH", [ev("ANC", anc), ev("PLT", plt)])        # BRAJACTT p3: >= 1.5 and >= 90
    assert outcome(c, "CLIN-ANC-001") == expected and outcome(c, "CLIN-PLT-001") == "pass"


def test_her2_2plus_waits_for_fish():
    evs = [ev("HER2_IHC", text="grade=III ihc=2+", event_type="pathology", days_before=50)]
    assert outcome(ctx("AC", evs), "DOC-HER2-001") == "not_evaluated"
    evs.append(ev("HER2_FISH", text="ratio=2.6 copies=5.8", event_type="pathology", days_before=10))
    assert outcome(ctx("AC", evs), "DOC-HER2-001") == "pass"


# ------------------------------------------------------------- contract -------

def test_every_rule_in_rules_sql_has_an_evaluator():
    missing = [r["RULE_ID"] for r in RULES if r["RULE_ID"] not in ENGINE["RULES"]]
    assert missing == []


def test_every_gate_carries_rule_version_and_known_as_of():
    for g in ENGINE["evaluate"](ctx("AC", [ev("ANC", 2000)]), RULES):
        assert g["rule_version"] >= 1 and g["known_as_of"] and g["outcome"] in (
            "pass", "fail", "not_evaluated", "conflicting")


def test_an_evaluator_error_is_not_evaluated_never_pass():
    rules = [dict(RULES[0], RULE_ID="CLIN-ANC-001", THRESHOLD_JSON="{}")]   # missing keys -> KeyError
    g = ENGINE["evaluate"](ctx("AC", [ev("ANC", 2000)]), rules)[0]
    assert g["outcome"] == "not_evaluated" and "evaluator error" in g["reason"]
