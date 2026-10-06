# Floating care copilot — concept study
6 October 2026. Concept study. Implemented the same day: see ../COPILOT-EXPERIENCE.md §8 and IMPLEMENTATION-STATUS.md (Live copilot).

## Intent
An optional intelligence layer that helps a medical professional navigate the existing dashboard, retrieve permitted record evidence and collect cited results in the existing right-hand chat. Manual use remains available throughout. These images depict proposed interactions, not a verified running feature.

## Research and application
- [Apple HIG: Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai): keep people in control, make AI identifiable, support corrections and describe real progress. Applied as explicit enablement, stop/pause controls, activity receipts and editable voice transcription.
- [OpenAI UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines): conversation can remain alongside richer work surfaces; floating surfaces suit ongoing sessions and should stay lightweight; result cards need few clear actions. Applied as one conversation with a compact floating controller, persistent evidence and source-opening actions. This is an adaptation to SAARTHI, not an assertion that its standalone UI must follow ChatGPT plugin layout requirements.
- [OpenAI: What makes a great ChatGPT app](https://developers.openai.com/blog/what-makes-a-great-chatgpt-app): useful conversational capabilities bring relevant context, enable actions and offer clear next steps. Applied as scoped record navigation and evidence retrieval.

Local grounding: ../INTERFACE-GUIDELINES.md; ../../../docs/architecture/SPEC.md; ../../../docs/architecture/COPILOT-SPEC.md. The current interface guidelines take precedence over the older designer brief for typography.

## Three rendered moments
1. 01-listen-and-select.png — voice request with roster available; explicit patient selection before patient-specific retrieval.
2. 02-find-and-bring-to-chat.png — selected patient's document is open, a source is collected in chat and actual completed steps are visible. The connector illustrates a transfer; a real UI would use a brief optional cue.
3. 03-review-with-copilot-hidden.png — results and activity remain available while the floating control is hidden; top-level enable/disable is accessible.

## Proposed interaction contract
- Off: no microphone capture or new copilot work. The dashboard continues normally.
- On: enables assistance; does not automatically activate the microphone.
- Listen: explicit user action starts microphone capture; transcript stays visible and correctable. Stop ends capture.
- Hide: collapses the floating controller and stops microphone capture. Already authorised retrieval may continue; activity/results remain in chat. Show restores the controller.
- Pause: stops dispatching further steps and requests cancellation of current cancellable work; display the true state if a request cannot be interrupted.
- Disable: stops capture, cancels pending steps and invalidates late UI changes; completed results remain reviewable under the same authorised patient context.
- Manual navigation takes priority. Pause conflicting automatic navigation, never seize focus, and never scroll the user's active view unexpectedly.
- Reserve actual layout space for the dock. At narrower widths use a header controller; never overlap records or controls.
- One shared conversation, one composer. Floating control is not a second chatbot.
- Patient selection is a human action recorded through existing binding. A spoken name may suggest a permitted patient, never silently bind one.
- Switching patient cancels work and clears prior patient chat/source context. Late results must be discarded if binding or scope changes.
- No arbitrary patient selector in agent tool schemas. Recheck access and consent on every retrieval.
- Progress comes from completed operations, not invented reasoning or timers.
- Statuses, counts, dates and rule outcomes come from versioned SQL facts. Patient evidence and reference evidence remain separate.
- Clinical judgement requests follow existing Class A refusal and evidence-packet flow for the named treating practitioner.
- Keyboard alternatives, visible focus, text status alongside glyphs, reduced-motion/static transfer cue, high contrast and an opaque-material fallback are required before implementation.

## Render review and limits
All three outputs were visually inspected. A generated expansion of ANC to antenatal assessment and a fabricated final-report rule identifier in the third render were corrected in a targeted second pass. ANC now reads absolute neutrophil count; the fabricated identifier is removed.

Image generation still introduces illustrative data, document text and minor visual inconsistencies. The lab values, sample report and report/coverage gaps are not validated against backend records and are not proposed new rules. Treat the set as a visual interaction study, not clinical evidence or implementation specifications. In image 1 the dock visually approaches the bottom roster card; implementation must enforce the reserved strip and scroll padding. No usability testing or motion prototype was performed.

## Generation
Built-in image_gen mode, three separate scene prompts and one corrective edit. Reference: the screenshot attached by the user. Exact prompt set is saved in prompts.md. Final PNGs are saved beside this document. No files staged or committed.

