## Local setup

Requires Node.js and npm. Install dependencies and configure the Snowflake account identifier:

```bash
cd web
npm ci
export SNOWFLAKE_ACCOUNT=<your Snowflake organization-account identifier>
npm run dev
```

The dashboard uses HTTP Basic authentication to prompt each practitioner for their own Snowflake username and password. Credentials are used by the server to open a per-request Snowflake session and are not stored by the application. Snowflake authenticates the practitioner and authorizes the required procedures. Use the `SAARTHI_APP` role with secondary roles disabled. Do not use an administrator role or configure shared practitioner credentials. Serve the application over HTTPS.

The runtime account is supplied through `SNOWFLAKE_ACCOUNT`; no account, user, or password is committed to source. For local development, use synthetic data only and keep credentials out of shell history and logs.

## Verification

```bash
npm run test:ui
node --experimental-strip-types --test tests/session-security.test.mjs tests/snowflake-config.test.mjs
python3 -m pytest -q ../frontend/tests/test_web_session_security.py
npx tsc --noEmit --incremental false
npm run build
```

The automated isolation checks use synthetic credentials and data. They do not prove live Snowflake grants, SQL compilation, role/session traces, or clinical validation. Before deployment, verify the `SAARTHI_APP` grants and denied responses in the target Snowflake account. Live account query evidence is not included in this repository.

## Remaining release limitations

Patient-specific chat history is held only in the mounted patient view's React state. It is discarded when the patient page unmounts, including navigation to another patient or a reload. A manual browser review of the 640px layout and keyboard flow remains; headless Chrome aborted in the current verification runner. Synthetic engineering checks are not clinical validation.
