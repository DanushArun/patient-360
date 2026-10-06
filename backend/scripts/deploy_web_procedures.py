"""Apply the web read procedures from the working tree to the connected account, restoring
their grants, and confirm the diagnosis field is returned. Re-runnable; changes no data.

    SNOWFLAKE_ACCOUNT=... SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT=... SNOWFLAKE_USER=... \\
    SNOWFLAKE_PRIVATE_KEY_PATH=... .venv/bin/python -m backend.scripts.deploy_web_procedures
"""
from __future__ import annotations

from backend.scripts.install_clean_account import execute_sql
from backend.verification.session import ROOT, connect

FILES = ["backend/sql/procedures/web_patient_context.sql", "backend/sql/procedures/web_reads.sql"]
GRANTS = ["SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA(VARCHAR,VARCHAR)",
          "SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE(VARCHAR,INTEGER)"]


def main() -> int:
    with connect("ACCOUNTADMIN") as session:
        session.query("USE DATABASE SAARTHI")
        for name in FILES:
            execute_sql(session, (ROOT / name).read_text(), name)
        for signature in GRANTS:
            session.query(f"GRANT USAGE ON PROCEDURE {signature} TO ROLE SAARTHI_APP")
        # Same path the app uses: the census procedure, as the application role.
        session.query("USE ROLE SAARTHI_APP")
        rows = session.call("GET_WEB_WORKSPACE", ["census", 7])["rows"]
        with_dx = [row for row in rows if row.get("DIAGNOSIS")]
        print(f"census rows: {len(rows)}; with diagnosis: {len(with_dx)}")
        print("sample:", {(row["NAME"], row["DIAGNOSIS"], row["DIAGNOSIS_CODE"]) for row in with_dx[:3]})
        return 0 if rows and len(with_dx) == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
