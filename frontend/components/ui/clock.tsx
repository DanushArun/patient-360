import type { ReactNode } from "react";
import { formatClock } from "@/lib/display-format.mjs";

/** A record clock (R2). Reads naturally on screen; the exact stored value stays in
 * `datetime` and the tooltip, so provenance is never lost (INTERFACE-GUIDELINES §6). */
export function Clock({ value, fallback = "Not recorded" }: {
  value: string | null | undefined; fallback?: string;
}): ReactNode {
  if (!value) return <span>{fallback}</span>;
  return <time dateTime={value} title={`${value} (time zone as recorded)`}>{formatClock(value)}</time>;
}
