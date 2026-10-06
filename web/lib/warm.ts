import { loadEvidenceHistory, loadPatientSnapshot, loadPatientTimeline, loadReviewTasks,
  loadTaskOwners, type PatientData } from "./patient";
import { loadReviewQueue, loadSchemes, loadWorkspaceView } from "./workspace-read";
import { limitConcurrency } from "./warm-plan.mjs";

// Read-ahead: every uncached patient read is a governed session of ~9 s (bind, access check,
// read, re-check, release). Loading what the user is about to open, in the background and
// into the same cache the routes use, makes navigation feel instant. Reads only, never writes;
// results expire with the cache window (read-cache.ts); failures are ignored, never cached.

const FACT_DOMAINS = ["labs", "demographics", "coverage", "treatment_plan", "encounters",
  "identity"] as const;
// Shared across requests so concurrent pages never flood the warehouse.
const run = ((globalThis as { __saarthiWarmLimit?: ReturnType<typeof limitConcurrency> })
  .__saarthiWarmLimit ??= limitConcurrency(4));
const quiet = (task: () => Promise<unknown>) => { void run(task).catch(() => undefined); };

/** Census: everything a patient's first screen (Overview) needs, ahead of the click: the
 * snapshot, then the documents read the Overview's record inventory asks for at its clock. */
export function warmPatients(patientIds: string[]): void {
  quiet(() => loadReviewQueue());
  for (const id of patientIds) {
    quiet(async () => {
      const patient = await loadPatientSnapshot(id);
      await loadWorkspaceView(id, { view: "documents", domain: null,
        knownAsOf: patient.knownAsOf, documentId: null });
    });
  }
}

/** Patient page: every tab and side read, ahead of the tab click. */
export function warmPatientViews(patient: PatientData): void {
  const id = patient.patientId;
  const knownAsOf = patient.knownAsOf;
  quiet(() => loadWorkspaceView(id, { view: "documents", domain: null, knownAsOf, documentId: null }));
  quiet(() => loadWorkspaceView(id, { view: "coverage_comparison", domain: null, knownAsOf,
    documentId: null }));
  for (const domain of FACT_DOMAINS) {
    quiet(() => loadWorkspaceView(id, { view: "facts", domain, knownAsOf, documentId: null }));
  }
  quiet(() => loadPatientTimeline(id));
  quiet(() => loadEvidenceHistory(id));
  quiet(() => loadTaskOwners(id));
  quiet(() => loadSchemes(id));
  for (const gate of patient.gates) {
    if (gate.outcome !== "pass" && gate.rule_id) quiet(() => loadReviewTasks(id, gate.rule_id!));
  }
}
