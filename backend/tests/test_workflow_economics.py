import pytest


def test_workflow_when_cases_are_unpaired_rejects_comparison() -> None:
    from backend.verification.economics import summarize

    with pytest.raises(ValueError, match="paired"):
        summarize([{"case_id": "C1", "arm": "manual", "seconds": 30,
                    "correct": True, "contradiction": False, "caught": False}])


def test_cost_when_consumption_unavailable_does_not_invent_zero() -> None:
    from backend.verification.economics import economics

    assert economics(None, {"reviews": 10, "credit_price": 3})["status"] == "unmeasured"


def test_cost_when_counts_zero_rejects_division() -> None:
    from backend.verification.economics import economics

    with pytest.raises(ValueError, match="reviews"):
        economics({"warehouse_credits": 1, "llm_credits": 1, "search_credits": 1},
                  {"reviews": 0, "credit_price": 3})


@pytest.mark.parametrize("price", [-1, float("nan"), float("inf")])
def test_cost_when_price_invalid_rejects_result(price: float) -> None:
    from backend.verification.economics import economics

    with pytest.raises(ValueError, match="pricing"):
        economics({"warehouse_credits": 1, "llm_credits": 1, "search_credits": 1},
                  {"reviews": 1, "credit_price": price})
