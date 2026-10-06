"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Check, ChevronDown, Crosshair, Square, X } from "lucide-react";
import type { AskPhase } from "@/components/workspace-patient-copilot";
import type { CopilotChip } from "./copilot-provider";
import styles from "./copilot.module.css";

// Shared copilot surfaces: composer, staged progress, starters (COPILOT-EXPERIENCE §4–§5).

const PHASE_LABEL: Record<AskPhase, string> = {
  access: "Checking access and consent",
  routing: "Routing the question",
  refusing: "Preparing a referral to the treating practitioner",
  reading: "Reading the record",
  references: "Searching the reference documents",
  validating: "Validating every cited claim",
  saving: "Saving to history",
};

/** Real progress: each line is a step the server reported starting. Nothing is simulated.
 * `embedded` drops the card so the list can sit under the live copilot's "Ask" step. */
export function CopilotProgress({ phases, busy, embedded = false }: {
  phases: AskPhase[]; busy: boolean; embedded?: boolean;
}): ReactNode {
  if (!busy) return null;
  const shown = phases.length ? phases : (["access"] as AskPhase[]);
  return <ol className={styles.progress} data-embedded={embedded || undefined} role="status"
    aria-live="polite" aria-label="Answer progress">
    {shown.map((phase, index) => {
      const current = index === shown.length - 1;
      return <li key={phase} data-current={current || undefined}>
        {current ? <span className={styles.pulse} aria-hidden /> : <Check size={12} aria-hidden />}
        {PHASE_LABEL[phase]}{current ? "…" : ""}
      </li>;
    })}
  </ol>;
}

/** Keeps a chat stream pinned to its newest line while content grows, unless the person has
 * scrolled up to read; `pin` re-attaches it (on send). One jump per change, never a smooth
 * scroll chasing a moving target. */
export function useStickToBottom(): { ref: (node: HTMLElement | null) => void; pin: () => void } {
  const node = useRef<HTMLElement | null>(null);
  const pinned = useRef(true);
  const cleanup = useRef<(() => void) | null>(null);
  const toBottom = useCallback(() => {
    if (pinned.current && node.current) node.current.scrollTop = node.current.scrollHeight;
  }, []);
  const ref = useCallback((element: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    node.current = element;
    if (!element) return;
    const onScroll = () => {
      pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    };
    const resize = new ResizeObserver(toBottom);
    const observeChildren = () => {
      resize.disconnect();
      resize.observe(element);
      for (const child of element.children) resize.observe(child);
    };
    const mutation = new MutationObserver(() => { observeChildren(); toBottom(); });
    observeChildren();
    mutation.observe(element, { childList: true });
    element.addEventListener("scroll", onScroll, { passive: true });
    pinned.current = true;
    toBottom();
    cleanup.current = () => {
      resize.disconnect();
      mutation.disconnect();
      element.removeEventListener("scroll", onScroll);
    };
  }, [toBottom]);
  const pin = useCallback(() => { pinned.current = true; toBottom(); }, [toBottom]);
  return { ref, pin };
}

/** How long a read took, in the units a person reads at a glance. */
export function elapsedLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 100) / 10)}s`;
  if (ms < 60000) return `${Math.round(ms / 100) / 10}s`;
  const minutes = Math.floor(ms / 60000);
  return `${minutes}m ${Math.round((ms % 60000) / 1000)}s`;
}

/** The work behind a finished answer, kept with it: one quiet line naming what was done and
 * how long it took, opening to the steps the server actually reported. Collapsed by default,
 * because the answer is the point and the trace is the justification for it. */
export function AnswerTrace({ trace }: { trace?: { phases: string[]; ms: number } }): ReactNode {
  const [open, setOpen] = useState(false);
  const phases = (trace?.phases ?? []).filter((phase): phase is AskPhase => phase in PHASE_LABEL);
  if (!trace || !phases.length) return null;
  const time = elapsedLabel(trace.ms);
  return <div className={styles.trace}>
    <button type="button" className={styles.traceSummary} aria-expanded={open}
      onClick={() => setOpen(!open)}>
      <span>{phases.includes("refusing") ? "Checked the question"
        : phases.includes("references") ? "Searched the references" : "Read the record"}
        {time ? ` in ${time}` : ""}</span>
      <ChevronDown size={12} aria-hidden data-open={open || undefined} />
    </button>
    {open && <ol className={styles.traceSteps}>
      {phases.map((phase) => <li key={phase}>
        <Check size={12} aria-hidden />{PHASE_LABEL[phase]}
      </li>)}
    </ol>}
  </div>;
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
    {/* Typing stays open while an answer runs, so the next question can be drafted; only
        sending waits. */}
    <textarea ref={input} name="question" autoComplete="off" aria-label={label} rows={1}
      value={value} placeholder={placeholder} onChange={(event) => setValue(event.target.value)}
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
