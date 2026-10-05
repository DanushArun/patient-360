from backend.scripts.build_deploy_bundle import build


def test_deploy_when_normalized_units_required_installs_dynamic_table_before_readers() -> None:
    bundle = build()
    sql = bundle['01_web_procedures.sql']
    assert sql.index('CREATE OR REPLACE DYNAMIC TABLE SAARTHI.CORE.DT_HARMONIZED_EVENTS') < (
        sql.index('CREATE OR REPLACE PROCEDURE SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA'))
