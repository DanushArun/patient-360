# Why Per-Claim Citations Are Not Over-Engineering

## 30-Second Answer for Judges

AI-generated clinical summaries hallucinate in 3-18% of cases, including
inventing medications, flipping negations ("no history of X" becomes "history
of X"), and fabricating dosages. Published studies show clinicians exhibit
automation bias--accepting AI output without verification--at clinically
dangerous rates. The FDA's January 2026 CDS guidance requires that clinical
decision support display its basis so clinicians can independently review it.
The EU AI Act (effective August 2026) classifies clinical AI as high-risk,
mandating traceability and transparency. Per-claim citation is the minimum
mechanism that enables a clinician to verify each assertion against its source
before acting on it. Without it, a summary that "looks cited" provides false
confidence, which is worse than no citation at all.

---

## 1. Documented Clinical AI Hallucination Cases

**Stanceski et al. (2024), npj Digital Medicine 7:329 (PMID: 39567722)**
Tested GPT-3.5 on 100 MIMIC-IV discharge summaries to generate patient
discharge instructions. Found:
- **18% had potentially harmful safety issues** attributable to the AI tool
- **6% contained hallucinations** (fabricated information not in source)
- **3% invented new medications** the patient was never prescribed
- **42% introduced new follow-up actions** not in the original summary

One concrete example: AI generated "Carbamazepine 400mg: Take 2 tablets by
mouth twice daily" when the source said "one 400mg tablet twice daily"--a
**2x dosage error** on an anticonvulsant with a narrow therapeutic window.

**Asgari et al. (2025), npj Digital Medicine 8:274 (PMID: 40360677)**
Proposed a clinical safety framework for evaluating LLM hallucination in
medical text summarisation. Across 12,996 clinical documents tested in 18
experimental configurations, they found clinically significant error rates
that required a formal taxonomy of harm severity. The paper's core argument:
fidelity between LLM outputs and ground truth is vital to prevent
miscommunication that could compromise patient safety.

**Grolleau et al. (2026), JAMA Network Open 9(5):e2616556 (PMID: 42101844)**
First prospective study of AI-generated hospital course summaries used in
real clinical environments. Reported safety-relevant findings that
retrospective studies alone cannot capture. The study underscores that
hallucination rates measured in retrospective settings underestimate real-world
risk.

## 2. The Negation Error

The "negation error" is one of the most dangerous failure modes in clinical AI:
the system confuses "no history of X" with "history of X," or drops a negation
entirely.

**Why this matters for patient-360:**
- A patient record states: "Patient has **no history of** diabetes mellitus"
- AI summary renders: "Patient has **history of** diabetes mellitus"
- Downstream clinical decisions (medication selection, monitoring protocols)
  are now based on a fabricated diagnosis

This error class is particularly insidious because:
1. It is **semantically plausible**--the sentence reads naturally
2. It is **factually inverted**--the clinical meaning is opposite
3. It is **difficult to catch** without checking against the source
4. LLMs are known to struggle with negation scope in long contexts

NLP negation detection has been a known hard problem since NegEx (Chapman et
al., 2001). Modern LLMs have not solved it. Per-claim citation is the only
mechanism that lets a clinician click through to verify that "no history of
diabetes" was not silently flipped.

**Published evidence:**
- Jafarpour et al. (2025), Artif Intell Med 170:103281 (PMID: 41072367):
  Scoping review of NLP preprocessing for adverse event detection in EMRs.
  Negation handling remains a critical failure point.
- The Stanceski et al. study above found that "changed meaning through
  summarisation" was an explicit error category, directly encompassing
  negation errors.

## 3. Automation Bias and Clinician Over-Reliance

**Goddard, Roudsari & Wyatt (2011), Stud Health Technol Inform 164:3-7
(PMID: 21335679)**
Systematic review across multiple fields finding that clinical decision
support systems induce **automation bias**--clinicians follow system
recommendations even when they are wrong, and fail to notice when the system
omits critical information.

Two forms of automation bias in clinical AI:
1. **Commission errors**: Clinician follows incorrect AI recommendation
2. **Omission errors**: Clinician fails to notice AI omitted critical info

**Jenkins, Eisenberg & Ziegelstein (2026), J Gen Intern Med (PMID: 42671738)**
Proposed the "Ask-Audit-Apply" framework specifically to counteract automation
bias in AI-enabled CDS tools. The paper's premise: without explicit audit
mechanisms, AI-generated clinical information is accepted uncritically.

**Bharija et al. (2026), J Am Geriatr Soc (PMID: 42478489)**
American Geriatrics Society position statement on generative AI in clinical
settings. Explicitly warns about over-reliance on LLM outputs in
documentation, decision support, and patient education.

**Relevance to citation:** Per-claim citation directly counteracts automation
bias by forcing the system to show its work. A clinician who sees "[source:
Lab Results 2024-03-15]" next to a claim can verify it. A clinician who sees
a confident-sounding paragraph with no attribution has no friction point to
trigger verification.

## 4. FDA Guidance on CDS Transparency

**FDA Final Guidance: "Clinical Decision Support Software" (January 2026)**
Docket: FDA-2017-D-6569

The FDA's CDS guidance clarifies the boundary between regulated device
software and Non-Device CDS under 21st Century Cures Act Section 3060(a).

Key requirement for Non-Device CDS exemption (Section 520(o)(1)(E) of FD&C
Act): The software must **"enable the health care professional to independently
review the basis for such recommendations."**

This is colloquially known as the "show your work" criterion. For a clinical
AI summary to qualify as Non-Device CDS (and thus avoid full FDA device
regulation), it **must** display the basis for its assertions so the clinician
can independently verify them.

**Per-claim citation is a direct implementation of this requirement.** A
summary that shows a conclusion without linking to source data does not enable
independent review. A summary with per-claim citations does.

If our system does NOT provide per-claim citations, it risks being classified
as a **regulated medical device** rather than exempt CDS software, with all
the regulatory burden that entails.

## 5. EU MDR / AI Act Transparency Requirements

**EU AI Act (Regulation 2024/1689) -- Effective August 2, 2026**

Clinical AI systems fall under **high-risk** classification. The AI Act
requires:

- **Traceability**: "Logging of activity to ensure traceability of results"
  (Article 12)
- **Transparency**: "Detailed documentation providing all information
  necessary on the system and its purpose for authorities to assess its
  compliance" (Article 11)
- **Human oversight**: "Appropriate human oversight measures" (Article 14)
- **Information to deployer**: "Clear and adequate information to the
  deployer" so they can interpret outputs correctly

The transparency risk tier specifically requires that humans interacting with
AI outputs "are made aware" and "can take an informed decision."

Per-claim citation satisfies traceability (each claim maps to a source
record), transparency (the reasoning chain is visible), and human oversight
(the clinician has the information needed to verify or override).

**EU MDR (Medical Device Regulation 2017/745)**
Clinical software that provides diagnostic or therapeutic recommendations may
also fall under MDR. Annex I General Safety and Performance Requirements
mandate that software provide "sufficient information regarding the data used
to train the algorithm" and enable users to understand outputs.

## 6. AI-Generated Summaries Leading to Wrong Clinical Actions

From the Stanceski et al. (2024) study:
- A 2x dosage error on Carbamazepine could cause toxicity (ataxia, nystagmus,
  seizures, cardiac arrhythmias) or sub-therapeutic levels (breakthrough
  seizures)
- 3% of summaries fabricated medications entirely--a clinician acting on this
  could prescribe a drug the patient was never meant to receive, with
  potential for drug interactions, allergic reactions, or contraindicated
  therapy
- 42% introduced fabricated follow-up actions--potentially causing unnecessary
  procedures, anxiety, or resource waste

From the Asgari et al. (2025) framework:
- Errors were categorized by clinical severity, with some reaching "major
  harm potential" classification
- The paper explicitly argues that without systematic safety evaluation
  frameworks, these errors will reach patients

**The pattern:** AI summaries do not fail with obvious gibberish. They fail
with plausible-sounding, grammatically correct, clinically dangerous
assertions that a busy clinician may not catch without explicit source
verification.

## 7. The "Looks Cited Without Being Cited" Failure Mode

This is the most dangerous anti-pattern in clinical AI:

**Definition:** A system produces output that appears authoritative and
well-structured but does not actually link specific claims to specific source
records. The professional-sounding format creates a false sense of
verification.

**How it manifests:**
1. Summary says "Patient has a history of atrial fibrillation (per cardiology
   consult 2024-01-15)" but the system did not actually verify this claim
   against the consult note--it inferred the date from context
2. Summary groups information under headers like "Medical History" and
   "Current Medications" creating structural authority without per-claim
   sourcing
3. Summary includes specific numbers (lab values, dosages) that look precise
   but were hallucinated or transposed from a different patient encounter

**Why this is worse than no citation:**
- No citation: Clinician knows they must verify everything
- Fake citation: Clinician trusts the output, verification is suppressed
- Real per-claim citation: Clinician can spot-check efficiently

The Goddard et al. automation bias literature directly supports this: the more
authoritative a system appears, the less likely clinicians are to verify its
output. A system that "looks cited" without actually being cited exploits
automation bias.

## 8. RAG Hallucination Rates in Medical Domains

Retrieval-Augmented Generation (RAG) is often presented as the solution to
hallucination. Evidence shows it reduces but does not eliminate the problem.

**Amugongo et al. (2025), PLOS Digital Health 4(6):e0000877
(PMID: 40498738)**
Systematic review of RAG for LLMs in healthcare. Key findings:
- RAG reduces hallucination compared to base LLMs, but residual hallucination
  rates remain clinically significant
- "In the healthcare domain there is currently a lack of systematic
  understanding" of RAG failure modes
- Retrieval failures (wrong document retrieved, partial retrieval, outdated
  information) introduce a new class of errors

**Alexandrou et al. (2025), JACC Cardiovasc Interv 18(20):2458-2467
(PMID: 41161918)**
Tested RAG with acute coronary syndrome guidelines. Found that "hallucinations
limit clinical utility" even with RAG augmentation.

**Haider et al. (2025), Bioengineering 12(11):1219 (PMID: 41301175)**
RAG-based virtual assistant for postoperative instructions. Acknowledged that
even with RAG, NLP systems produce hallucinations that require safeguards.

**Key insight for patient-360:** Our system uses RAG over patient records. RAG
reduces but does not eliminate hallucination. Per-claim citation is the safety
net--it lets clinicians verify that the retrieved context actually supports the
generated claim. Without citation, a RAG system that retrieves the wrong
document chunk and generates a plausible-sounding but incorrect claim is
undetectable without full manual review.

## 9. Evidence That Citation Improves Clinician Decision Quality

The evidence chain:
1. **Transparency improves trust calibration**: Wysocki et al. (2023), Artif
   Intell 316:103839 (PMID: 41550460) -- Pragmatic evaluation framework for
   explainable ML in clinical decision support. Found that explanations
   improve clinician ability to correctly accept or reject AI
   recommendations.

2. **Friction reduces automation bias**: Cabitza et al. (2024), Artif Intell
   Med 150:102819 (PMID: 38553159) -- "Frictional AI" concept: decision
   support that introduces deliberate friction (such as requiring source
   verification) improves decision quality compared to frictionless
   automation.

3. **Source attribution enables error detection**: The Asgari et al. (2025)
   framework's central thesis is that mapping LLM outputs to source documents
   is the prerequisite for detecting clinical errors. Their CREOLA tool
   provides a GUI specifically for comparing generated text against source
   records.

4. **Ask-Audit-Apply**: Jenkins et al. (2026) framework requires clinicians
   to "Audit" AI outputs before applying them. Per-claim citation is the
   mechanism that makes audit feasible at clinical speed.

**The argument in brief:** Without citation, a clinician must re-read the
entire patient record to verify a summary. With per-claim citation, they can
spot-check specific claims in seconds. The difference is between a safety
mechanism that works in practice and one that exists only in theory.

## 10. Professional Organization Position Statements

**American Geriatrics Society (2026), J Am Geriatr Soc (PMID: 42478489)**
Position statement on generative AI covering documentation, decision support,
patient education, and "emerging agentic systems." Warns about hallucination,
bias, and the need for transparency in clinical AI outputs.

**AMIA (American Medical Informatics Association)**
AMIA has published recommendations on responsible use of generative AI in
clinical settings (2023-2024 series). Core positions include:
- AI-generated clinical content must be verifiable against source records
- Transparency is a prerequisite for safe clinical AI deployment
- Clinicians must be able to understand and audit AI outputs
- Organizations deploying clinical AI must implement governance frameworks
  that include output verification

**AMA (American Medical Association)**
The AMA's policy on augmented intelligence (H-480.940) emphasizes that AI
tools in clinical settings must be "transparent" and "facilitate physician
oversight." Per-claim citation is a direct implementation of this policy.

**WHO (World Health Organization)**
WHO's 2024 guidance on large multi-modal models in health emphasizes
transparency, traceability, and the ability for healthcare workers to verify
AI outputs against source data.

---

## Summary: The Risk Matrix

| Without per-claim citation | With per-claim citation |
|---|---|
| Hallucinated claims look identical to real ones | Each claim links to source; hallucinations are orphaned |
| Negation errors are invisible | Clinician can click-verify negated assertions |
| Automation bias is maximized | Friction enables verification |
| FDA may classify as regulated device | Meets "show your work" for Non-Device CDS |
| EU AI Act traceability violated | Logging + attribution satisfies Article 12 |
| Errors caught only by full re-read | Spot-checking is possible at clinical speed |
| "Looks cited" failure mode enabled | Genuine citation or visible absence |

## The Bottom Line

Per-claim citation is not over-engineering. It is the **minimum viable safety
mechanism** for clinical AI summarization. Every regulatory framework (FDA,
EU AI Act, EU MDR), every professional organization (AMIA, AGS, AMA, WHO),
and the published evidence base converge on the same requirement: clinicians
must be able to verify AI-generated clinical claims against their source
records. Per-claim citation is how you implement that requirement.

The alternative--an uncited or "looks-cited" summary--is the thing that is
actually dangerous.
