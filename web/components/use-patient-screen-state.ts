"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PatientData } from "@/lib/patient";
import type { PatientSection } from "@/lib/workspace-state.mjs";
import type { Turn } from "@/app/patient/[id]/patient-evidence";
import type { SourceScope } from "@/components/workspace-patient-copilot";
import { resolvePatientSection } from "@/lib/workspace-state.mjs";

export function usePatientSectionState(patient: PatientData) {
  const [section, updateSection] = useState<PatientSection>(() => resolvePatientSection(null));
  const setSection = (value: PatientSection): void => {
    updateSection(value);
    window.history.replaceState(null, "", window.location.pathname
      + window.location.search + `#${value.toLowerCase().replaceAll(" ", "-")}`);
  };
  const [askOpen, setAskOpen] = useState(false);
  const [sourceScope, setSourceScope] = useState<SourceScope>("patient");
  const [language, setLanguage] = useState(languageCode(patient.language));
  useEffect(() => {
    const restore = () => resetSectionState({
      patient, setSection: updateSection, setAskOpen,
      setScope: setSourceScope, setLanguage,
    });
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, [patient.patientId]);
  return { section, setSection, askOpen, setAskOpen, sourceScope, setSourceScope,
    language, setLanguage };
}

function resetSectionState({ patient, setSection, setAskOpen, setScope, setLanguage }: {
  patient: PatientData;
  setSection: (value: PatientSection) => void;
  setAskOpen: (value: boolean) => void;
  setScope: (value: SourceScope) => void;
  setLanguage: (value: string) => void;
}): void {
  const hash = window.location.hash.slice(1);
  const section = hash.charAt(0).toUpperCase() + hash.slice(1);
  setSection(resolvePatientSection(hash === "coverage-comparison" ? hash : section));
  setAskOpen(hash === "ask-record");
  setScope("patient");
  setLanguage(languageCode(patient.language));
}

export function languageCode(language: string | null): string {
  const codes: Record<string, string> = {
    english: "en", hindi: "hi", tamil: "ta", bengali: "bn", marathi: "mr",
  };
  return codes[language?.trim().toLowerCase() ?? ""] ?? "en";
}

export function usePatientEvidenceSelection(
  patient: PatientData | null,
  turns: Turn[],
  askOpen: boolean,
  setAskOpen: (value: boolean) => void,
) {
  const [selected, setSelected] = useState<{ turnId: string; ruleId: string } | null>(null);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const contextRef = useRef<HTMLElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const selectedGate = resolveSelectedGate(patient, turns, selectedRule, selected);
  const contextTarget = selectedGate?.rule_id ?? (askOpen ? "ask" : "");
  useLayoutEffect(() => {
    setSelected(null);
    setSelectedRule(null);
  }, [patient?.patientId]);
  useContextFocus(Boolean(contextTarget), contextTarget, contextRef, focusReturnRef);
  const toggleAsk = () => {
    rememberFocus(focusReturnRef);
    setAskOpen(!askOpen);
    setSelected(null);
    setSelectedRule(null);
  };
  const selectGate = (ruleId: string) => {
    rememberFocus(focusReturnRef);
    setSelected(null);
    setSelectedRule(ruleId);
    setAskOpen(false);
  };
  const selectAnswer = (turnId: string, ruleId: string) => {
    rememberFocus(focusReturnRef);
    setSelected(null);
    setSelectedRule(null);
    setAskOpen(false);
    setSelected({ turnId, ruleId });
  };
  const closeEvidence = () => { setSelected(null); setSelectedRule(null); };
  return { selected, selectedGate, contextOpen: Boolean(contextTarget), contextRef,
    selectGate, selectAnswer, closeEvidence, toggleAsk };
}

function resolveSelectedGate(
  patient: PatientData | null,
  turns: Turn[],
  selectedRule: string | null,
  selected: { turnId: string; ruleId: string } | null,
) {
  return patient?.gates.find((gate) => gate.rule_id === selectedRule)
    ?? (selected ? turns.find((turn) => turn.id === selected.turnId)?.gates.find(
      (gate) => (gate.rule_id ?? gate.gate) === selected.ruleId
    ) ?? null : null);
}

function useContextFocus(
  isOpen: boolean,
  target: string,
  contextRef: React.RefObject<HTMLElement | null>,
  focusReturnRef: React.MutableRefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (isOpen) focusContext(contextRef.current);
    else restoreFocus(focusReturnRef);
  }, [isOpen, target, contextRef, focusReturnRef]);
}

function focusContext(panel: HTMLElement | null): void {
  if (!panel || !window.matchMedia("(max-width: 900px)").matches) return;
  panel.scrollIntoView({ block: "start" });
  (panel.querySelector<HTMLElement>("h2") ?? panel).focus();
}

function restoreFocus(target: React.MutableRefObject<HTMLElement | null>): void {
  if (target.current?.isConnected) target.current.focus();
  target.current = null;
}

function rememberFocus(target: React.MutableRefObject<HTMLElement | null>): void {
  target.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}
