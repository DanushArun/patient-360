"""Strict Snowflake sessions; no fabricated query identifiers or permissive TLS fallback."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
import hashlib
import json
import os
from pathlib import Path
import re
from time import perf_counter
from typing import Any, Iterator

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[2]


def connection_options(role: str, use_warehouse: bool = True) -> dict[str, Any]:
    env = {**dotenv_values(ROOT / "frontend/.env.local"), **os.environ}
    account = env.get("SNOWFLAKE_ACCOUNT")
    expected = env.get("SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT", "KGTPGHJ-YJ28449")
    if not account or account.upper() != expected.upper():
        raise ValueError("snowflake_account_mismatch")
    key = env.get("SNOWFLAKE_PRIVATE_KEY_PATH")
    if not key or not env.get("SNOWFLAKE_USER"):
        raise ValueError("Snowflake user and private key path are required")
    path = Path(key).expanduser()
    path = path if path.is_absolute() else ROOT / "frontend" / path
    if not path.is_file():
        raise ValueError("private key file missing")
    options = {"account": account, "user": env["SNOWFLAKE_USER"],
            "private_key_file": str(path), "role": role,
            "warehouse": env.get("SNOWFLAKE_WAREHOUSE", "SAARTHI_AI_WH"),
            "ocsp_fail_open": False, "login_timeout": 20, "network_timeout": 30,
            "session_parameters": {"TIMEZONE": "UTC", "QUERY_TAG": "saarthi_release_verification",
                                   "STATEMENT_TIMEOUT_IN_SECONDS": 120}}
    if not use_warehouse:
        del options['warehouse']
    return options


@dataclass
class Session:
    connection: Any
    events: list[dict[str, Any]] = field(default_factory=list)

    def query(self, sql: str, params: tuple = (), label: str = "query") -> list[dict]:
        cursor = self.connection.cursor()
        start = perf_counter()
        event = {"label": label, "sql_sha256": hashlib.sha256(sql.encode()).hexdigest()}
        try:
            cursor.execute(sql, params, timeout=120)
            columns = [column[0] for column in cursor.description or []]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
            event.update(status="PASS", rows=len(rows))
            return rows
        except Exception as error:
            event.update(status="FAIL", error_type=type(error).__name__,
                         error_code=getattr(error, "errno", None))
            raise
        finally:
            event.update(query_id=cursor.sfqid, elapsed_ms=(perf_counter() - start) * 1000)
            self.events.append(event)
            cursor.close()

    def call(self, procedure: str, args: list[Any]) -> dict:
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", procedure):
            raise ValueError("invalid procedure identifier")
        slots = ",".join("%s" for _ in args)
        rows = self.query(f"CALL SAARTHI.OPERATIONAL.{procedure}({slots})",
                          tuple(args), procedure)
        return variant(rows)


def variant(rows: list[dict]) -> dict:
    if len(rows) != 1 or len(rows[0]) != 1:
        raise ValueError("expected one procedure result")
    value = next(iter(rows[0].values()))
    value = json.loads(value) if isinstance(value, str) else value
    if not isinstance(value, dict):
        raise ValueError("expected JSON object")
    return value


def require_success(value: dict) -> dict:
    if value.get("error"):
        raise AssertionError(value["error"])
    for child in value.values():
        if isinstance(child, dict):
            require_success(child)
        elif isinstance(child, list):
            for item in child:
                if isinstance(item, dict):
                    require_success(item)
    return value


@contextmanager
def connect(role: str = "SAARTHI_APP", use_warehouse: bool = True) -> Iterator[Session]:
    import snowflake.connector

    connection = snowflake.connector.connect(**connection_options(role, use_warehouse))
    session = Session(connection)
    try:
        session.query("USE SECONDARY ROLES NONE", label="disable_secondary_roles")
        identity = session.query(
            "SELECT CURRENT_ROLE() AS ROLE, CURRENT_SESSION() AS SESSION_ID, "
            "CURRENT_SECONDARY_ROLES() AS SECONDARY", label="session_identity")
        secondary = json.loads(identity[0]["SECONDARY"])
        if identity[0]["ROLE"] != role or secondary.get("roles") != "":
            raise AssertionError("session privileges not bounded")
        yield session
    finally:
        connection.close()
