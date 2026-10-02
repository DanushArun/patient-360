"use client";

import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import type { RosterPatient } from "@/components/patient-roster";
import type { PatientData } from "@/lib/patient";
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
  const storageKey = `saarthi-turns:${params.id}:${sections.sourceScope}`;
  const [turns, setTurns] = useStoredTurns(storageKey);
  useEffect(() => {
    if (!accessAvailable) setTurns([]);
  }, [accessAvailable, params.id, setTurns]);
  const chat = usePatientChat(storageKey, patient.patientId, setTurns);
  const reviewTask = usePatientReviewTask(patient.patientId);
  const selection = usePatientEvidenceSelection(currentPatient, turns, sections.askOpen,
    sections.setAskOpen);
  if (!accessAvailable) return <PatientAccessUnavailable />;
  if (!currentPatient || currentPatient.patientId !== patient.patientId) return <PatientLoading />;
  return <PatientWorkspaceScreen model={{
    patient: currentPatient, patients, preview, refreshState, refreshReadiness,
    section: sections.section, setSection: sections.setSection,
    language: sections.language, setLanguage: sections.setLanguage,
    selected: selection.selected, selectedGate: selection.selectedGate,
    contextOpen: selection.contextOpen, contextRef: selection.contextRef,
    askOpen: sections.askOpen, sourceScope: sections.sourceScope,
    setSourceScope: sections.setSourceScope, turns, chat, review: reviewTask,
    toggleAsk: selection.toggleAsk, closeEvidence: selection.closeEvidence,
    onSelectGate: selection.selectGate, onSelectAnswer: selection.selectAnswer,
  }} />;
}
