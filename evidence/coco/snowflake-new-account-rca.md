# Snowflake account connection RCA

**Date:** 2026-10-03  
**Target:** Snowflake locator `NY64016` (`KGTPGHJ-YJ28449`), GCP `me-central2`, user `DANUSH`  
**Primary app role:** `SAARTHI_APP`

## 4 Oct resolution — PAT network policy applied

The workstation reproduced Snowflake error `390432`, `Network policy is required`, with the configured SITAR PAT. In the signed-in JR18576 administrator session, Snowsight listed zero network policies; `SHOW PARAMETERS LIKE 'NETWORK_POLICY' IN USER SITAR` returned an empty value. Created `SAARTHI_SITAR_WORKSTATION_20261004` with `ALLOWED_IP_LIST = ('49.207.58.97/32')` and attached it to SITAR only. Snowsight reported successful creation and attachment. This policy restricts new SITAR logins to the observed workstation public IP; update the allowlist before using another network or after that IP changes.

After applying the policy, the Node Snowflake driver authenticated successfully. A live identity query returned locator `JR18576`, account `OS69400`, user `SITAR`, role `SAARTHI_APP`, warehouse `SAARTHI_AI_WH`, and no secondary roles (query ID `01c77fc2-0004-0cda-0001-fcae00112ae2`). `cortex exec -c PATIENT360 --no-mcp --private --max-turns 3` returned `OK`. Authentication and a Cortex Code response are verified; these checks do not establish availability of the application's extraction models or completeness of its database objects.

Additional verification failures retained: limiting Cortex Code to one turn returned `Max tool call iterations reached`; three turns completed. Explicit `USE SECONDARY ROLES NONE` through the PAT returned `003107`, `Current session is restricted. USE ROLE not allowed.` The subsequent read-only identity query confirmed that the role-restricted session already had no secondary roles.

## 3 Oct addendum — account changed to JR18576

The later screenshots and supplied environment values identify a second, different account: `OHCXVXM-OS69400`, locator `JR18576`, login `SITAR`, edition Business Critical. This supersedes the earlier target for the current setup. Local application, Streamlit, and Cortex Code profiles have now been switched to this account, role `SAARTHI_APP`, and warehouse `SAARTHI_AI_WH`. The prior `NY64016` profile was retained locally as `PATIENT360_NY64016`.

The supplied JWT key path, `/Users/mac/.snowflake/keys/sitar/rsa_key.p8`, is not present on this machine (whose local home is `/Users/danusharun`). I created a private local directory at `/Users/danusharun/.snowflake/keys/sitar` (mode `0700`) and repointed the web, Streamlit, and Cortex profiles to `/Users/danusharun/.snowflake/keys/sitar/rsa_key.p8`. **That key file is not present yet**, so authentication to JR18576 and existence/privileges for its warehouse and Saarthi objects remain unverified. The old account's private key was not substituted. Once the SITAR key is placed at the configured path, verify `CURRENT_ACCOUNT()`, `CURRENT_USER()`, `CURRENT_ROLE()`, `CURRENT_WAREHOUSE()`, and `CURRENT_DATABASE()` with secondary roles disabled, then check the scoped procedures and Cortex entitlement.

I also attempted the account's browser-based `externalbrowser` authentication with both the organization/account identifier and the locator/region hostname form. Both requests were rejected before any SQL ran with Snowflake error `390190 (08001)`: an error related to the SAML Identity Provider account parameter. Adding a separate `region` parameter to the organization/account identifier produced `290404` because it formed an invalid hostname. These failures do not establish that the account or SQL objects are missing; they leave the JWT key or a correctly configured IdP as the needed authentication route. Snowflake documents `externalbrowser` for accounts with a configured SAML 2.0 IdP ([Python Connector API](https://docs.snowflake.com/en/en/developer-guide/python-connector/python-connector-api)).

The user then supplied a Snowflake Programmatic Access Token (PAT). The first attempt incorrectly treated it as OAuth and received `390303 (08001): Invalid OAuth access token`; no SQL ran. A second attempt used Snowflake's PAT-as-password method. Snowflake returned `390432 (08001): Network policy is required`, which identifies the actual blocker shown in the user's Authentication screenshot. The PAT is stored outside the repository at `/Users/danusharun/.snowflake/keys/sitar/pat.txt` with mode `0600`, inside a mode `0700` directory. Web, Streamlit, and Cortex profiles now use that PAT file; the Next.js Snowflake client supports `PROGRAMMATIC_ACCESS_TOKEN` auth. No SQL ran. Snowflake documents that PAT use requires an active network policy by default; a temporary per-token exception can be set for up to 1,440 minutes, though its guidance recommends a network policy instead ([PAT documentation](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens), [token modification syntax](https://docs.snowflake.com/en/sql-reference/sql/alter-user-modify-programmatic-access-token)).

The earlier `AI_COMPLETE` trial restriction was observed on the prior `NY64016` account only. It must not be carried forward as a finding about the new Business Critical `JR18576` account. Cortex model availability and end-to-end AI inference on JR18576 remain untested until authentication succeeds.

The web connection code now honors `SNOWFLAKE_ROLE`, fails closed if `SAARTHI_SNOWFLAKE_ENABLED=false`, and rejects account IDs that do not match `SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT`. Those settings are present in the local web environment. No database or schema was selected in the screenshot's config tab; the current web routes use fully qualified object names, so neither was added as a default.

## Summary

The patient-360 Next.js dashboard is connected to the intended Snowflake account using key-pair authentication. Cortex Code and the Streamlit entry point had stale connection selection: Cortex Code selected `HACKATHON`, and Streamlit selected the `HACKATHON` connection name. Both now select the new `PATIENT360` profile. The Streamlit credentials independently authenticated to locator `NY64016` with `SAARTHI_APP` and secondary roles disabled.

Two separate issues were mistaken for one:

1. **Wrong account selection** was a local client configuration issue. It is corrected for Cortex Code, the Next.js dashboard, and Streamlit.
2. **AI inference unavailable** is a Snowflake trial entitlement restriction. `AI_COMPLETE` returned `AI function _COMPLETE_WITH_PROMPT_HISTORY_LLM is not available for trial accounts.` This is not caused by old model settings or by the account locator. The app's AI path cannot return live Snowflake model output until Snowflake enables Cortex AI for this trial.

There is also a distinct **Streamlit authorization mismatch**: some legacy Streamlit methods directly select from patient and governance tables. The new `SAARTHI_APP` role is deliberately not granted those table reads; patient data must go through scoped owner-rights procedures. Thus Streamlit can authenticate to the new account, but those code paths still fail. The Next.js patient dashboard's governed procedure paths were verified live.

## Cause chain and evidence

| Layer | Cause | Evidence / status |
|---|---|---|
| Cortex Code | Local default was the old `HACKATHON` profile, pointing to a different account. | Local profile changed to `PATIENT360`; both Cortex Code SQL and agent connection settings now reference that profile. See `verification-query-ids.md`. |
| Next.js dashboard | `.env.local` supplies the Snowflake account and key path; the model provider had been set to Ollama. | `.env.local` selects `KGTPGHJ-YJ28449`, `DANUSH`, the existing Snowflake key file, and `SAARTHI_LLM_PROVIDER=snowflake`. The live REST patient route returned a synthetic patient context under the new account. Secrets are kept outside git. |
| Streamlit connection | Source selected connection name `HACKATHON`; no matching Streamlit secret profile existed. | `frontend/streamlit_app.py` now selects `PATIENT360`; local `~/.streamlit/secrets.toml` defines that profile using the existing key file. A read-only identity query returned `NY64016`, `DANUSH`, `SAARTHI_APP`; `USE SECONDARY ROLES NONE` was applied. |
| Streamlit data access | `frontend/core/live.py` still runs direct reads against `PATIENT_BINDING`, `PATIENT`, `PRACTITIONER`, `CARE_TEAM`, `CONSENT`, and other governed tables. | First app request failed with `Object 'SAARTHI.GOVERNANCE.PATIENT_BINDING' does not exist or not authorized`; primary role was `SAARTHI_APP`. This is expected under the least-privilege grants in `backend/sql/governance/03_grants.sql`, not proof of wrong credentials. Replace these reads with scoped owner-rights procedures before treating Streamlit as live-ready. Do not grant broad table access to silence the error. |
| Cortex AI | The Snowflake account is a self-service trial and AI functions are disabled for trial accounts until Snowflake's required entitlement step is completed. | `AI_COMPLETE` returned the explicit trial-account restriction under the application role. The user declined the earlier billing/card step; no billing change was made. The $400-to-$378 credit display reflects account consumption, but does not demonstrate that Cortex AI is enabled. |

## Account linkage now in place

- **Cortex Code:** local `PATIENT360` connection profile points at `KGTPGHJ-YJ28449`, key-pair auth, role `SAARTHI_APP`, warehouse `SAARTHI_AI_WH`, and secondary roles `NONE`. Cortex SQL and agent connection names both point to `PATIENT360`.
- **Next.js:** `.env.local` already points to the target Snowflake account and now selects Snowflake as the model provider.
- **Streamlit:** source selects `PATIENT360`; local secrets define the same account, user, key file, role, and warehouse. The private key itself is not copied into config or the repository.
- The existing account locator is `NY64016`; the screenshot's account URL and the query result agree.

## Remaining actions

1. Convert Streamlit's remaining direct patient/governance reads to the existing `GET_WEB_*` scoped procedures (or add narrowly scoped owner-rights procedures where no matching one exists), then verify each view using only `SAARTHI_APP` with secondary roles disabled.
2. Enable Snowflake Cortex AI for this trial account through Snowflake's required account entitlement flow. Then rerun the repository model availability probe and test the pinned models; do not assume that AI becomes available merely because credits are being consumed.
3. Keep using synthetic patient records only. Current live route checks returned synthetic account data.

## Evidence pointers

- Query history, deployment outcomes, and failures: [`verification-query-ids.md`](verification-query-ids.md).
- Connection selector: [`frontend/streamlit_app.py`](../../frontend/streamlit_app.py).
- Legacy direct reads needing procedure migration: [`frontend/core/live.py`](../../frontend/core/live.py).
- Role grants: [`backend/sql/governance/03_grants.sql`](../../backend/sql/governance/03_grants.sql).
- Governed web procedures: [`backend/sql/procedures/web_accessible_patients.sql`](../../backend/sql/procedures/web_accessible_patients.sql), [`web_census.sql`](../../backend/sql/procedures/web_census.sql), [`web_patient_context.sql`](../../backend/sql/procedures/web_patient_context.sql).
