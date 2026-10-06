# Submission checklist, 6 Oct 2026

Prototype/MVP form on hack2skill. Team target **18:00 IST**; the form closes **23:59 IST**.

## Fix these first

- [ ] **Repository access.** `DanushArun/patient-360` is private, and the rules require full repository access for
      judges. Make it public or share it as the organisers instruct. Before making it public, confirm no credentials
      are committed (`.env*` files are git-ignored).
- [ ] **Demo check passes.** `evidence/demo/preflight-latest.json` says FAIL, 17 of 19 (pre-authorisation question
      took 71.7 s; the cited echo page did not open within 30 s). Re-run it as below and commit a PASS.
- [ ] **Open pull requests.** Merge or close #19 (deployment status docs) and #20 (task user resolved at deploy time).
- [ ] **Deck template.** Download the template from the form and check the deck follows it.

## Re-run the demo check

On the account the demo will be recorded on, with `web/.env.local` pointing at it and live access on:

```sh
git pull origin main
.venv/bin/python -m backend.scripts.prepare_demo          # or venv/bin/python; must print "status": "PASS"
cd web && npm run dev                                      # leave running
cd web && npm run demo:check                               # second terminal; every beat must PASS
git add evidence/demo evidence/qa/demo-prep-latest.json && git commit -m "Record passing demo check"
```

`prepare_demo` writes to the account (moves visits to tomorrow, loads the demo patient PAT-DC-12, runs the two-model
extraction) and spends credits. Suspend scheduled tasks again afterwards.

## The form

| Field | What to put | Ready |
|---|---|---|
| Challenges | Problem Statement 04: Patient and Member 360 / Clinical or Regulatory Document Copilot | [ ] |
| Prototype/MVP Brief | The paragraph below (1,016 of 1,024 characters) | [ ] |
| Demo video link | 3–5 min; workflow run via CoCo CLI, Input → Processing → Output, 2–3 skills; YouTube Unlisted or Drive with link access | [ ] |
| Prototype deck | Organisers' template; based on `SAARTHI-submission-2026-10-05.pptx` plus the slides below | [ ] |

> SAARTHI is a care-readiness and evidence copilot for cancer day-care centres in India. Before each chemo cycle it tells a coordinator which records, authorisations and checks are missing, pending or conflicting, with every claim cited to the exact table row or PDF page, so families do not travel hundreds of km for a visit that cannot proceed. Built natively on Snowflake using CoCo CLI from planning to testing: synthetic FHIR, labs, PM-JAY pre-auth and PDFs flow through AI_PARSE_DOCUMENT and two-model extraction (llama3.3-70b + claude-haiku-4-5) into 16 versioned SQL readiness rules. A Cortex Agent with 8 scoped tools, 2 Cortex Search services, a semantic view and 4 reusable skills answers record questions; clinical-judgment questions are refused and routed to the treating doctor. Row access on CURRENT_USER(), consent re-checked per call, no tool accepts a patient ID. SQL decides, AI extracts and phrases, the practitioner stays accountable. Next.js dashboard, 13 synthetic patients. Synthetic data only.

## Deck slides to add

- [ ] CoCo lifecycle and the 4 skills (`backend/skills/`, `evidence/coco/`)
- [ ] Demo flow: blocked overview, "Why is she blocked?", clinical question refused with evidence packet
- [ ] Impact: time-saved formula, scalability, uses beyond the demo (`docs/submission/ARCHITECTURE-AND-IMPACT.md`)
- [ ] What is not yet live, stated plainly
- [ ] Repository link and the `evidence/` map
- [ ] Re-check the "684 passed" figure on the engineering slide against a fresh test run

## Evidence judges will open

- [ ] `evidence/coco/`: lifecycle manifests, `sessions-raw.csv`, `verification-query-ids.md`, and
      `sessions-2026-10-06.md` (today's clean-account deploy). Add any other sessions run today with their IDs.
- [ ] `evidence/demo/`: 19 screenshots and the latest demo check result (should say PASS)
- [ ] `evidence/qa/`: QA, fix and deploy rounds
- [ ] `evidence/clinical/`: sourced thresholds

## Final check before pressing Submit

- [ ] Challenge selected: Problem Statement 04
- [ ] Brief pasted; counter shows 1,016 / 1,024
- [ ] Video is 3–5 minutes and shows the CoCo CLI terminal doing the work
- [ ] Video link opens in a private browser window without signing in
- [ ] Deck uses the template and includes the GitHub link
- [ ] Judges can open the repository
- [ ] Open pull requests merged or closed; latest demo check committed
- [ ] Every number in the deck and video matches a file in the repository
- [ ] Scheduled tasks suspended again after the demo, to protect trial credit
