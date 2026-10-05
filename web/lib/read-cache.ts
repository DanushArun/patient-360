// Short-lived server-side cache for patient READS. Every cached value was produced by a full
// withPatientSession (bind, consent check, read, consent re-check), so a hit is at most
// TTL_MS old. Consent withdrawn inside that window is therefore honoured on the next miss,
// not instantly: the explicit trade for millisecond repeat loads. Writes bump the patient's
// generation, which drops cached entries and stops reads that began before the write from
// storing a stale result. Errors are never cached.
const TTL_MS = 15_000;
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

/** Call after any write that can change what a patient read returns. */
export function invalidatePatient(patientId: string): void {
  state.generations.set(patientId, generationOf(patientId) + 1);
  for (const key of state.entries.keys()) {
    if (key.startsWith(`${patientId}\u0000`)) state.entries.delete(key);
  }
}
