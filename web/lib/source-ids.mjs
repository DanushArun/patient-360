/** Ids (event/assertion/evidence) cited by tool results; recorded with each answer for provenance. */
export function sourceIds(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(sourceIds);
  return Object.entries(value).flatMap(([key, item]) => {
    if (["event_id", "assertion_id"].includes(key) &&
        typeof item === "string") return [item];
    if (key === "evidence_ids" && Array.isArray(item)) {
      return item.filter((id) => typeof id === "string");
    }
    return sourceIds(item);
  });
}
