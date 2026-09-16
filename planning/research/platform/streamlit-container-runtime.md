# Streamlit-in-Snowflake Container Runtime — Limits & Capabilities

**Researched 2026-09-16. We're deploying on this. Need to know the boundaries before building.**

> **Headline finding: Container runtime is GA and the default for new Streamlit apps (BCR 2026_06). It runs on a compute pool, supports Cortex Agent calls, external network access (via EAI), and has no hard page-size limit. The main constraints are: no local filesystem persistence (use stages), no background threads, 250MB memory default (configurable), and the app runs as the owner role — meaning RBAC must be designed around the owner's permissions, not the viewer's. This last point is critical for R5.**

---

## 1. Container vs Warehouse runtime

| Capability | Warehouse runtime | Container runtime |
|---|---|---|
| Cortex Agent API | **Not supported** | ✅ Supported |
| External network (HTTP calls) | Not supported | ✅ Via External Access Integration |
| File upload (st.file_uploader) | Not supported | ✅ Supported |
| Custom packages (pip) | Limited (Anaconda channel) | ✅ Any pip package via requirements.txt |
| Compute | Shared warehouse | Dedicated compute pool node |
| Cost | Warehouse credits while active | Compute pool credits (always-on while app exists, auto-suspend after 3 days idle) |
| Memory | Limited | 250MB default, configurable |
| Local filesystem | Read-only /tmp | Read-only /tmp (no persistence) |
| Secrets | Via Snowflake secrets | Via Snowflake secrets |

### Why container runtime is required for SAARTHI
1. Cortex Agent API is only callable from container runtime Streamlit.
2. Even with the AGENT_RUN() SQL escape hatch, container runtime gives us flexibility.
3. External network access enables fetching from ABDM APIs (future) or sending notifications.

---

## 2. Key constraints for the build

### The owner-rights model
- **The Streamlit app runs as the OWNER role** of the Streamlit object.
- Viewers see the app through the owner's permissions, not their own.
- This means: if the owner role has SELECT on all patient tables, every viewer sees all patient data — **regardless of the viewer's own role**.
- **R5 implication**: row access policies on tables DO apply (the owner role is still subject to RAP). But the RAP must use a session variable or context function to identify the actual viewer, not just `CURRENT_ROLE()` (which returns the owner role).

### How to identify the viewer
- `CURRENT_USER()` — returns the Snowflake username of the person viewing the app.
- `SYSTEM$GET_CALLER_IP_ADDRESS()` — available but not useful for identity.
- **For RBAC**: create a mapping table `(username → role_type → permitted_patients)` and reference it in the RAP using `CURRENT_USER()`. This way the RAP knows WHO is viewing even though the app runs as the owner.
- **For the Cortex Agent**: pass the viewer's username as an immutable session attribute.

### No persistent local filesystem
- `/tmp` is available but ephemeral — wiped on app restart.
- For any file operations (uploaded documents, generated reports): write to a Snowflake internal stage.
- `st.file_uploader` → write to `@stage/uploads/` → process from there.

### Memory limits
- Default 250MB per container.
- For our use case (mostly SQL queries + Cortex API calls), this is sufficient.
- If loading large DataFrames: use `snowflake.snowpark` session queries with `collect()` sparingly.

### No background threads / async
- Streamlit reruns the entire script on each interaction.
- Long-running operations (AI_PARSE_DOCUMENT on a multi-page PDF) should be triggered as Snowflake tasks, not run inline.
- Use `st.spinner()` for operations that take seconds; use task-based async for operations that take minutes.

### Package management
- `requirements.txt` at the root of the Streamlit app directory.
- Any pip package available on PyPI can be used.
- Common useful packages: `pandas`, `plotly`, `streamlit-extras`, `pydantic`.

---

## 3. Deployment pattern

### From Git repository (recommended)
```sql
CREATE STREAMLIT saarthi_app
  ROOT_LOCATION = '@saarthi_repo/branches/main/app'
  MAIN_FILE = 'app.py'
  QUERY_WAREHOUSE = SAARTHI_WH
  COMPUTE_POOL = SYSTEM_COMPUTE_POOL_CPU
  TITLE = 'SAARTHI — Care Readiness Copilot';
```

### From stage (alternative)
```sql
PUT file:///path/to/app/* @saarthi_stage/app/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE;

CREATE STREAMLIT saarthi_app
  ROOT_LOCATION = '@saarthi_stage/app'
  MAIN_FILE = 'app.py'
  QUERY_WAREHOUSE = SAARTHI_WH
  COMPUTE_POOL = SYSTEM_COMPUTE_POOL_CPU;
```

### Multi-page app structure
```
app/
  app.py                  # Entry point, navigation
  pages/
    1_Review_Queue.py
    2_Patient_360.py
    3_Ask_Evidence.py
    4_Review_History.py
    5_Judge_Console.py
  utils/
    auth.py               # Viewer identification, role mapping
    snowflake.py          # Connection helpers
    evidence.py           # Citation formatting
  requirements.txt
```

---

## 4. Cortex Agent from Streamlit

### The call pattern
```python
import streamlit as st
from snowflake.snowpark.context import get_active_session

session = get_active_session()

# Option 1: AGENT_RUN() via SQL (works on both runtimes)
result = session.sql("""
    SELECT SNOWFLAKE.CORTEX.AGENT_RUN(
        'saarthi_agent',
        :question,
        { 'variables': { 'patient_id': :patient_id } }
    )
""", params=[question, patient_id]).collect()

# Option 2: Cortex Agent REST API (container runtime only)
# Use the snowflake.core SDK
```

### Immutable session attributes for R5
```python
# Set before any agent call — cannot be modified by the agent
session.sql("""
    ALTER SESSION SET 
        SAARTHI_VIEWER = CURRENT_USER(),
        SAARTHI_PATIENT_SCOPE = :patient_id
""", params=[patient_id])
```

The agent's tools then read `SYS_CONTEXT('SNOWFLAKE$SESSION_ATTRIBUTES', 'SAARTHI_PATIENT_SCOPE')` and the value cannot be overridden by generated SQL or tool calls.

---

## 5. Things that will break if we don't plan for them

| Trap | Consequence | Mitigation |
|---|---|---|
| Owner role has too many privileges | Every viewer sees all data | Narrow the owner role + use RAP with CURRENT_USER() |
| AI_PARSE_DOCUMENT called inline | App hangs for 30+ seconds per page | Run via task, poll for completion |
| Large DataFrame in memory | OOM crash | Use Snowpark lazy evaluation, collect() only what's displayed |
| File upload without stage write | File lost on rerun | Write to stage immediately on upload |
| Cortex Search called without scope filter | Cross-patient data leak | Server-side filter injection in the procedure, never from the app |

---

## Sources

docs.snowflake.com: Streamlit in Snowflake (container runtime), Compute Pools, External Access Integration, Cortex Agents API, BCR 2026_06.
