import re
from pathlib import Path

SEEDS = ['backend/sql/data/load_synthetic.sql', 'backend/sql/data/load_daycare_cohort.sql']


def required_snapshot_categories() -> set[str]:
    # GET_WEB_PATIENT_DATA refuses the snapshot view unless the bound consent
    # carries every category this guard names.
    source = Path('backend/sql/procedures/web_reads.sql').read_text()
    guard = source.split("IF (VIEW_NAME IN ('context','snapshot'", 1)[1].split('THEN', 1)[0]
    return set(re.findall(r"ARRAY_CONTAINS\('(\w+)'", guard))


def seeded_consent_categories() -> dict[str, set[str]]:
    found = {}
    for path in SEEDS:
        text = Path(path).read_text()
        for block in re.findall(r'INTO SAARTHI\.GOVERNANCE\.CONSENT.*?;', text, re.S):
            for consent, categories in re.findall(
                    r"'(CON-[\w-]+)'.*?ARRAY_CONSTRUCT\(([^)]*)\)", block, re.S):
                found[consent] = set(re.findall(r"'(\w+)'", categories))
    return found


def test_snapshot_guard_names_the_three_categories() -> None:
    assert required_snapshot_categories() == {'identity', 'clinical', 'financial'}


def test_every_seeded_patient_consent_opens_the_patient_snapshot() -> None:
    consents = seeded_consent_categories()
    assert 'CON-DEEP-0001' in consents
    missing = {cid: sorted(required_snapshot_categories() - cats)
               for cid, cats in consents.items() if required_snapshot_categories() - cats}
    assert missing == {}
