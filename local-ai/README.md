# Local LLM for SAARTHI development

This keeps the application's Snowflake connection and existing procedure-backed copilot
tools. Only the language-model API changes to Ollama on this Mac. Snowflake classifies the
question, binds and scopes the patient, retrieves facts, computes readiness, searches the
separate document corpora, and performs any permitted review-task write. The model chooses
among those tools and phrases their results. A classification error fails closed. Every
tool omits `patient_id`; review-task scope is derived from the server-bound patient and a
rule returned by SQL.

## Start local inference

1. Install the free Ollama app for macOS from [ollama.com/download](https://ollama.com/download).
2. Run `./local-ai/setup.sh` from the repository root. It downloads Qwen2.5 3B (about 1.9 GB)
   and creates a local profile capped at an 8,192-token context for lower memory use.
3. The workspace has `web/.env.local` set to local mode. If you cloned this repository,
   copy the three settings in `.env.example` into `web/.env.local`; keep existing Snowflake
   settings there and add or replace only these three local-model values.
4. Start Ollama if the app is not already running, then start the web app with
   `cd web && npm run dev`.
5. Open the patient page and ask a record-state question such as “What is missing?”.
   “List failed readiness checks” is another clear Class B example. Qwen2.5 is configured
   with constrained JSON for tool planning and answer text. The model selects among the
   bounded Snowflake procedures; SQL results remain the source of all patient facts and states.

To return to Snowflake's official model path, remove `SAARTHI_LLM_PROVIDER` or set it to
`snowflake`. The `OLLAMA_*` settings can remain in the file.

## Verify

Run `cd web && npm run test:local-ai`. The tests cover Class A refusal, bounded Snowflake
tool calls, and exclusion of a model-supplied patient selector.

Local mode exposes the same eight procedure-backed tools as the Snowflake copilot. The
cohort procedure still refuses while a patient is bound, by design. Document search depends
on the existing Snowflake Cortex Search services; local mode reports the Snowflake error if
those services are unavailable rather than fabricating document results. Use synthetic
patient data for development.
