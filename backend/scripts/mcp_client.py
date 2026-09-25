#!/usr/bin/env python3
"""SAARTHI MCP client - drives SAARTHI_MCP over the Snowflake-managed REST
endpoint using a PAT.

This is the client side of what an external agent (Claude Desktop, Cursor,
another Snowflake CoWork agent) would do. It uses only `requests` and the
JSON-RPC 2.0 grammar that MCP mandates; no MCP SDK needed. Everything the
script does is auditable in ~150 lines.

Usage:
    MCP_PAT="<mcp_pat>" python backend/scripts/mcp_client.py health
    MCP_PAT="<mcp_pat>" python backend/scripts/mcp_client.py list-tools
    MCP_PAT="<mcp_pat>" python backend/scripts/mcp_client.py call "What is missing before Thursday?"

The PAT must be a Programmatic Access Token whose ROLE_RESTRICTION is
SAARTHI_MCP_CLIENT (see backend/sql/governance/04_pat_provisioning.sql).
Anything more privileged is a policy violation - fail closed rather than
downgrade the check.

Design notes:
    - Endpoint hostname uses hyphens (IFTDBGM-EA72552), not underscores.
      Snowflake rejects underscored hostnames for MCP servers.
    - Auth header is Bearer, with the mandatory
      X-Snowflake-Authorization-Token-Type: PROGRAMMATIC_ACCESS_TOKEN
      companion header. Without the companion header Snowflake treats the
      PAT as an OAuth session token and rejects it.
    - Uses the streamable-HTTP MCP transport (single POST, single JSON-RPC
      response). No SSE, no long-poll. The server sends the whole answer
      in one payload; large agent responses can exceed 200 KB.
    - Fails closed on any non-2xx response - prints the server body verbatim
      so protocol errors are inspectable, never masked.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from typing import Any

import requests

ACCOUNT_HOST = os.environ.get(
    "SAARTHI_MCP_HOST",
    "IFTDBGM-EA72552.snowflakecomputing.com",
)
MCP_URL = (
    f"https://{ACCOUNT_HOST}"
    "/api/v2/databases/SAARTHI/schemas/OPERATIONAL/mcp-servers/SAARTHI_MCP"
)


def _headers(pat: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {pat}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
    }


def _rpc(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": method,
        "params": params or {},
    }


def _post(pat: str, payload: dict[str, Any]) -> dict[str, Any]:
    resp = requests.post(MCP_URL, headers=_headers(pat), json=payload, timeout=120)
    if resp.status_code >= 300:
        # Fail closed and loud - never soften an auth or protocol error.
        print(f"HTTP {resp.status_code} from {MCP_URL}", file=sys.stderr)
        print(resp.text, file=sys.stderr)
        sys.exit(2)
    # Snowflake MCP may return either JSON or an SSE stream depending on the
    # tool. Parse both defensively.
    ctype = resp.headers.get("content-type", "")
    if "text/event-stream" in ctype:
        # Collect all `data:` lines and merge JSON payloads.
        merged: dict[str, Any] = {}
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                try:
                    chunk = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
                merged.update(chunk)
        return merged
    return resp.json()


def health(pat: str) -> None:
    """Ping the endpoint and confirm the server responds. Uses `initialize`,
    which the MCP spec requires to be the first call in any session."""
    result = _post(
        pat,
        _rpc(
            "initialize",
            {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "saarthi-mcp-client", "version": "0.1.0"},
            },
        ),
    )
    print(json.dumps(result, indent=2))


def list_tools(pat: str) -> None:
    """Enumerate the tools exposed by the MCP server. We expect exactly one:
    saarthi_agent (CORTEX_AGENT_RUN → SAARTHI.OPERATIONAL.SAARTHI_AGENT)."""
    # Initialize first, per protocol.
    _post(pat, _rpc("initialize", {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "saarthi-mcp-client", "version": "0.1.0"},
    }))
    result = _post(pat, _rpc("tools/list"))
    tools = result.get("result", {}).get("tools", [])
    print(f"Discovered {len(tools)} tool(s):")
    for t in tools:
        print(f"  - {t.get('name')}: {t.get('description', '')[:120]}")
    if len(tools) != 1 or tools[0].get("name") not in ("saarthi_agent", "SAARTHI_AGENT"):
        print(
            "WARNING: expected exactly 1 tool named saarthi_agent. "
            "Anything else means the MCP spec drifted from saarthi_mcp.sql.",
            file=sys.stderr,
        )
        sys.exit(3)


def call(pat: str, question: str) -> None:
    """Invoke saarthi_agent with a natural-language question. The MCP server
    forwards to SAARTHI_AGENT, which routes through its 8 generic tools
    and enforces the classify_question / validate_answer discipline."""
    _post(pat, _rpc("initialize", {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "saarthi-mcp-client", "version": "0.1.0"},
    }))
    result = _post(
        pat,
        _rpc(
            "tools/call",
            {
                "name": "saarthi_agent",
                "arguments": {"text": question},
            },
        ),
    )
    print(json.dumps(result, indent=2))


def main() -> None:
    pat = os.environ.get("MCP_PAT")
    if not pat:
        print(
            "MCP_PAT env var is required. Store the PAT via `cortex secret "
            "store mcp_pat` and inject inline: `MCP_PAT=\"<mcp_pat>\" python ...`",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "health":
        health(pat)
    elif cmd == "list-tools":
        list_tools(pat)
    elif cmd == "call":
        if len(sys.argv) < 3:
            print("Usage: mcp_client.py call \"<question>\"", file=sys.stderr)
            sys.exit(1)
        call(pat, " ".join(sys.argv[2:]))
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
