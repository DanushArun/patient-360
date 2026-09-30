"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chevron } from "@/components/sa";

type PatientOption = { id: string; name: string };

export function PatientPicker({ patients }: { patients: PatientOption[] }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="patient-picker-options"
        onClick={() => setOpen((currentlyOpen) => !currentlyOpen)}
        className="sa-picker-trigger flex cursor-pointer items-center justify-center gap-1 rounded px-4 py-2 text-sm"
        style={{ border: "1px solid var(--sa-rule)", color: "var(--sa-ink)" }}
      >
        Select patient <Chevron />
      </button>
      {open && (
        <div
          id="patient-picker-options"
          className="absolute right-0 z-20 mt-2 max-h-80 min-w-64 overflow-y-auto rounded bg-white py-1"
          style={{ border: "1px solid var(--sa-rule)", boxShadow: "0 4px 16px rgb(26 29 33 / 8%)" }}
        >
          {patients.length ? patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/patient/${patient.id}`}
              prefetch={false}
              onClick={() => setOpen(false)}
              className="sa-picker-item block px-4 py-2"
            >
              <span className="block">{patient.name}</span>
              <span className="sa-meta">{patient.id}</span>
            </Link>
          )) : <span className="block px-4 py-3 text-sm sa-meta">No accessible patients are listed.</span>}
        </div>
      )}
    </div>
  );
}
