import type { ReactNode } from "react";

export function CensusErrorNotice(): ReactNode {
  return <div
    className="mb-6 border-l-2 py-2 pl-3 text-sm"
    role="alert"
    style={{ borderColor: "var(--sa-ink-fail)", color: "var(--sa-ink-secondary)" }}
  >
    The patient list is unavailable. Try again later.
  </div>;
}
