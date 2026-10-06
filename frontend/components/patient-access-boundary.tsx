"use client";

import { useEffect, useState } from "react";
import { PATIENT_ACCESS_EVENT } from "@/lib/workspace-state.mjs";

type AccessEvent = CustomEvent<{ patientId?: string }>;

export function usePatientAccess(patientId: string): boolean {
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    setAvailable(true);
    const handleWithdrawal = (event: Event) => {
      if ((event as AccessEvent).detail?.patientId === patientId) setAvailable(false);
    };
    window.addEventListener(PATIENT_ACCESS_EVENT, handleWithdrawal);
    return () => window.removeEventListener(PATIENT_ACCESS_EVENT, handleWithdrawal);
  }, [patientId]);
  return available;
}
