"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useOptionalCopilot } from "./copilot-provider";

/** Toolbar entry to the copilot. Shown at phone width, where a floating launcher would sit on
 * top of page content (HIG: frequent actions belong in the toolbar). */
export function CopilotTrigger(): ReactNode {
  const copilot = useOptionalCopilot();
  if (!copilot) return null;
  return <button type="button" className="sa-copilot-trigger" aria-label="Open Saarthi copilot"
    title="Ask Saarthi" onClick={() => copilot.setOpen(true)}>
    <Sparkles size={16} strokeWidth={1.8} aria-hidden />
  </button>;
}
