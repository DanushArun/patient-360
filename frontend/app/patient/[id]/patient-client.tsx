"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useOptionalCopilot } from "@/components/copilot/copilot-provider";
import { useParams } from "next/navigation";
import type { RosterPatient } from "@/components/patient-roster";
import type { PatientData } from "@/lib/patient";
import type { PatientSection } from "@/lib/workspace-state.mjs";
import type { Turn } from "@/app/patient/[id]/patient-evidence";
import type { LivePatientPage } from "@/components/copilot/copilot-live";
import { usePatientRecord } from "@/components/use-patient-record";
import { usePatientChat, useStoredTurns } from "@/components/workspace-patient-copilot";
import { usePatientReviewTask } from "@/components/use-patient-review-task";
import {
  PatientAccessUnavailable,
  PatientLoading,
  PatientWorkspaceScreen,
} from "@/components/workspace-patient-screen";
import {
  usePatientEvidenceSelection,
  usePatientSectionState,
} from "@/components/use-patient-screen-state";

type PatientClientProps = {
  patient: PatientData;
  patients?: RosterPatient[];
  preview?: boolean;
};

export default function PatientClient({
  patient,
  patients = [],
  preview = false,
}: PatientClientProps): ReactNode {
  const params = useParams<{ id: string }>();
  const record = usePatientRecord(patient, params.id, preview);
  const { accessAvailable, currentPatient, refreshState, refreshReadiness } = record;
  const sections = usePatientSectionState(patient);
  // The docked copilot owns open/close; the page keeps owning the conversation itself.
  const copilotContext = useOptionalCopilot();
  const copilot = preview ? null : copilotContext;
  const askOpen = copilot ? copilot.open : sections.askOpen;
  // Selecting evidence shows it in the page while the docked conversation stays open, so the
  // selection logic may open the copilot but never closes it (COPILOT-EXPERIENCE §1).
  const selectionAskOpen = copilot ? false : sections.askOpen;
  const setSelectionAskOpen = copilot
    ? (value: boolean) => { if (value) copilot.setOpen(true); } : sections.setAskOpen;
  const setCopilotPatient = copilot?.setPatient;
  useEffect(() => {
    if (!setCopilotPatient) return;
    // Withdrawn access drops the patient scope at once; nothing about them stays on screen.
    if (!accessAvailable || !currentPatient) { setCopilotPatient(null); return; }
    setCopilotPatient({ patientId: currentPatient.patientId, patientName: currentPatient.patientName,
      knownAsOf: currentPatient.knownAsOf ?? null });
  }, [setCopilotPatient, accessAvailable, currentPatient?.patientId, currentPatient?.patientName,
    currentPatient?.knownAsOf]);
  useEffect(() => () => setCopilotPatient?.(null), [setCopilotPatient]);
  const storageKey = `saarthi-turns:${params.id}:${sections.sourceScope}`;
  const [turns, setTurns] = useStoredTurns(storageKey);
  useEffect(() => {
    if (!accessAvailable) setTurns([]);
  }, [accessAvailable, params.id, setTurns]);
  const chat = usePatientChat(storageKey, patient.patientId, setTurns);
  const reviewTask = usePatientReviewTask(patient.patientId);
  const selection = usePatientEvidenceSelection(currentPatient, turns, selectionAskOpen,
    setSelectionAskOpen);
  useLivePatientPage({ register: copilot?.live.registerPage, available: accessAvailable,
    patient: currentPatient?.patientId === patient.patientId ? currentPatient : null,
    section: sections.section, setSection: sections.setSection, chat, turns,
    selectGate: selection.selectGate });
  if (!accessAvailable) return <PatientAccessUnavailable />;
  if (!currentPatient || currentPatient.patientId !== patient.patientId) return <PatientLoading />;
  return <PatientWorkspaceScreen model={{
    patient: currentPatient, patients, preview, refreshState, refreshReadiness,
    section: sections.section, setSection: sections.setSection,
    language: sections.language, setLanguage: sections.setLanguage,
    selected: selection.selected, selectedGate: selection.selectedGate,
    contextOpen: selection.contextOpen, contextRef: selection.contextRef,
    askOpen, sourceScope: sections.sourceScope,
    setSourceScope: sections.setSourceScope, turns, chat, review: reviewTask,
    toggleAsk: copilot ? copilot.toggle : selection.toggleAsk, closeEvidence: selection.closeEvidence,
    onSelectGate: selection.selectGate, onSelectAnswer: selection.selectAnswer,
  }} />;
}

/** What the live copilot may do on this page: switch sections, ask through the same governed
 * chat path as the composer, read back the answer it caused, and open a check's evidence. */
function useLivePatientPage({ register, available, patient, section, setSection, chat, turns,
  selectGate }: {
  register?: (page: LivePatientPage | null) => void;
  available: boolean;
  patient: PatientData | null;
  section: string;
  setSection: (section: PatientSection) => void;
  chat: ReturnType<typeof usePatientChat>;
  turns: Turn[];
  selectGate: (ruleId: string) => void;
}): void {
  const latest = useRef({ chat, turns, setSection, selectGate });
  latest.current = { chat, turns, setSection, selectGate };
  const patientId = patient?.patientId;
  const patientName = patient?.patientName;
  useEffect(() => {
    if (!register || !available || !patientId || !patientName) return;
    register({
      kind: "patient", patientId, patientName, section,
      setSection: (next) => latest.current.setSection(next as PatientSection),
      ask: (question, context) => latest.current.chat.send(question, "patient", false, context),
      stop: () => latest.current.chat.stop(),
      turnCount: () => latest.current.turns.length,
      latestAnswer: () => {
        const last = latest.current.turns.at(-1);
        return last?.role === "assistant" ? last : null;
      },
      selectGate: (ruleId) => latest.current.selectGate(ruleId),
      setDraft: (text) => latest.current.chat.setQuestion(text),
    });
    return () => register(null);
  }, [register, available, patientId, patientName, section]);
}
