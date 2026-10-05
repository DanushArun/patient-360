"""Paired workflow observations and explicitly priced consumption economics."""
from __future__ import annotations

from math import isfinite, log
from random import Random
from statistics import median


def summarize(rows: list[dict]) -> dict:
    groups = {arm: [r for r in rows if r["arm"] == arm] for arm in ("manual", "assisted")}
    ids = {arm: {r["case_id"] for r in group} for arm, group in groups.items()}
    if not ids["manual"] or ids["manual"] != ids["assisted"]:
        raise ValueError("paired cases required")
    if any(len(ids[arm]) != len(group) for arm, group in groups.items()):
        raise ValueError("duplicate arm/case observations")
    output = {}
    for arm, group in groups.items():
        times = [float(row["seconds"]) for row in group]
        if any(not isfinite(t) or t <= 0 for t in times):
            raise ValueError("review time must be positive")
        contradictions = [r for r in group if r["contradiction"]]
        caught = sum(r["caught"] for r in contradictions)
        output[arm] = {"reviews": len(group), "median_seconds": median(times),
                       "reviews_per_hour": 3600 * len(group) / sum(times),
                       "correct": sum(row["correct"] for row in group),
                       "contradictions_caught": caught, "contradictions": len(contradictions),
                       "catch_rate": caught / len(contradictions) if contradictions else None}
    output["median_reduction_percent"] = 100 * (
        1 - output["assisted"]["median_seconds"] / output["manual"]["median_seconds"])
    paired = {r["case_id"]: r["seconds"] for r in groups["manual"]}
    output["paired_median_seconds_saved"] = median(
        paired[r["case_id"]] - r["seconds"] for r in groups["assisted"])
    return output


def simulate(config: dict) -> list[dict]:
    rng = Random(config["seed"])
    rows = []
    for index in range(config["cases"]):
        contradiction = index % 3 == 0
        order = ["manual", "assisted"] if index % 2 == 0 else ["assisted", "manual"]
        for position, arm in enumerate(order):
            seconds = rng.lognormvariate(log(config[f"{arm}_median_s"]), config["sigma"])
            if contradiction:
                seconds += config[f"{arm}_conflict_overhead_s"]
            correct = rng.random() < config[f"{arm}_correct_rate"]
            caught = contradiction and rng.random() < config[f"{arm}_catch_rate"]
            rows.append({"case_id": f"SIM-{index:04d}", "arm": arm, "order": position,
                         "seconds": seconds, "correct": correct,
                         "contradiction": contradiction, "caught": caught})
    return rows


def economics(usage: dict | None, config: dict) -> dict:
    if usage is None:
        return {"status": "unmeasured", "reason": "consumption evidence not supplied"}
    reviews = config["reviews"]
    if reviews <= 0:
        raise ValueError("completed reviews must be positive")
    required = ("warehouse_credits", "llm_credits", "search_credits")
    if any(key not in usage or usage[key] is None for key in required):
        return {"status": "unmeasured", "reason": "incomplete consumption attribution"}
    if any(not isfinite(usage[key]) or usage[key] < 0 for key in required):
        raise ValueError("invalid consumption")
    credit_price = config["credit_price"]
    wage = config.get("hourly_wage", 0)
    if any(not isfinite(value) or value < 0 for value in (credit_price, wage)):
        raise ValueError("invalid pricing or wage")
    cost = sum(usage[key] for key in required) * credit_price / reviews
    saving = config.get("seconds_saved", 0) * config.get("hourly_wage", 0) / 3600
    return {"status": "calculated_from_supplied_usage", "reviews": reviews,
            "credits_per_review": {key: usage[key] / reviews for key in required},
            "cost_per_review": cost, "labor_value_per_review": saving,
            "estimated_net_value_per_review": saving - cost,
            "currency": config.get("currency", "unspecified"),
            "attribution_method": usage.get("attribution_method", "unspecified"),
            "source_query_ids": usage.get("source_query_ids", [])}
