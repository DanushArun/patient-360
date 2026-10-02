"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PatientData } from "@/lib/patient";
import { usePatientAccess } from "@/components/patient-access-boundary";
import {
  announcePatientAccessWithdrawn,
  isLatestPatientResponse,
  PATIENT_ACCESS_EVENT,
  purgesPatientState,
} from "@/lib/workspace-state.mjs";

type RefreshState = "refreshing" | "current" | "failed";
type PatientResult = PatientData & { error?: string; purge_patient_state?: boolean };

export function usePatientRecord(patient: PatientData, routeId: string, preview: boolean) {
  const accessAvailable = usePatientAccess(patient.patientId);
  const [currentPatient, setCurrentPatient] = useState<PatientData | null>(patient);
  const [refreshState, setRefreshState] = useState<RefreshState>("refreshing");
  const requestVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const refreshReadiness = useCallback((recompute = false) => refreshRecord({
    patientId: patient.patientId, routeId, recompute, requestVersion, activeRequest,
    setPatient: setCurrentPatient, setRefreshState,
  }), [patient.patientId, routeId]);

  useEffect(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    requestVersion.current += 1;
    setCurrentPatient(patient);
    setRefreshState("refreshing");
  }, [patient.patientId]);
  useEffect(() => () => {
    requestVersion.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);
  useRecordWithdrawal({ patientId: patient.patientId, routeId, accessAvailable,
    requestVersion, activeRequest, setCurrentPatient });
  useEffect(() => { if (!preview) void refreshReadiness(); }, [preview, refreshReadiness]);
  return { accessAvailable, currentPatient, refreshState, refreshReadiness };
}

type WithdrawalContext = {
  patientId: string; routeId: string; accessAvailable: boolean;
  requestVersion: React.MutableRefObject<number>;
  activeRequest: React.MutableRefObject<AbortController | null>;
  setCurrentPatient: (patient: PatientData | null) => void;
};

function useRecordWithdrawal(context: WithdrawalContext): void {
  const { patientId, routeId, accessAvailable, requestVersion, activeRequest,
    setCurrentPatient } = context;
  useEffect(() => {
    const revoke = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>).detail;
      if (detail?.patientId !== patientId) return;
      requestVersion.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
      setCurrentPatient(null);
    };
    window.addEventListener(PATIENT_ACCESS_EVENT, revoke);
    return () => window.removeEventListener(PATIENT_ACCESS_EVENT, revoke);
  }, [patientId]);
  useEffect(() => {
    if (accessAvailable) return;
    requestVersion.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setCurrentPatient(null);
    clearPatientStorage(routeId);
  }, [accessAvailable, routeId]);
}

type RefreshContext = {
  patientId: string;
  routeId: string;
  recompute: boolean;
  requestVersion: React.MutableRefObject<number>;
  activeRequest: React.MutableRefObject<AbortController | null>;
  setPatient: (patient: PatientData | null) => void;
  setRefreshState: (state: RefreshState) => void;
};

async function refreshRecord(context: RefreshContext): Promise<void> {
  context.activeRequest.current?.abort();
  const version = ++context.requestVersion.current;
  const controller = new AbortController();
  context.activeRequest.current = controller;
  context.setRefreshState("refreshing");
  try {
    if (context.recompute) {
      await requestPatient(context.patientId, "POST", controller.signal);
      if (!isCurrentRequest(context, version)) return;
    }
    const result = await requestPatient(context.patientId, "GET", controller.signal);
    if (!isCurrentRequest(context, version)) return;
    context.setPatient(result);
    context.setRefreshState("current");
  } catch (error) {
    if (!isCurrentRequest(context, version)) return;
    if (error instanceof Error && error.message === "patient_access_withdrawn") {
      context.setPatient(null);
      return;
    }
    context.setRefreshState("failed");
  } finally {
    if (context.activeRequest.current === controller) context.activeRequest.current = null;
  }
}

async function requestPatient(
  patientId: string,
  method: "GET" | "POST",
  signal: AbortSignal,
): Promise<PatientData> {
  const response = await fetch(`/api/patient/${encodeURIComponent(patientId)}`, {
    cache: "no-store", method,
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  const result = await response.json() as PatientResult;
  if (purgesPatientState(result)) {
    announcePatientAccessWithdrawn(patientId);
    throw new Error("patient_access_withdrawn");
  }
  if (!response.ok || result.error || result.patientId !== patientId
    || !Array.isArray(result.gates)) throw new Error("readiness_refresh_failed");
  return result;
}

function isCurrentRequest(context: RefreshContext, version: number): boolean {
  return isLatestPatientResponse(context.patientId, context.routeId, version,
    context.requestVersion.current);
}

function clearPatientStorage(routeId: string): void {
  for (const scope of ["patient", "reference", "references"]) {
    try {
      sessionStorage.removeItem(`saarthi-turns:${routeId}:${scope}`);
    } catch (error) {
      console.error("Could not clear stored patient conversation.", error);
    }
  }
}
