# NMC Telemedicine & AI Practice Rules — What Bounds Our System

**Researched 2026-09-16. Determines the legal boundary between "clinical decision support" and "practising medicine."**

> **Headline finding: The NMC Telemedicine Practice Guidelines 2020 do not mention AI or clinical decision support at all.** They regulate telemedicine consultations between an RMP and a patient. The prohibition on AI "counselling patients or prescribing" comes from reading the guidelines' RMP-accountability framework and the general principle that only an RMP can practise medicine under the IMC Act / NMC Act. Our system is safe if it never addresses the patient as a clinical authority and never produces a recommendation the patient could act on without an RMP in the loop. The Class A/B split in plan.md is the correct enforcement mechanism.

---

## 1. NMC Telemedicine Practice Guidelines 2020

### What they actually regulate
- **Telemedicine consultations**: a Registered Medical Practitioner (RMP) providing healthcare services to a patient via technology (video, audio, text).
- **Scope**: applies when an RMP-patient relationship exists over a communication channel.
- **Core principle**: the RMP retains full responsibility. Technology is a medium, not a decision-maker.

### What they say about AI/technology
The guidelines contain **no section on AI, ML, clinical decision support, or automated systems.** The word "artificial" does not appear. The word "algorithm" does not appear. "Software" appears only in the context of telemedicine platforms as communication tools.

The relevant principle is implicit rather than explicit: **only an RMP may diagnose, prescribe, or advise treatment.** Anything that performs these functions without an RMP is practising medicine without registration — which is a criminal offence under the NMC Act.

### What this means for SAARTHI
- A system that **shows record state** (what reports exist, what's missing, what contradicts what) is not practising medicine — it is an information retrieval and reconciliation tool.
- A system that **answers "should the patient take the treatment?"** is practising medicine — even if the answer is qualified. This is Class A in our taxonomy and must be refused.
- A system that **answers "is the authorization approved?"** or **"when was the last echo?"** is answering a factual record-state question. This is Class B.
- The line is not about confidence or qualification — it is about whether the output could be acted upon as a clinical instruction without an RMP reviewing it.

---

## 2. The RMP accountability framework

Under Indian medical law (NMC Act 2019, formerly IMC Act 1956):
- Only a person registered with the State Medical Council / NMC can practise medicine.
- The RMP is **solely accountable** for all clinical decisions, including those informed by technology.
- If an AI system produces a recommendation and a patient acts on it without RMP involvement, the system operator may face prosecution for practising medicine without registration.
- If an RMP relies on an AI system's output and it causes harm, the **RMP remains liable** — but the system operator may face separate liability under product liability (CPA 2019) or negligence.

### The Telemedicine Guidelines' specific constraints
- Prescriptions must include the RMP's registration number and signature.
- First consultations for certain conditions require in-person visits.
- No prescription of controlled substances via telemedicine.
- **Patient data confidentiality**: the RMP and platform are jointly responsible.

---

## 3. NMC updates since 2020

### NMC (Registered Medical Practitioner – Professional Conduct) Regulations 2024
- Replaced the IMC (Professional Conduct, Etiquette and Ethics) Regulations 2002.
- **Still no specific AI/CDS provisions.** The regulations focus on RMP conduct, not technology.
- Relevant provision: Regulation 2(1)(f) — an RMP must maintain professional standards and not delegate clinical judgment to non-qualified persons (or, by extension, systems).

### National Digital Health Blueprint (NDHB)
- Not legally binding but sets policy direction.
- Envisions AI/ML in healthcare but defers regulatory specifics to CDSCO (for devices) and NMC (for practice standards).
- No specific CDS guidance has been issued under NDHB.

### ICMR Ethical Guidelines for AI in Biomedical Research and Health (2023)
- Advisory, not statutory.
- Key principles: transparency, accountability, non-maleficence, human oversight.
- Recommends that AI in clinical settings should be "assistive, not autonomous."
- Recommends disclosure to patients when AI is used in their care.
- **Not enforceable** — but a judge or regulator would look at these as the standard of care.

---

## 4. The legal boundary: CDS vs practising medicine

There is **no Indian statute or regulation that defines "clinical decision support"** as a category. The boundary is derived from first principles:

| System behaviour | Legal classification | Why |
|---|---|---|
| Displays lab values with reference ranges | Information tool | No clinical interpretation |
| Flags that a lab value is below a threshold | Borderline — depends on framing | If framed as "the protocol requires X" it's record-state; if framed as "the patient needs X" it's clinical |
| Says "ANC is 1200, protocol requires ≥1500" | Record-state (Class B) | States a fact about the record and a fact about the protocol; the RMP decides |
| Says "the patient should not receive chemo" | Clinical judgment (Class A) | Directly advises on treatment — only an RMP may do this |
| Says "treatment readiness cannot be determined from these records; the treating team decides" | Safe (our design) | Explicitly defers to the RMP |

### The critical design rule
**Every output must be phrased as a statement about the record, never as a statement about the patient's care.** "The record shows X" is safe. "The patient needs X" is not. "The treating team decides" must appear on every readiness output.

---

## 5. Enforcement actions

No NMC enforcement actions have been reported against AI/CDS systems specifically. The relevant precedents are:
- **Practo, mFine, and other telemedicine platforms** faced scrutiny during COVID for prescribing without adequate RMP involvement — but these were telemedicine services, not CDS.
- **No Indian court has ruled on CDS liability** in a reported decision as of mid-2026.
- The risk is **untested law** — which means the first case will set precedent. We should not be that case.

---

## 6. Design implications

1. **Class A/B split is the correct mechanism and is legally grounded.** Not just a design choice — it is the enforcement of the RMP-accountability principle.

2. **Every screen must carry "the treating team decides."** Not a footer — a first-class UI element on every readiness output. This is the legal shield.

3. **The family role must never produce anything that could be read as clinical advice.** A bring-list ("bring these documents") is safe. "You need this test" is not. The family surface must be purely documentary.

4. **Framing matters as much as functionality.** The deck, README, and marketing must say "evidence copilot" or "record-state system" — never "clinical AI" or "diagnostic assistant." CDSCO classification (see law-cdsco-device.md) hinges on intended use, which is established partly through marketing.

5. **ICMR 2023 guidelines recommend patient disclosure.** If the system is used in a real clinical setting, patients should be told AI is involved. For the hackathon this is a slide in the deck, not a feature.

---

## Sources

NMC Telemedicine Practice Guidelines 2020 (Board of Governors in supersession of MCI) · NMC Act 2019 · NMC RMP Professional Conduct Regulations 2024 · ICMR Ethical Guidelines for AI in Biomedical Research and Health 2023 · National Digital Health Blueprint (MoHFW) · CPA 2019 s.2(7) product liability.
