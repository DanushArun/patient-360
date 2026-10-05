import re
from pathlib import Path

RULES = Path('backend/sql/data/rules.sql').read_text()


def versions(rule_id: str) -> dict[int, str]:
    # rule_version -> disease_scope, read from each MERGE's VALUES tuple.
    found = {}
    for version, scope in re.findall(
            rf"VALUES \('{rule_id}', (\d+), '\w+', '\w+', (NULL|'\w+')", RULES):
        found[int(version)] = scope.strip("'")
    return found


def test_dexa_latest_version_is_scoped_to_breast_cancer() -> None:
    # applies_to is "patients on an aromatase inhibitor or bone-modifying agent";
    # 'oncology' fired it for a male FOLFOX colon patient (PAT-DC-11).
    dexa = versions('ENDO-DEXA-001')
    assert dexa[max(dexa)] == 'breast_cancer'


def test_superseded_rule_versions_are_closed_when_successor_takes_effect() -> None:
    # evaluate_gates filters disease_scope before picking the newest version, so an
    # open-ended older version would still fire wherever the newer one is out of scope.
    for rule_id in set(re.findall(r"VALUES \('([A-Z0-9-]+)', \d+,", RULES)):
        for old in [v for v in versions(rule_id) if v < max(versions(rule_id))]:
            assert re.search(
                rf"UPDATE SAARTHI\.OPERATIONAL\.RULE_CATALOG\s+SET effective_to = .*?"
                rf"WHERE rule_id = '{rule_id}' AND rule_version = {old}", RULES, re.S), (rule_id, old)
