import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ClipboardList, LayoutDashboard, PanelLeft, Users } from "lucide-react";
import { PatientRoster, type RosterPatient } from "./patient-roster";
import { SidebarToggle } from "./ui/sidebar-toggle";
import { CopilotTrigger } from "./copilot/copilot-trigger";

// Colours resolve from app/tokens.css so inline styles follow light and dark.
export const INK = "var(--label)";
export const INK_SECONDARY = "var(--label-secondary)";
export const INK_MUTED = "var(--label-tertiary)";
export const INK_PASS = "var(--status-ready)";
export const INK_FAIL = "var(--status-blocked)";
export const INK_CONFLICT = "var(--status-conflict)";
export const RULE = "var(--separator)";
export const SURFACE_SUNKEN = "var(--bg-secondary)";

type Tone = "ready" | "blocked" | "conflict" | "waiting" | "advisory" | "neutral";
const tone = (name: Tone) => ({
  ink: `var(--status-${name})`, background: `var(--status-${name}-bg)`,
});

const STATUS = {
  pass: { glyph: "✓", word: "Pass", weight: 500, ...tone("ready") },
  fail: { glyph: "✕", word: "Fail", weight: 600, ...tone("blocked") },
  not_evaluated: { glyph: "○", word: "Not evaluated", weight: 500, ...tone("neutral") },
  conflicting: { glyph: "⇄", word: "Conflicting", weight: 500, ...tone("conflict") },
} as const;
export type Outcome = keyof typeof STATUS;

export type CensusStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";
const CENSUS_LABEL: Record<CensusStatus, string> = {
  blocked: "Blocked", conflict: "Conflict", waiting: "Waiting on evidence",
  advisory: "Ready · advisory", ready: "Ready",
};
const CENSUS_STYLE: Record<CensusStatus, { glyph: string; weight: number; tone: Tone }> = {
  blocked: { glyph: "✕", weight: 600, tone: "blocked" },
  conflict: { glyph: "⇄", weight: 500, tone: "conflict" },
  waiting: { glyph: "−", weight: 500, tone: "waiting" },
  advisory: { glyph: "!", weight: 500, tone: "advisory" },
  ready: { glyph: "✓", weight: 500, tone: "ready" },
};

function Chip({ glyph, word, weight, ink, background }: {
  glyph: string; word: string; weight: number; ink: string; background: string;
}): ReactNode {
  return (
    <span className="sa-status" style={{ color: ink, fontWeight: weight, background }}>
      <span className="sa-status-glyph" aria-hidden="true">{glyph}</span>
      <span>{word}</span>
    </span>
  );
}

export const StatusChip = ({ outcome }: { outcome: Outcome }): ReactNode => (
  <Chip {...STATUS[outcome]} />
);
export const CensusChip = ({ status }: { status: CensusStatus }): ReactNode => {
  const s = CENSUS_STYLE[status];
  return <Chip glyph={s.glyph} word={CENSUS_LABEL[status]} weight={s.weight} {...tone(s.tone)} />;
};

export const buttonStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  height: "var(--control-height)", padding: "0 var(--space-3)", font: "var(--text-callout)",
  fontWeight: 500, color: INK, background: "var(--bg)",
  border: "1px solid var(--separator-strong)", borderRadius: "var(--radius-control)",
  width: "100%",
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
  return <nav id="saarthi-sidebar" className="sa-workspace-nav" aria-label="Saarthi workspace">
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
  return <Link href="/" className="sa-brand" aria-label="Saarthi home">
    <img src="/saarthi-mark.png" width="32" height="32" alt="" />
    <span><strong>Saarthi</strong><small>Care workspace</small></span>
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
    <div><SidebarToggle /><Link href="/">Care workspace</Link><span aria-hidden="true">/</span>
      <strong>{section}</strong></div>
    <div className="sa-utility-actions">
      <span className="sa-utility-asof">{knownAsOf}</span>{actions}<CopilotTrigger />
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
