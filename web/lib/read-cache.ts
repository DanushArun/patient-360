// Short-lived server-side cache for patient READS. Every cached value was produced by a full
// withPatientSession (bind, consent check, read, consent re-check), so a hit is at most
// TTL_MS old. Consent withdrawn inside that window is therefore honoured on the next miss,
// not instantly: the explicit trade for millisecond repeat loads.
// Window: 2 minutes (decided 6 Oct 2026). Each uncached read costs ~9 s of governed round
// trips, so read-ahead (warm.ts) needs entries to outlive the click that follows it. Writes bump the patient's
// generation, which drops cached entries and stops reads that began before the write from
// storing a stale result. Errors are never cached.
const TTL_MS = 120_000;
const MAX_ENTRIES = 500;

type Entry = { at: number; generation: number; value: Promise<unknown> };
type State = { entries: Map<string, Entry>; generations: Map<string, number> };

const state = ((globalThis as { __saarthiReadCache?: State }).__saarthiReadCache ??=
  { entries: new Map(), generations: new Map() });

const generationOf = (patientId: string) => state.generations.get(patientId) ?? 0;

export function cachedRead<T>(patientId: string, name: string, load: () => Promise<T>): Promise<T> {
  const key = `${patientId}\u0000${name}`;
  const generation = generationOf(patientId);
  const hit = state.entries.get(key);
  if (hit && hit.generation === generation && Date.now() - hit.at < TTL_MS) {
    return hit.value as Promise<T>;
  }
  // Concurrent callers share one in-flight load through the stored promise.
  const value = load();
  if (state.entries.size >= MAX_ENTRIES) state.entries.clear();
  const entry: Entry = { at: Date.now(), generation, value };
  state.entries.set(key, entry);
  value.catch(() => { if (state.entries.get(key) === entry) state.entries.delete(key); });
  return value;
}

/** A fresh cached read, or null. Never starts a load: the copilot reads through its own
 * bound session on a miss instead of opening a second one. */
export function peekRead<T>(patientId: string, name: string): Promise<T> | null {
  const hit = state.entries.get(`${patientId}\u0000${name}`);
  return hit && hit.generation === generationOf(patientId) && Date.now() - hit.at < TTL_MS
    ? hit.value as Promise<T> : null;
}

/** Drop one cached read (a write that changes only that read, e.g. answer history). */
export function forgetRead(patientId: string, name: string): void {
  state.entries.delete(`${patientId}\u0000${name}`);
}

/** Scope for reads that span patients (review queue): any patient write invalidates it. */
export const WORKSPACE_SCOPE = "__workspace";

/** Call after any write that can change what a patient read returns. */
export function invalidatePatient(patientId: string): void {
  if (patientId !== WORKSPACE_SCOPE) invalidatePatient(WORKSPACE_SCOPE);
  state.generations.set(patientId, generationOf(patientId) + 1);
  for (const key of state.entries.keys()) {
    if (key.startsWith(`${patientId}\u0000`)) state.entries.delete(key);
  }
}
