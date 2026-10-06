# Saarthi MCP — Quickstart for external clients

**Endpoint.** `https://IFTDBGM-EA72552.snowflakecomputing.com/api/v2/databases/SAARTHI/schemas/OPERATIONAL/mcp-servers/SAARTHI_MCP`

**Auth.** Programmatic Access Token (PAT), role-restricted to `SAARTHI_MCP_CLIENT`. OAuth Dynamic Client Registration is not supported by the Snowflake-managed MCP server, so Claude Desktop, Cursor, and other `mcp-remote`-based clients all rely on PATs (see Snowflake community KB article ["Resolving Cursor IDE and Claude Desktop Authentication Errors with the Snowflake-Managed MCP Server"](https://community.snowflake.com/s/article/resolving-mcp-server-authentication-errors-cursor-claude)).

**Governance.** The MCP server exposes exactly one tool — `saarthi_agent` (CORTEX_AGENT_RUN pointing at `SAARTHI.OPERATIONAL.SAARTHI_AGENT`). Every question flows through the same `classify_question` + `validate_answer` gates the Streamlit app uses. No `SYSTEM_EXECUTE_SQL`, no raw tool procedures. Nothing about MCP weakens R5.

---

## Step 1 — Provision the MCP-facing role

Run once, as `ACCOUNTADMIN`:

```bash
snow sql -c EA72552_SNOW -f backend/sql/governance/04_pat_provisioning.sql
```

This creates `SAARTHI_MCP_CLIENT` with `USAGE` on the database, schema, warehouse, MCP server, and agent — and nothing else. No `SELECT` on any table. No `EXECUTE` on any procedure outside the agent chain. It **also** creates `SAARTHI_MCP_DEMO_POLICY` (a permissive `0.0.0.0/0` network policy) and attaches it to `DAKSHA` — Snowflake requires a network policy on the user for PAT authentication, otherwise every request returns `HTTP 401 code=390432 "Network policy is required."`

Verify:

```sql
SHOW GRANTS TO ROLE SAARTHI_MCP_CLIENT;
```

Expect five `USAGE` rows and no others.

## Step 2 — Generate the PAT

This is **SQL**, so it must run inside a Snowflake session — not at your shell prompt. Use `snow sql -q` (single line, mind the quoting):

```bash
snow sql -c EA72552_SNOW -q "ALTER USER DAKSHA ADD PROGRAMMATIC ACCESS TOKEN SAARTHI_MCP_PAT ROLE_RESTRICTION = 'SAARTHI_MCP_CLIENT' DAYS_TO_EXPIRY = 30 COMMENT = 'SAARTHI MCP client - least-privileged, expires in 30 days';"
```

Snowflake prints the token exactly once, in the `token_secret` column of the result table. **Copy it immediately** — there is no way to retrieve it later. If you miss the copy, revoke it with

```bash
snow sql -c EA72552_SNOW -q "ALTER USER DAKSHA REMOVE PROGRAMMATIC ACCESS TOKEN SAARTHI_MCP_PAT;"
```

and start Step 2 over.

## Step 3 — Stash the PAT

```bash
cortex secret store mcp_pat
# paste the token when prompted
```

Never paste the PAT into any file, chat, or ticket. Inline injection at command time is the only correct way to use it.

## Step 4 — Health check

```bash
MCP_PAT="<mcp_pat>" python backend/scripts/mcp_client.py health
```

Expected output: JSON containing `protocolVersion: "2025-11-25"` and a `serverInfo` block with the MCP server name.

## Step 5 — Enumerate tools

```bash
MCP_PAT="<mcp_pat>" python backend/scripts/mcp_client.py list-tools
```

Expected output: exactly one tool named `saarthi_agent` with a description matching the one in `backend/sql/agent/saarthi_mcp.sql`. If you see anything else, the deployed spec has drifted from the source file.

## Step 6 — Ask a question

```bash
MCP_PAT="<mcp_pat>" python backend/scripts/mcp_client.py call "What is missing before Thursday?"
```

Expected behaviour:

- **Class B question** (record state): the agent returns a cited answer, or the documented `no_patient_bound` error if no patient is bound to the MCP session. Both are correct outcomes.
- **Class A question** (e.g. "Should she start chemo?"): the agent refuses under NMC TPG 2020 and offers an evidence packet addressed to the named treating practitioner. Every role gets the same refusal.

## Step 7 — Configure Claude Desktop / Cursor (optional)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "saarthi": {
      "url": "https://IFTDBGM-EA72552.snowflakecomputing.com/api/v2/databases/SAARTHI/schemas/OPERATIONAL/mcp-servers/SAARTHI_MCP",
      "headers": {
        "Authorization": "Bearer <PASTE_PAT_HERE>",
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN"
      }
    }
  }
}
```

Restart the client. The MCP server should appear as `saarthi`, exposing one tool (`saarthi_agent`). Ask it a clinical-record question in natural language.

---

## Rotation and revocation

- PATs expire in 30 days. Rotate before expiry:
  ```sql
  ALTER USER DAKSHA ROTATE PROGRAMMATIC ACCESS TOKEN SAARTHI_MCP_PAT;
  ```
- If a device holding the PAT is lost:
  ```sql
  ALTER USER DAKSHA REMOVE PROGRAMMATIC ACCESS TOKEN SAARTHI_MCP_PAT;
  ```
  Any client using the old token will start returning `401 unauthorized` immediately.

## Security invariants (do not violate)

1. **The PAT's role restriction stays `SAARTHI_MCP_CLIENT`.** Never widen it. If a caller needs more access, add specific grants to `SAARTHI_MCP_CLIENT` — do not swap the token to a broader role.
2. **The hostname uses hyphens** (`IFTDBGM-EA72552.snowflakecomputing.com`). Underscored hostnames are known-broken for MCP.
3. **The MCP server exposes only `saarthi_agent`.** If a future change adds `SYSTEM_EXECUTE_SQL` or raw tool procedures, that is a policy break: MCP clients would bypass `classify_question` and `validate_answer`, undoing R5 layer 2.
4. **RAP still fires on `CURRENT_USER()`.** MCP does not change the user — it just gives them a different transport. All patient-scope enforcement in the agent's tool procedures continues to work.
