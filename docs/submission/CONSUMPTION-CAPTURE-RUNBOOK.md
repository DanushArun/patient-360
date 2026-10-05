# Actual consumption evidence

Checked 5 October 2026 against Snowflake's current official view definitions:
[warehouse metering](https://docs.snowflake.com/en/sql-reference/account-usage/warehouse_metering_history),
[function usage](https://docs.snowflake.com/en/sql-reference/account-usage/cortex_functions_query_usage_history),
[agent usage](https://docs.snowflake.com/en/sql-reference/account-usage/cortex_agent_usage_history),
and [Search serving](https://docs.snowflake.com/en/sql-reference/account-usage/cortex_search_serving_usage_history).

Use a dedicated, exclusive benchmark period spanning complete UTC hours. Record the
completed review IDs, questions, operator and start/end timestamps. Wait eight hours
before collecting delayed ACCOUNT_USAGE evidence. That conservative wait is explicit;
the collector does not turn absent history rows into zero credits.

```bash
.venv/bin/python -m backend.scripts.capture_consumption \
  --start 2026-10-04T12:00:00+00:00 --end 2026-10-04T13:00:00+00:00 \
  --exclusive-benchmark-window
```

The dates above illustrate argument syntax; use the actual recorded benchmark window.
The command does not execute models, change resource monitors or alter billing. It reads
metering views as ACCOUNTADMIN and preserves raw usage rows and collection query IDs.
`consumption-live-usage.json` is the directly usable `--usage-json` input for
`simulate_workflow_economics`. Supply the actual account credit price, currency and
documented coordinator wage assumption through that script's required pricing arguments.

Warehouse consumption includes idle compute during the complete window. Search serving
consumption covers both declared services. Agent token credits and standalone function
token credits are captured separately. Agent metadata AI-function and SQL-query credits
are not added again. Retain raw request/query IDs to reconcile attribution on the final
account. A window shared with installation, unrelated queries or other operators cannot
be represented as review-only marginal cost.

The result is allocated window cost per completed review, not an exact invoice or a
causal per-query price. Storage, tax and account pricing discounts are outside this
collector's boundary and must be disclosed separately. Setup/extraction costs belong
in a separate measured window or an explicitly stated amortization assumption.

An absent native-agent row leaves total LLM consumption unmeasured, even if extraction
function credits exist. An empty warehouse/Search result also remains unmeasured.
Failures produce a FAIL report and exit nonzero. No current cost-per-review or labor
saving result has been measured by writing this runner.
