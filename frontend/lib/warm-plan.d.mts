export function workspaceCacheKey(query: { view: string; domain: string | null; knownAsOf: string | null; documentId: string | null }): string;
export function limitConcurrency(limit: number): <T>(task: () => Promise<T>) => Promise<T>;
