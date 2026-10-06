import { loadEvidenceHistory, loadPatientSnapshot, loadReviewTasks, loadTaskOwners,
  readSnapshotGates, readTimeline, type PatientData } from "./patient";
import { loadReviewQueue, readSchemes, readView, type WorkspaceQuery } from "./workspace-read";
import { limitConcurrency, workspaceCacheKey } from "./warm-plan.mjs";
import { cachedRead, peekRead, primeRead, readAge, readGeneration } from "./read-cache";
import { withPatientSessionAndContext } from "./snowflake";

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
// First screens get their own lane: short sessions, more at once, never queued behind tabs.
const runFirst = ((globalThis as { __saarthiWarmFirst?: ReturnType<typeof limitConcurrency> })
  .__saarthiWarmFirst ??= limitConcurrency(8));
const quietFirst = (task: () => Promise<unknown>) => { void runFirst(task).catch(() => undefined); };

/** Census: each patient's first screen and every tab, ahead of the click (warmPatientBundle). */
export function warmPatients(patientIds: string[]): void {
  // Every first screen first (one short session each, in parallel), then tabs in the background.
  for (const id of patientIds) quietFirst(() => loadPatientSnapshot(id));
  quiet(() => loadReviewQueue());
  for (const id of patientIds) quiet(() => warmPatientBundle(id));
}

type Run = (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>;
type Settle = { resolve: (value: unknown) => void; reject: (reason: unknown) => void };

/** Reserve a cache key for a value this bundle will read. Returns null when the key is already
 * cached or being loaded by someone else, so a read is never done twice. */
function claim(patientId: string, key: string): Settle | null {
  if (peekRead(patientId, key)) return null;
  let settle: Settle | null = null;
  const pending = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  pending.catch(() => undefined);
  let mine = false;
  void cachedRead(patientId, key, () => { mine = true; return pending; });
  return mine ? settle : null;
}

const viewQuery = (view: WorkspaceQuery["view"], domain: string | null,
  knownAsOf: string | null): WorkspaceQuery =>
  ({ view, domain, knownAsOf, documentId: null }) as WorkspaceQuery;

/**
 * One governed session for a patient's whole first visit, instead of one session per tab.
 * Each uncached patient read used to pay its own bind, opening access check, closing re-check
 * and release (~5 s of the ~7 s a read costs, measured in QUERY_HISTORY on 6 Oct). Here that
 * is paid once. Nothing is published unread or unchecked: the Overview snapshot is published
 * after an access checkpoint, the tabs after a second one, and a failure rejects every key
 * still pending, so the routes fall back to their own governed read.
 */
export async function warmPatientBundle(patientId: string, renew = false): Promise<void> {
  if (renew) return renewPatientBundle(patientId);
  const cached = peekRead<PatientData>(patientId, "snapshot");
  const known = cached ? await cached.catch(() => null) : null;
  const snapshotSlot = known ? null : claim(patientId, "snapshot");
  if (!known && !snapshotSlot) return; // another request is reading this patient now
  const open: Settle[] = snapshotSlot ? [snapshotSlot] : [];
  try {
    await withPatientSessionAndContext(patientId, async (run, context, checkpoint) => {
      let snapshot = known;
      if (!snapshot) {
        snapshot = { ...context, ...await readSnapshotGates(run) } as PatientData;
        await checkpoint();
        snapshotSlot!.resolve(snapshot);
        open.splice(open.indexOf(snapshotSlot!), 1);
      }
      const knownAsOf = snapshot.knownAsOf;
      const reads: [string, (run: Run) => Promise<unknown>][] = [
        [workspaceCacheKey(viewQuery("documents", null, knownAsOf)),
          (r) => readView(r, viewQuery("documents", null, knownAsOf))],
        [workspaceCacheKey(viewQuery("coverage_comparison", null, knownAsOf)),
          (r) => readView(r, viewQuery("coverage_comparison", null, knownAsOf))],
        ...FACT_DOMAINS.map((domain): [string, (run: Run) => Promise<unknown>] =>
          [workspaceCacheKey(viewQuery("facts", domain, knownAsOf)),
            (r) => readView(r, viewQuery("facts", domain, knownAsOf))]),
        ["timeline", readTimeline],
        ["schemes", readSchemes],
      ];
      const results: [Settle, { ok: unknown } | { error: unknown }][] = [];
      for (const [key, read] of reads) {
        const slot = claim(patientId, key);
        if (!slot) continue;
        open.push(slot);
        // One view can fail on its own (financial consent withholds coverage reads only).
        results.push([slot, await read(run).then((ok) => ({ ok }), (error) => ({ error }))]);
      }
      await checkpoint();
      for (const [slot, result] of results) {
        if ("ok" in result) slot.resolve(result.ok); else slot.reject(result.error);
        open.splice(open.indexOf(slot), 1);
      }
    });
  } catch (error) {
    for (const slot of open) slot.reject(error);
  }
}

/** Patient page: every tab and side read, ahead of the tab click. */
export function warmPatientViews(patient: PatientData): void {
  const id = patient.patientId;
  quiet(() => warmPatientBundle(id));
  quiet(() => loadEvidenceHistory(id));
  quiet(() => loadTaskOwners(id));
  for (const gate of patient.gates) {
    if (gate.outcome !== "pass" && gate.rule_id) quiet(() => loadReviewTasks(id, gate.rule_id!));
  }
}

/** Re-read a patient's cached first visit before it expires, in one governed session. The
 * cached values keep serving until the new ones pass the session's access checkpoint. */
async function renewPatientBundle(patientId: string): Promise<void> {
  const generation = readGeneration(patientId);
  await withPatientSessionAndContext(patientId, async (run, context, checkpoint) => {
    const snapshot = { ...context, ...await readSnapshotGates(run) } as PatientData;
    const knownAsOf = snapshot.knownAsOf;
    const values: [string, unknown][] = [["snapshot", snapshot]];
    for (const query of [viewQuery("documents", null, knownAsOf),
      viewQuery("coverage_comparison", null, knownAsOf),
      ...FACT_DOMAINS.map((domain) => viewQuery("facts", domain, knownAsOf))]) {
      values.push([workspaceCacheKey(query), await readView(run, query).catch(() => undefined)]);
    }
    values.push(["timeline", await readTimeline(run).catch(() => undefined)]);
    values.push(["schemes", await readSchemes(run).catch(() => undefined)]);
    await checkpoint();
    for (const [key, value] of values) {
      if (value !== undefined) primeRead(patientId, key, value, generation);
    }
  }).catch(() => undefined);
}

// Keep the day-care list warm while someone is using the dashboard. Each cached read lives
// two minutes (read-cache.ts); renewing at 80 s means an open is never cold mid-session.
// Renewal stops ten minutes after the last page request, so an idle app costs nothing.
const RENEW_AT_MS = 70_000;
const IDLE_STOP_MS = 10 * 60_000;
const keep = ((globalThis as { __saarthiKeepWarm?: { ids: string[]; seen: number;
  timer: ReturnType<typeof setInterval> | null } }).__saarthiKeepWarm ??=
  { ids: [], seen: 0, timer: null });

export function keepWarm(patientIds: string[]): void {
  if (patientIds.length) keep.ids = patientIds;
  keep.seen = Date.now();
  if (keep.timer) return;
  keep.timer = setInterval(() => {
    if (Date.now() - keep.seen > IDLE_STOP_MS) {
      clearInterval(keep.timer!);
      keep.timer = null;
      return;
    }
    for (const id of keep.ids) {
      const age = readAge(id, "snapshot");
      if (age === null) quietFirst(() => loadPatientSnapshot(id));
      else if (age >= RENEW_AT_MS) quietFirst(() => renewSnapshot(id));
    }
  }, 20_000);
  keep.timer.unref?.();
}

/** Re-read one patient's first screen before it expires; the cached one serves meanwhile. */
async function renewSnapshot(patientId: string): Promise<void> {
  const generation = readGeneration(patientId);
  await withPatientSessionAndContext(patientId, async (run, context, checkpoint) => {
    const snapshot = { ...context, ...await readSnapshotGates(run) } as PatientData;
    await checkpoint();
    primeRead(patientId, "snapshot", snapshot, generation);
  }).catch(() => undefined);
}
