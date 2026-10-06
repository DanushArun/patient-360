"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUp, Check, Crosshair, Square, X } from "lucide-react";
import type { AskPhase } from "@/components/workspace-patient-copilot";
import type { CopilotChip } from "./copilot-provider";
import styles from "./copilot.module.css";

// Shared copilot surfaces: composer, staged progress, starters (COPILOT-EXPERIENCE §4–§5).

const PHASE_LABEL: Record<AskPhase, string> = {
  access: "Checking access and consent",
  routing: "Routing the question",
  refusing: "Preparing a referral to the treating practitioner",
  reading: "Reading the record",
  validating: "Validating every cited claim",
  saving: "Saving to history",
};

/** Real progress: each line is a step the server reported starting. Nothing is simulated. */
export function CopilotProgress({ phases, busy }: { phases: AskPhase[]; busy: boolean }): ReactNode {
  if (!busy) return null;
  const shown = phases.length ? phases : (["access"] as AskPhase[]);
  return <ol className={styles.progress} role="status" aria-live="polite"
    aria-label="Answer progress">
    {shown.map((phase, index) => {
      const current = index === shown.length - 1;
      return <li key={phase} data-current={current || undefined}>
        {current ? <span className={styles.pulse} aria-hidden /> : <Check size={12} aria-hidden />}
        {PHASE_LABEL[phase]}{current ? "…" : ""}
      </li>;
    })}
  </ol>;
}

export function CopilotStarters({ starters, onPick }: {
  starters: string[]; onPick: (text: string) => void;
}): ReactNode {
  return <div className={styles.starters} aria-label="Suggested questions">
    {starters.map((starter) => <button key={starter} type="button"
      onClick={() => onPick(starter)}>{starter}</button>)}
  </div>;
}

export function CopilotComposer({ label, placeholder, value, setValue, busy, onSend, onStop,
  chips, onDetach, picking, onPick, leading }: {
  label: string;
  placeholder: string;
  value: string;
  setValue: (value: string) => void;
  busy: boolean;
  onSend: () => void;
  onStop?: () => void;
  chips: CopilotChip[];
  onDetach: (chip: CopilotChip) => void;
  picking: boolean;
  onPick: () => void;
  leading?: ReactNode;
}): ReactNode {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 6 * 20 + 16)}px`;
  }, [value]);
  return <form data-copilot-composer className={styles.composer}
    onSubmit={(event) => { event.preventDefault(); if (!busy && value.trim()) onSend(); }}>
    {(leading || chips.length > 0) && <div className={styles.chips}>
      {leading}
      {chips.map((chip) => <span key={`${chip.kind}:${chip.id}`} className={styles.chip}>
        {chip.label}
        <button type="button" aria-label={`Remove ${chip.label}`} onClick={() => onDetach(chip)}>
          <X size={12} aria-hidden /></button>
      </span>)}
    </div>}
    <textarea ref={input} name="question" autoComplete="off" aria-label={label} rows={1} value={value} placeholder={placeholder}
      disabled={busy} onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (!busy && value.trim()) onSend();
      }} />
    <div className={styles.composerBar}>
      <button type="button" className={styles.iconButton} aria-pressed={picking}
        aria-label="Pick an item from the page" title="Pick an item from the page"
        onClick={onPick}><Crosshair size={16} aria-hidden /></button>
      <span className={styles.hint}>Enter to send · Shift+Enter for a new line</span>
      {busy && onStop
        ? <button type="button" className={styles.send} aria-label="Stop" onClick={onStop}>
          <Square size={12} fill="currentColor" aria-hidden /></button>
        : <button type="submit" className={styles.send} aria-label="Send"
          disabled={busy || !value.trim()}><ArrowUp size={16} aria-hidden /></button>}
    </div>
  </form>;
}
