# SAARTHI dashboard development

Use Node.js 20 or newer. From this directory:

```sh
npm ci
cp .env.example .env.local
# Fill in your synthetic-development Snowflake identity and key path.
npm run dev
```

Open http://localhost:3000. The home page lists accessible patients and day-care
visits; patient pages contain readiness, chat, timeline and review history.
`/navigator/[id]` provides a separate family checklist and scheme view; `/judge`
contains SQL probes. Screen existence does not establish complete clinical workflows.

Each request connects using the locally configured key-pair identity with primary
`SAARTHI_APP` and secondary roles disabled. This is a single-operator development
setup using synthetic records, not separate authentication for multiple browser users.
The per-professional authentication work remains committed on COM-11/COM-22 branches.

Keep `.env.local` private. `.env.example` contains the required setting names.
Existing local settings are preserved during reconciliation. To use optional Ollama
inference, follow `../local-ai/README.md` and set `SAARTHI_LLM_PROVIDER=ollama`.
SQL classifies both providers before inference; the local provider uses bounded
procedures and validates its typed claims. The default `ASK_SAARTHI` entry point is
still a thin agent wrapper: the more extensive answer guard is deferred pending fixes.

## Verification

```sh
npm test
npm run typecheck
npm run build
../.venv/bin/python -m pytest -q ..
../.venv/bin/python ../backend/scripts/check_gate.py --all --strict
```

Production builds use Next.js's supported Webpack option because Turbopack's CSS
worker could not bind its internal port in the current environment. `npm run dev`
retains Next.js's default development bundler; use `npm run dev -- --webpack` if
the same worker restriction occurs. `npm start` serves an existing production build.

Optional browser smoke: install Python Playwright and its Chromium browser, serve
the production build on port 3100, then run `../.venv/bin/python tests/judge_smoke.py`.
`SAARTHI_TEST_URL` can override the server URL; `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
can select an existing Chromium binary. Responses are synthetic intercepted fixtures.

## Account prerequisites and remaining limits

Deploy the updated SQL manifest before relying on the new consent checks or binding
release procedure. Local source tests do not establish Snowflake compilation or grants.
The committed role grants do not grant direct table reads, while parts of this dashboard
still issue SELECT queries. A clean-account deployment therefore requires completion of
the preserved owner-procedure read integration; do not solve this with ACCOUNTADMIN.
The configured development account can authenticate as `SAARTHI_APP`; this is not proof
that all required objects are accessible or that a clean deployment is reproducible.

Judge count probes inspect their numeric results. The consent inventory is
informational; it does not prove binding refusal. Scheme checks use SQL coverage/state
proxies, not verified scheme authorisation. Navigator timing/checklist mapping and
persistent Class A evidence packets remain incomplete. Synthetic engineering tests
are not clinical validation.

See `../docs/WORKSPACE-RECONCILIATION-2026-09-30.md` and
`../docs/WORKSPACE-BASELINE-2026-09-30.md` for preservation decisions and verification.
