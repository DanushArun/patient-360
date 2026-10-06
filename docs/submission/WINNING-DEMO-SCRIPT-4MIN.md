# Saarthi — The Championship Demo Video Script
### *Apple Keynote Gravitas × OpenAI Desktop Launch Fluidity*

**Event:** Snowflake CoCo CLI Hackathon 2026  
**Problem Statement:** PS-04 — Patient & Member 360 & Clinical Document Copilot  
**Team:** Team Hallucination (`@Daksha`, `Danush`, team)  
**Total Target Runtime:** Exactly 3:58 – 4:00 (240 seconds strict)  
**Spoken Pacing:** 135–140 WPM (~520 spoken words) — engineered with deliberate pauses, dramatic silence, and breathing room for UI transitions.  
**Hero Patient:** Anjali Deshpande (`PAT-DC-12`), 46, Pune · HER2+ Breast Cancer · Cycle 7 Chemo

---

## Part 1: Strategic Script Review & Keynote Re-Engineering

### Why the Original Draft Fell Short of Apple & OpenAI Caliber
1. **The Delivery was a Compliance Audit, Not a Product Reveal:** The previous draft read like an engineer dictating an internal test log (*"Using the risk-stratification skill, run Saarthi's readiness rules..."*). Apple keynotes and OpenAI launches never read instruction manuals; they frame high-stakes human problems and showcase effortless, breathtaking solutions.
2. **The Terminal Felt Like Clunky Bash, Not an Agentic Engine:** In OpenAI's desktop launch (with Mark Chen and Barret Zoph), developer tools feel like an omniscient superpower. We must frame CoCo CLI not as "typing commands into bash", but as the **headless Snowflake engine** coordinating multi-hospital clinical reasoning in seconds.
3. **The Missed Emotional Gravity:** In Indian oncology, 85% of patients travel hundreds of kilometers; 82% suffer delays because records are trapped across disconnected facilities. Opening with team names wasted the precious first 15 seconds. An Apple keynote opens with **visceral human tension**.
4. **The "Refusal" Wasn't Given Room to Breathe:** The Trastuzumab refusal is the crowning achievement of the project—an AI that knows its legal and ethical boundary under the NMC Telemedicine Practice Guidelines. In the original draft, it was rushed. In this script, the music **drops to complete silence**, making judges freeze and listen.

### The 4 Pillars of the Championship Cut
* **The Golden Axiom:** Repeated like a Steve Jobs mantra: *"SQL decides. AI reads. The doctor decides."*
* **Rubric Checkpoints Built In:** Discreet, high-end Apple-style corner tags (`[01 / INPUT]`, `[02 / PROCESSING · 3 SKILLS]`, `[03 / OUTPUT BRIEF]`, `[04 / CARE WORKSPACE]`) allow judges to award maximum points without friction.
* **1:1 Parity Proof:** The exact rule IDs evaluated in the terminal (`SURV-LVEF-002 v1` and `COV-AUTH-001 v1`) reappear seamlessly inside the Vercel web app.
* **The "One More Thing" Climax:** The Marathi family checklist connects high-tech Snowflake cloud data directly to the dignity of an Indian mother and son.

---

## Part 2: Master Production Timeline (4:00 Breakdown)

```
0:00 ──────────────── 0:25  ACT I: The 9:30 AM Tragedy & The Axiom (Apple Hook)
0:25 ──────────────── 2:00  ACT II: The Engine in Motion (CoCo CLI on Snowflake)
  ├─ 0:25–0:45  Input: Cross-hospital patient ingestion
  ├─ 0:45–1:10  Skill 1: Risk Stratification (SURV-LVEF-002 v1 cardiac block)
  ├─ 1:10–1:30  Skill 2: Evidence Reconciliation (COV-AUTH-001 v1 payer conflict)
  ├─ 1:30–1:50  Skill 3: Question Routing (Class A refusal vs Class B lookup)
  └─ 1:50–2:00  CLI Synthesis: Writing & displaying tomorrow's readiness brief
2:00 ──────────────── 3:30  ACT III: The Ambient Care Surface (Saarthi Workspace)
  ├─ 2:00–2:25  Ambient Voice Copilot & Human Confirmation
  ├─ 2:25–2:55  Verifiable Audit Trail & Multi-Model Extraction Parity
  └─ 2:55–3:30  THE CLIMAX: The Trastuzumab Refusal & Physician Evidence Packet
3:30 ──────────────── 3:45  ACT IV: One More Thing (Marathi Family Care Checklist)
3:45 ──────────────── 4:00  The Close & Mic Drop (The 3 Pillars)
```

---

## Part 3: Beat-by-Beat Master Shooting Script

---

### ACT I: THE 9:30 AM TRAGEDY (0:00 – 0:25)

#### Beat 1: The Human Tension (0:00 – 0:14)
* **Screen:** Minimalist title card fades in for 2 seconds:
  > **Saarthi**  
  > *Problem Statement 04: Patient 360 & Clinical Copilot · Team Hallucination*
* **Visual:** Cut smoothly to the Day Care Board at `saarthi-360.vercel.app`. Slow, cinematic camera glide toward the red *"Needs review"* column.
* **On-Screen Tag (Top-Left):** `PS-04 · PATIENT 360`
* **On-Screen Tag (Bottom-Right):** `SYNTHETIC CLINICAL DATA ONLY`
* **Audio:** Minimalist, cinematic ambient synth pulse (subtle, warm, serious).
* **Voiceover (Grounded, authoritative, conversational):**
  > *"Every evening across India, cancer day-care centers face the exact same crisis. Families travel hundreds of kilometers overnight on crowded buses for chemotherapy—only to be turned away at 9:30 AM because an echo report is trapped in another hospital, or an insurance approval contradicts the billing system."*

#### Beat 2: The Core Axiom (0:14 – 0:25)
* **Screen:** Camera locks smoothly onto patient card **Anjali Deshpande (PAT-DC-12)** with a prominent red `Blocked` tag.
* **On-Screen Kinetic Graphic (Center):**  
  **SQL DECIDES · AI READS · DOCTOR DECIDES**
* **Voiceover:**
  > *"We built Saarthi to catch those gaps the evening before. Not by letting an AI play doctor, but on one uncompromising foundation: **SQL decides. AI reads. The doctor decides.** Let’s watch it work."*

---

### ACT II: THE ENGINE — CoCo CLI ON SNOWFLAKE (0:25 – 2:00)

#### Beat 3: Input Ingestion (0:25 – 0:45)
* **Screen:** Clean cut to full-screen macOS Terminal. High-contrast dark glass theme, large modern font (Menlo / SF Mono 18pt). Active Snowflake CoCo CLI session.
* **On-Screen Tag (Top-Left):** `COCO CLI · STEP 1 OF 3: INPUT INGESTION`
* **Action:** Prompt types cleanly into CoCo:
  ```bash
  Show me patient PAT-DC-12's LVEF results from SAARTHI.CORE.CLINICAL_EVENT and her pre-authorisation status from SAARTHI.CORE.AUTHORIZATION. Keep it short.
  ```
* **Visual:** CoCo returns 2 LVEF values (63% and 49%) and auth status `PENDING`.
* **Voiceover:**
  > *"We start inside CoCo CLI, connected directly to our Snowflake warehouse. The input is Anjali's multi-hospital record. Two heart scans: sixty-three percent in June, forty-nine percent today. And one insurance pre-authorisation, marked pending."*

#### Beat 4: Skill 1 — Risk Stratification (0:45 – 1:10)
* **Screen:** CoCo terminal.
* **On-Screen Tag (Top-Left):** `PROCESSING · SKILL 1 OF 3: RISK-STRATIFICATION`
* **Action:** Prompt enters:
  ```bash
  Using the risk-stratification skill, run Saarthi's readiness rules for PAT-DC-12 and show each check with its outcome, rule ID and version.
  ```
* **Visual:** Terminal streams the evaluation matrix. Smooth camera zoom punches into row:  
  `SURV-LVEF-002 | v1 | FAIL | LVEF 49% (<50% with drop >=10%)`
* **Voiceover:**
  > *"Skill one: Risk Stratification. CoCo executes our versioned SQL rules across her clinical timeline. Notice: no language model makes this calculation. Rule `SURV-LVEF-002`, version one. Her ejection fraction fell fourteen points down to forty-nine percent. That crosses the FDA trastuzumab hold threshold. A deterministic fail."*

#### Beat 5: Skill 2 — Evidence Reconciliation (1:10 – 1:30)
* **Screen:** CoCo terminal.
* **On-Screen Tag (Top-Left):** `PROCESSING · SKILL 2 OF 3: EVIDENCE-RECONCILIATION`
* **Action:** Prompt enters:
  ```bash
  Using the evidence-reconciliation skill, compare PAT-DC-12's pre-authorisation in SAARTHI.CORE.AUTHORIZATION with the approval letter. Do they agree?
  ```
* **Visual:** Terminal highlights the two contradictory sources: Table says `PENDING`, Insurer Letter OCR says `APPROVED`.
* **Voiceover:**
  > *"Skill two: Evidence Reconciliation. The insurer's portal table says pending. But the insurer’s own uploaded letter says approved. Saarthi never hallucinates an answer. It flags rule `COV-AUTH-001` as a conflict, leaves the record uncorrupted, and demands human review."*

#### Beat 6: Skill 3 — Clinical Question Routing (1:30 – 1:50)
* **Screen:** CoCo terminal.
* **On-Screen Tag (Top-Left):** `PROCESSING · SKILL 3 OF 3: QUESTION ROUTING`
* **Action:** Prompt enters:
  ```bash
  Using the clinical-question-routing skill, classify these with SAARTHI.OPERATIONAL.CLASSIFY_QUESTION: "What documents are missing?" and "Should we hold her trastuzumab?"
  ```
* **Visual:** Zero-latency output:  
  `[Q1] CLASS B (Record State) -> Answer with citations`  
  `[Q2] CLASS A (Clinical Judgment) -> REFUSE & ROUTE TO PHYSICIAN`
* **Voiceover:**
  > *"Skill three: Question Routing. 'What documents are missing?' asks for record state—Class B. Answered instantly with citations. But 'Should we hold her trastuzumab?' is medical judgment—Class A. By law, it is refused at zero latency and routed to her treating oncologist."*

#### Beat 7: CLI Output — Tomorrow's Readiness Brief (1:50 – 2:00)
* **Screen:** CoCo terminal.
* **On-Screen Tag (Top-Left):** `OUTPUT · END-TO-END CLI WORKFLOW COMPLETE`
* **Action:** Prompt enters:
  ```bash
  Using all three skills, write tomorrow's readiness brief for PAT-DC-12 to evidence/demo/brief-PAT-DC-12.md. Show the file.
  ```
* **Visual:** Terminal renders the completed markdown brief with blockers, rule IDs, and audit citations.
* **Audio:** Music track swells gently into a warm, rhythmic groove.
* **Voiceover:**
  > *"One prompt chains all three skills to write tomorrow’s clinical readiness brief directly to disk. Input, processing, and output—complete in CoCo CLI. Now, let’s see the care coordinator’s desk."*

---

### ACT III: THE AMBIENT CARE SURFACE (2:00 – 3:30)

#### Beat 8: Natural Voice & Human Confirmation (2:00 – 2:25)
* **Screen:** Seamless transition to the live web application at `saarthi-360.vercel.app`. Full view of the Day Care Board.
* **On-Screen Tag (Top-Left):** `CARE WORKSPACE · VOICE COPILOT`
* **Action:** Presenter clicks the blue microphone icon in the floating *Ask Saarthi* bar.
* **Live Voice (Spoken by presenter naturally):** *"Who is blocked today?"*
* **Visual:** 6 cards on the board illuminate instantly with subtle gold/red borders. Chat drawer opens on the right.
* **Live Voice (Spoken by presenter):** *"Open Anjali's record."*
* **Visual:** Ambient prompt appears: *“Open Anjali Deshpande’s record?”* Presenter clicks **Open record**.
* **Voiceover:**
  > *"On the care floor, the coordinator doesn't need to write queries. She speaks. Six blocked patients light up on the board. When she asks to open Anjali’s chart, Saarthi pauses for human confirmation. It never touches a patient record autonomously."*

#### Beat 9: Unbroken Parity & Source Auditing (2:25 – 2:55)
* **Screen:** Anjali's Patient 360 chart opens. Camera punches in on the *Needs Attention* table:  
  `SURV-LVEF-002 v1` and `COV-AUTH-001 v1`.
* **Action:** Presenter clicks the echo citation link. Scanned PDF modal slides open, automatically focused on:  
  **LVEF (biplane Simpson): 49 %**. Presenter switches to *Coverage* tab showing side-by-side reconciliation.
* **On-Screen Tag (Top-Left):** `MULTI-MODEL VERIFICATION · AUDITABLE CITATION`
* **Voiceover:**
  > *"Notice the parity. The exact same rule IDs from CoCo CLI are right here on her chart. And when we click the cardiac citation, it opens the outside hospital’s echo scan. Two independent model families—Llama and Claude—had to agree on that forty-nine percent before it was ever admitted to the database."*

#### Beat 10: The Refusal that Wins the Room (2:55 – 3:30)
* **Screen:** Presenter clicks *Ask the record*. Types or speaks:  
  `Should we hold her trastuzumab?`
* **Audio:** 🔇 **ALL BACKGROUND MUSIC CUTS IMMEDIATELY. COMPLETE, DEAD SILENCE.**
* **Visual:** The system returns a bold, unmistakable refusal card:  
  `CLASS A · CLINICAL JUDGMENT REFUSED · NMC TELEMEDICINE PRACTICE GUIDELINES 2020`  
  Prominent action button appears: `[Prepare evidence packet for Dr. Oncologist]`.
* **Action:** Presenter clicks the button. In less than a second, a pristine, structured clinical evidence packet opens, citing all labs, echo drops, and insurance conflicts.
* **On-Screen Tag (Top-Left):** `CLINICAL SAFETY · CLASS A REFUSAL`
* **Voiceover (Deliberate, calm, commanding):**
  > *"Now watch what happens when someone asks: 'Should we hold her trastuzumab?' (Brief pause). Most AI demos fabricate medical advice. Saarthi refuses. Under India’s Telemedicine Practice Guidelines, clinical decisions remain solely with the doctor. Saarthi compiles the cited evidence packet instead—keeping the oncologist entirely in control."*

---

### ACT IV: ONE MORE THING & THE MIC DROP (3:30 – 4:00)

#### Beat 11: One More Thing — Marathi Family Care (3:30 – 3:45)
* **Audio:** Warm, emotive acoustic piano chords swell softly back in.
* **Screen:** Presenter clicks the **Family** tab and selects **Marathi (मराठी)**.
* **Visual:** A beautifully formatted, compassionate patient preparation card renders in Marathi script, informing the family that cardiac review is underway and advising them to pause travel until confirmation.
* **On-Screen Tag (Top-Left):** `HEALTH EQUITY · MULTILINGUAL PATIENT PREPARATION`
* **Voiceover:**
  > *"And one more thing. Anjali’s family speaks Marathi. The night before, they receive this checklist in their own language—explaining what is ready, what is pending, and preventing an agonizing 300-kilometer journey for an infusion that cannot happen."*

#### Beat 12: The Close (3:45 – 4:00)
* **Screen:** Elegant split-screen: CoCo CLI terminal on the left; Saarthi Care App on the right. Smooth fade to the final title card:
  > **Saarthi**  
  > *SQL Decides · AI Reads · Doctor Decides*  
  > `github.com/.../patient-360` · `saarthi-360.vercel.app`  
  > Snowflake CoCo CLI Hackathon 2026 · Problem Statement 04
* **Voiceover (Resonant, confident, final):**
  > *"Three skills. One engine in CoCo CLI. Deterministic SQL rules. Zero hallucinations. The doctor stays in charge. This is Saarthi."*
* **Visual:** Fade to black at **3:59**.

---

## Part 4: Technical & Delivery Cheatsheet

### Spoken Pronunciation Guide
| Written Word | Script Spelling | TTS / Clipchamp Input |
|:---|:---|:---|
| **Saarthi** | Saarthi | `Saar-thee` |
| **CoCo CLI** | CoCo CLI | `Co-Co C-L-I` |
| **LVEF** | LVEF | `L-V-E-F` |
| **SURV-LVEF-002** | SURV-LVEF-002 | `surv L-V-E-F zero zero two` |
| **COV-AUTH-001** | COV-AUTH-001 | `cov auth zero zero one` |
| **Trastuzumab** | trastuzumab | `tras-TOO-zoo-mab` |
| **NMC** | NMC | `N-M-C` |
| **SQL** | SQL | `S-Q-L` |

### Sound & Editing Choreography
1. **Pacing:** Never rush the voiceover. The ~520 words comfortably take ~3 minutes and 40 seconds at 140 WPM, leaving 20 seconds of essential breathing room for terminal outputs and UI transitions.
2. **The Refusal Drop:** At **2:55**, the moment the cursor submits *"Should we hold her trastuzumab?"*, cut the music to 0% volume instantly. Let the refusal card land in absolute quiet for 2 seconds before the voiceover speaks. Bring the piano back at **3:30** for the Family tab.
3. **Speed Ups:** CoCo's SQL thinking time (2–4 seconds) should be cut or sped up 2x with a discreet `"2x sped up"` caption. Judges appreciate honest momentum.
4. **Preflight Checklist:**
   - Run `.venv/bin/python -m backend.scripts.prepare_demo` (must print `status: PASS`).
   - Run `npm run demo:check` against the production build (verified 19/19 passing).
   - Ensure Chrome zoom is 100% on 1440px wide screen with dark mode terminal paired beside it.
