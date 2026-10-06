// Pure helpers for read-ahead (lib/warm.ts): canonical cache keys and a concurrency limit, so
// background warming shares cache entries with the API routes and never floods the warehouse.

/** Cache key for a validated workspace query; field order and URL order do not matter. */
export function workspaceCacheKey(query) {
  return `workspace:${query.view}:${query.domain ?? ""}:${query.knownAsOf ?? ""}:${query.documentId ?? ""}`;
}

/** Returns run(task): at most `limit` tasks execute at once; the rest wait their turn. */
export function limitConcurrency(limit) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= limit || !waiting.length) return;
    active += 1;
    const { task, resolve, reject } = waiting.shift();
    task().then(resolve, reject).finally(() => { active -= 1; next(); });
  };
  return (task) => new Promise((resolve, reject) => { waiting.push({ task, resolve, reject }); next(); });
}
