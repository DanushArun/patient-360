import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ClipboardList, LayoutDashboard, PanelLeft, Users } from "lucide-react";
import { PatientRoster, type RosterPatient } from "./patient-roster";

export const INK = "#1A1D21";
export const INK_SECONDARY = "#4A5157";
export const INK_MUTED = "#656C73";
export const INK_PASS = "#1E6B3A";
export const INK_FAIL = "#A8261C";
export const INK_CONFLICT = "#8A5300";
export const RULE = "#D8DCDF";
export const SURFACE_SUNKEN = "#F6F7F8";

const STATUS = {
  pass: { glyph: "✓", word: "Pass", ink: INK_PASS,
    border: "1px solid transparent", weight: 500, background: "#E7F3EC" },
  fail: { glyph: "✕", word: "Fail", ink: INK_FAIL,
    border: "1px solid transparent", weight: 600, background: "#FDE8E7" },
  not_evaluated: {
    glyph: "–", word: "Not evaluated", ink: INK_MUTED,
    border: "1px solid transparent", weight: 400, background: "#F2F2F1",
  },
  conflicting: {
    glyph: "⇄", word: "Conflicting", ink: INK_CONFLICT,
    border: "1px solid transparent", weight: 500, background: "#FFF0D5",
  },
} as const;
export type Outcome = keyof typeof STATUS;

export type CensusStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";
const CENSUS_LABEL: Record<CensusStatus, string> = {
  blocked: "Blocked", conflict: "Conflict", waiting: "Waiting on evidence",
  advisory: "Ready · advisory", ready: "Ready",
};
const CENSUS_OUTCOME: Record<CensusStatus, Outcome> = {
  blocked: "fail", conflict: "conflicting", waiting: "not_evaluated",
  advisory: "pass", ready: "pass",
};

function Chip({ outcome, word }: { outcome: Outcome; word?: string }): ReactNode {
  const s = STATUS[outcome];
  return (
    <span className="sa-status" style={{ color: s.ink, border: s.border, fontWeight: s.weight,
      background: s.background }}>
      <span className="sa-status-glyph" aria-hidden="true">{s.glyph}</span>
      <span>{word ?? s.word}</span>
    </span>
  );
}

export const StatusChip = ({ outcome }: { outcome: Outcome }): ReactNode => (
  <Chip outcome={outcome} />
);
export const CensusChip = ({ status }: { status: CensusStatus }): ReactNode => (
  <Chip outcome={CENSUS_OUTCOME[status]} word={CENSUS_LABEL[status]} />
);

export const buttonStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minHeight: 44, padding: "8px 12px", fontSize: 14, lineHeight: "20px",
  fontWeight: 500, color: INK, background: "#FFFFFF",
  border: "1px solid #E8E7E4", borderRadius: 4, width: "100%",
};

export function SaButton({ href, children, weight = 500 }: {
  href: string; children: ReactNode; weight?: number;
}): ReactNode {
  return (
    <Link href={href} className="sa-btn" style={{ ...buttonStyle, fontWeight: weight }}>
      {children}
    </Link>
  );
}

type WorkspaceNavProps = {
  current?: 'census' | 'queue' | 'history' | 'navigator';
  patients?: RosterPatient[];
  patientsAvailable?: boolean;
  patientId?: string;
  practitioner?: string;
  preview?: boolean;
  onAsk?: () => void;
  onReferences?: () => void;
};

export function WorkspaceNav({
  current, patients, patientsAvailable = true, patientId, practitioner,
  preview = false, onAsk, onReferences,
}: WorkspaceNavProps = {}): ReactNode {
  return <nav className="sa-workspace-nav" aria-label="SAARTHI workspace">
    <WorkspaceBrand />
    <div className="sa-sidebar-heading">Workspace</div>
    <WorkspaceLinks current={current} />
    <Link href="/#patient-roster" className="sa-workspace-link">
      <Users size={16} strokeWidth={1.8} aria-hidden="true" />Patients
    </Link>
    {onReferences && <button type="button" className="sa-workspace-link"
      onClick={onReferences}>References</button>}
    {patients && <PatientRoster patients={patients} selectedId={patientId} preview={preview}
      available={patientsAvailable} />}
    {patientId && !preview && <WorkspaceAsk patientId={patientId} onAsk={onAsk} />}
    <span className="sa-workspace-context">
      <PanelLeft size={15} aria-hidden="true" />{practitioner ?? "Practitioner"}
    </span>
  </nav>;
}

function WorkspaceBrand(): ReactNode {
  return <Link href="/" className="sa-brand" aria-label="SAARTHI home">
    <img src="/carethread-mark.svg" width="32" height="32" alt="" />
    <span><strong>SAARTHI</strong><small>Care workspace</small></span>
  </Link>;
}

function WorkspaceLinks({ current }: Pick<WorkspaceNavProps, "current">): ReactNode {
  const items = [
    { href: "/", label: "Day care", key: "census", icon: LayoutDashboard },
    { href: "/review-queue", label: "Review queue", key: "queue", icon: ClipboardList },
  ];
  return <div className="sa-workspace-links">{items.map((item) => {
    const Icon = item.icon;
    const selected = current === item.key;
    const className = `sa-workspace-link${selected ? " sa-workspace-link-active" : ""}`;
    return <Link key={item.key} href={item.href} prefetch={false}
      aria-current={selected ? "page" : undefined} className={className}>
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" />{item.label}
    </Link>;
  })}</div>;
}

function WorkspaceAsk({ patientId, onAsk }: {
  patientId: string; onAsk?: () => void;
}): ReactNode {
  const className = "sa-workspace-link sa-ask-link";
  if (onAsk) return <button type="button" className={className} onClick={onAsk}>
    Ask the record
  </button>;
  return <Link href={`/patient/${encodeURIComponent(patientId)}#ask-record`}
    className={className}>Ask the record</Link>;
}

export function WorkspaceBar({ section, knownAsOf, actions }: {
  section: string; knownAsOf: ReactNode; actions?: ReactNode;
}): ReactNode {
  return <div className="sa-utility-bar">
    <div><Link href="/">Care workspace</Link><span aria-hidden="true">/</span>
      <strong>{section}</strong></div>
    <div className="sa-utility-actions">
      <span className="sa-utility-asof">{knownAsOf}</span>{actions}
    </div>
  </div>;
}

export function Field({ label, value, style }: {
  label: string; value: string; style?: CSSProperties;
}): ReactNode {
  return (
    <div className="sa-field" style={style}>
      <span className="sa-field-label">{label}</span>
      <span className="sa-field-value">{value}</span>
    </div>
  );
}

// Streamlit's material "expand_more" chevron on the popover button.
export const Chevron = (): ReactNode => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ marginLeft: 4 }}>
    <path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" fill="currentColor" />
  </svg>
);

// The block container: design.py sets max-width 1180px; Streamlit pads it
// 5rem 5rem 10rem at the 17px root (85px 85px 170px, measured).
export function Page({ children }: { children: ReactNode }): ReactNode {
  return (
    <main className="sa-page">
      {children}
    </main>
  );
}

// Streamlit stacks every element in a vertical flex with a 1rem (17px) gap.
export const Stack = ({ children, style }: {
  children: ReactNode; style?: CSSProperties;
}): ReactNode => (
  <div style={{ display: "flex", flexDirection: "column", gap: 17, ...style }}>{children}</div>
);

// st.columns(..., gap="large") = 4rem between columns.
export const Columns = ({ template, gap = 68, children, align, className }: {
  template: string; gap?: number; children: ReactNode; align?: CSSProperties["alignItems"];
  className?: string;
}): ReactNode => (
  <div className={className}
    style={{ display: "grid", gridTemplateColumns: template, gap, alignItems: align ?? "start" }}>
    {children}</div>
);

export const Rule = (): ReactNode => <hr
  style={{ border: "none", borderTop: `1px solid ${RULE}`, margin: "16px 0" }} />;
