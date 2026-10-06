"use client";

import {
  useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject,
} from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { filterAuthorizedPatients } from "@/lib/authorized-patient-search.mjs";
import type { RosterPatient } from "./patient-roster-list";
import styles from "./patient-search.module.css";

type PatientSearchProps = {
  patients: RosterPatient[];
  available?: boolean;
  preview?: boolean;
  className?: string;
};

export function PatientSearch({
  patients,
  available = true,
  preview = false,
  className,
}: PatientSearchProps): ReactNode {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const matches = filterAuthorizedPatients(patients, query, available);
  const selected = matches.find((patient) => patient.id === selectedId) ?? matches[0];
  const ids = useDialogIds();

  useDialogVisibility(dialogRef, open);
  const show = () => {
    setQuery("");
    setSelectedId(patients[0]?.id ?? null);
    setOpen(true);
  };
  const close = () => closePatientDialog(dialogRef, setOpen, setQuery, setSelectedId);
  const openPatient = () => {
    if (selected) router.push(patientHref(selected.id, preview));
  };

  return <>
    <button type="button" className={`${styles.trigger} ${className ?? ""}`.trim()}
      disabled={!available} onClick={show}>Select patient</button>
    <PatientSearchDialog {...ids} dialogRef={dialogRef} query={query}
      matches={matches} selectedId={selected?.id} onQuery={setQuery} onSelect={setSelectedId}
      onClose={close} onOpenPatient={openPatient} onNativeClose={() => setOpen(false)} />
  </>;
}

function PatientSearchDialog({
  dialogRef, titleId, searchId, query, matches, selectedId, onQuery, onSelect, onClose,
  onOpenPatient, onNativeClose,
}: PatientSearchDialogProps): ReactNode {
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onNativeClose}>
    <div className={styles.content}>
      <div className={styles.header}>
        <h2 className={styles.title} id={titleId}>Select an authorized patient</h2>
        <button type="button" className={styles.close} aria-label="Close patient search"
          onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </div>
      <p className={styles.helper}>Search patient name or ID within your care team.</p>
      <label className={styles.search} htmlFor={searchId}>
        <Search size={18} aria-hidden="true" />
        <input id={searchId} className={styles.searchInput}
          aria-label="Search patient name or ID within your care team"
          autoComplete="off" value={query}
          onChange={(event) => onQuery(event.target.value)} />
      </label>
      <PatientSearchResults matches={matches} selectedId={selectedId} onSelect={onSelect} />
    </div>
    <PatientSearchFooter selected={Boolean(selectedId)} onCancel={onClose}
      onOpen={onOpenPatient} />
  </dialog>;
}

function PatientSearchResults({
  matches,
  selectedId,
  onSelect,
}: PatientSearchResultsProps): ReactNode {
  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) =>
    selectAdjacentPatient(event, matches, selectedId, onSelect);
  if (!matches.length) return <p className={styles.empty} role="status">No matching patients.</p>;
  return <div className={styles.results} role="radiogroup" aria-label="Authorized patients"
    onKeyDown={handleKeys}>
    {matches.map((patient) => <button key={patient.id} type="button" role="radio"
      aria-checked={selectedId === patient.id} tabIndex={selectedId === patient.id ? 0 : -1}
      className={`${styles.patient}${selectedId === patient.id
        ? ` ${styles.patientSelected}` : ""}`}
      onFocus={() => onSelect(patient.id)} onClick={() => onSelect(patient.id)}>
      <span className={styles.radio} aria-hidden="true" />
      <span className={styles.identity}><strong className={styles.name}>{patient.name}</strong>
        <span className={styles.id}>{patient.id}</span></span>
    </button>)}
  </div>;
}

function PatientSearchFooter({ selected, onCancel, onOpen }: PatientSearchFooterProps): ReactNode {
  return <footer className={styles.footer}>
    <p className={styles.notice}>Access is checked before opening.</p>
    <div className={styles.actions}>
      <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
      <button type="button" className={styles.open} disabled={!selected}
        onClick={onOpen}>Open patient</button>
    </div>
  </footer>;
}

function useDialogIds(): { titleId: string; searchId: string } {
  const id = useId();
  return { titleId: `${id}-title`, searchId: `${id}-search` };
}

function useDialogVisibility(dialogRef: RefObject<HTMLDialogElement | null>, open: boolean): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [dialogRef, open]);
}

function closePatientDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  setOpen: (open: boolean) => void,
  setQuery: (query: string) => void,
  setSelectedId: (id: string | null) => void,
): void {
  if (dialogRef.current?.open) dialogRef.current.close();
  setOpen(false);
  setQuery("");
  setSelectedId(null);
}

function patientHref(patientId: string, preview: boolean): string {
  const route = preview ? "design-preview" : "patient";
  return `/${route}/${encodeURIComponent(patientId)}`;
}

function selectAdjacentPatient(
  event: KeyboardEvent<HTMLDivElement>,
  matches: RosterPatient[],
  selectedId: string | undefined,
  onSelect: (id: string) => void,
): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  if (!matches.length) return;
  const currentIndex = matches.findIndex((patient) => patient.id === selectedId);
  const step = event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (currentIndex + step + matches.length) % matches.length;
  const nextPatient = matches[nextIndex];
  event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  onSelect(nextPatient.id);
}

type PatientSearchDialogProps = {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titleId: string;
  searchId: string;
  query: string;
  matches: RosterPatient[];
  selectedId?: string;
  onQuery: (query: string) => void;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  onOpenPatient: () => void;
  onNativeClose: () => void;
};

type PatientSearchResultsProps = Pick<
  PatientSearchDialogProps, "matches" | "selectedId" | "onSelect"
>;

type PatientSearchFooterProps = {
  selected: boolean;
  onCancel: () => void;
  onOpen: () => void;
};
