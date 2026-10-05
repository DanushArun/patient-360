"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { MAX_CONTEXT_REFERENCES, type ContextReference } from "@/lib/api-contracts.mjs";

// The copilot frame shared by every page (docs/design/COPILOT-EXPERIENCE.md). Pages that own
// a patient conversation render it into `slot`; everything else gets cohort mode.

export type CopilotChip = ContextReference & { label: string };
export type CopilotPatientScope = { patientId: string; patientName: string;
  knownAsOf: string | null };

type CopilotState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  inspector: boolean;
  setInspector: (inspector: boolean) => void;
  picking: boolean;
  setPicking: (picking: boolean) => void;
  chips: CopilotChip[];
  attach: (chip: CopilotChip) => void;
  detach: (chip: CopilotChip) => void;
  clearChips: () => void;
  patient: CopilotPatientScope | null;
  setPatient: (patient: CopilotPatientScope | null) => void;
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
};

const CopilotContext = createContext<CopilotState | null>(null);

export function useCopilot(): CopilotState {
  const value = useContext(CopilotContext);
  if (!value) throw new Error("useCopilot outside CopilotProvider");
  return value;
}

/** Safe for components that may render outside the provider (fixtures, previews). */
export function useOptionalCopilot(): CopilotState | null {
  return useContext(CopilotContext);
}

export function CopilotProvider({ children }: { children: ReactNode }): ReactNode {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [picking, setPicking] = useState(false);
  const [chips, setChips] = useState<CopilotChip[]>([]);
  const [patient, setPatientState] = useState<CopilotPatientScope | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const attach = useCallback((chip: CopilotChip) => {
    setChips((current) => current.some((item) => item.kind === chip.kind && item.id === chip.id)
      ? current : [...current, chip].slice(-MAX_CONTEXT_REFERENCES));
    setOpen(true);
  }, []);
  const detach = useCallback((chip: CopilotChip) => setChips((current) =>
    current.filter((item) => !(item.kind === chip.kind && item.id === chip.id))), []);
  const clearChips = useCallback(() => setChips([]), []);
  // A different patient means different evidence: attached items never carry across.
  const setPatient = useCallback((next: CopilotPatientScope | null) => {
    setPatientState((current) => {
      if (current?.patientId !== next?.patientId) setChips([]);
      return next;
    });
  }, []);

  useCopilotKeyboard({ open, setOpen, picking, setPicking });
  useDockedLayout(open, expanded);

  const value = useMemo<CopilotState>(() => ({
    open, setOpen, toggle: () => setOpen((current) => !current), expanded, setExpanded,
    inspector, setInspector, picking, setPicking, chips, attach, detach, clearChips,
    patient, setPatient, slot, setSlot,
  }), [open, expanded, inspector, picking, chips, attach, detach, clearChips, patient,
    setPatient, slot]);
  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

function useCopilotKeyboard({ open, setOpen, picking, setPicking }: {
  open: boolean; setOpen: (open: boolean) => void;
  picking: boolean; setPicking: (picking: boolean) => void;
}): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(
          "[data-copilot-composer] textarea")?.focus());
      } else if (event.key === "Escape" && picking) {
        setPicking(false);
      } else if (event.key === "Escape" && open
        && document.activeElement?.closest("[data-copilot-panel]")) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, picking, setPicking]);
}

/** The panel docks beside the record and narrows it, never covering it. */
function useDockedLayout(open: boolean, expanded: boolean): void {
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.copilot = expanded ? "wide" : "open";
    else delete root.dataset.copilot;
    return () => { delete root.dataset.copilot; };
  }, [open, expanded]);
}
