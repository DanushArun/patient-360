from pathlib import Path

import pytest


SOURCE = Path('backend/sql/procedures/web_reads.sql')


@pytest.mark.parametrize('view', ['context', 'snapshot', 'tasks', 'answers', 'packets',
                                  'document', 'documents'])
def test_web_view_when_consent_partitioned_checks_categories_before_return(view: str) -> None:
    source = SOURCE.read_text().split('GET_WEB_PATIENT_DATA(', 1)[1]
    guard = source.split('-- <<< SAARTHI PREAMBLE v1 END', 1)[1]
    guard = guard.split("IF (VIEW_NAME = 'context') THEN", 1)[0]
    assert f"'{view}'" in guard and "'consent_not_valid'" in guard


def test_web_fact_when_domain_requested_checks_clinical_and_identity_not_only_financial() -> None:
    source = SOURCE.read_text().split("ELSEIF (VIEW_NAME = 'facts') THEN", 1)[1]
    assert "WHEN 'demographics' THEN 'identity'" in source and "ELSE 'clinical'" in source


def test_workspace_when_consent_partitioned_requires_identity_before_names() -> None:
    source = SOURCE.read_text().split('CREATE OR REPLACE PROCEDURE', 2)[1]
    assert source.count("ARRAY_CONTAINS('identity'::VARIANT, c.data_categories)") == 4
