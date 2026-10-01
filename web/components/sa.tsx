// Markup mirrors frontend/core/answer_render.py and frontend/core/design.py
// one-for-one: same class names (styled by the generated saarthi.css), same
// inline status styles. Values below were measured from the running Streamlit
// app, not chosen.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ClipboardList, LayoutDashboard, ShieldCheck, PanelLeft } from "lucide-react";
import { PatientRoster, type RosterPatient } from "./patient-roster";

export const INK = "#1A1D21";
export const INK_SECONDARY = "#4A5157";
export const INK_MUTED = "#656C73";
export const INK_PASS = "#1E6B3A";
export const INK_FAIL = "#A8261C";
export const INK_CONFLICT = "#8A5300";
export const RULE = "#D8DCDF";
export const SURFACE_SUNKEN = "#F6F7F8";

// design.py STATUS dict, verbatim.
const STATUS = {
  pass: { glyph: "✓", word: "Pass", ink: INK_PASS, border: `1px solid ${INK_PASS}`, weight: 500 },
  fail: { glyph: "✕", word: "Fail", ink: INK_FAIL, border: `2px solid ${INK_FAIL}`, weight: 600 },
  not_evaluated: { glyph: "–", word: "Not evaluated", ink: INK_MUTED, border: `1px dashed ${INK_MUTED}`, weight: 400 },
  conflicting: { glyph: "⇄", word: "Conflicting", ink: INK_CONFLICT, border: `3px double ${INK_CONFLICT}`, weight: 500 },
} as const;
export type Outcome = keyof typeof STATUS;

// census.py STATUS_LABEL / STATUS_OUTCOME, verbatim.
export type CensusStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";
const CENSUS_LABEL: Record<CensusStatus, string> = {
  blocked: "Blocked", conflict: "Conflict", waiting: "Waiting on evidence",
  advisory: "Ready · advisory", ready: "Ready",
};
const CENSUS_OUTCOME: Record<CensusStatus, Outcome> = {
  blocked: "fail", conflict: "conflicting", waiting: "not_evaluated", advisory: "pass", ready: "pass",
};

function Chip({ outcome, word }: { outcome: Outcome; word?: string }) {
  const s = STATUS[outcome];
  return (
    <span className="sa-status" style={{ color: s.ink, border: s.border, fontWeight: s.weight }}>
      <span className="sa-status-glyph" aria-hidden="true">{s.glyph}</span>
      {word ?? s.word}
    </span>
  );
}

export const StatusChip = ({ outcome }: { outcome: Outcome }) => <Chip outcome={outcome} />;
export const CensusChip = ({ status }: { status: CensusStatus }) => (
  <Chip outcome={CENSUS_OUTCOME[status]} word={CENSUS_LABEL[status]} />
);

// Streamlit's st.button as restyled by design.py (.stButton>button), measured:
// 17px/27.2px, weight 500, padding 4.25px 12.75px, min-height 43px, 1px RULE, radius 6px.
export const buttonStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minHeight: 43, padding: "4.25px 12.75px", fontSize: 17, lineHeight: "27.2px",
  fontWeight: 500, color: INK, background: "#FFFFFF",
  border: `1px solid ${RULE}`, borderRadius: 6, width: "100%",
};

export function SaButton({ href, children, weight = 500 }: { href: string; children: ReactNode; weight?: number }) {
  return (
    <Link href={href} className="sa-btn" style={{ ...buttonStyle, fontWeight: weight }}>
      {children}
    </Link>
  );
}

/**
 * The global navigation is deliberately small.  SAARTHI is a work surface,
 * not a destination dashboard: the four links correspond to the documented
 * coordinator/navigator workflows and no evaluator-only area is exposed.
 */
export function WorkspaceNav({ current, patients, patientId, practitioner, preview = false }: { current?: "census" | "queue" | "history" | "navigator"; patients?: RosterPatient[]; patientId?: string; practitioner?: string; preview?: boolean } = {}) {
  const items: { href: string; label: string; key: NonNullable<typeof current>; icon: typeof LayoutDashboard }[] = [
    { href: "/", label: "Day-care list", key: "census", icon: LayoutDashboard },
    { href: "/review-queue", label: "Review queue", key: "queue", icon: ClipboardList },
  ];
  return <nav className="sa-workspace-nav" aria-label="SAARTHI workspace">
    <Link href="/" className="sa-brand" aria-label="SAARTHI home"><img src="/carethread-mark.svg" width="37" height="37" alt="" /><span><strong>SAARTHI</strong><small>Care readiness</small></span></Link>
    <div className="sa-sidebar-heading">Care intelligence workspace</div>
    <div className="ct-workspace"><ShieldCheck size={21} strokeWidth={1.5} aria-hidden="true" /><div>Care readiness<small>Patient 360</small></div></div>
    <div className="sa-workspace-links">{items.map((item) => {
      const Icon = item.icon;
      return <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined} className={`sa-workspace-link${current === item.key ? " sa-workspace-link-active" : ""}`}>
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />{item.label}
      </Link>;
    })}</div>
    {patients && <PatientRoster patients={patients} selectedId={patientId} preview={preview} />}
    <div className="sa-sidebar-evidence"><ShieldCheck size={22} strokeWidth={1.5} aria-hidden="true" /><strong>Built around evidence.</strong><p>Every record has a source.<br />Every unknown stays visible.</p></div>
    <span className="sa-workspace-context"><PanelLeft size={15} aria-hidden="true" />{practitioner ?? "Clinical operations"}</span>
  </nav>;
}

export function Field({ label, value, style }: { label: string; value: string; style?: CSSProperties }) {
  return (
    <div className="sa-field" style={style}>
      <span className="sa-field-label">{label}</span>
      <span className="sa-field-value">{value}</span>
    </div>
  );
}

// Streamlit's material "expand_more" chevron on the popover button.
export const Chevron = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ marginLeft: 4 }}>
    <path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" fill="currentColor" />
  </svg>
);

// The block container: design.py sets max-width 1180px; Streamlit pads it
// 5rem 5rem 10rem at the 17px root (85px 85px 170px, measured).
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="sa-page">
      {children}
    </main>
  );
}

// Streamlit stacks every element in a vertical flex with a 1rem (17px) gap.
export const Stack = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 17, ...style }}>{children}</div>
);

// st.columns(..., gap="large") = 4rem between columns.
export const Columns = ({ template, gap = 68, children, align, className }: {
  template: string; gap?: number; children: ReactNode; align?: CSSProperties["alignItems"];
  className?: string;
}) => (
  <div className={className}
    style={{ display: "grid", gridTemplateColumns: template, gap, alignItems: align ?? "start" }}>{children}</div>
);

export const Rule = () => <hr style={{ border: "none", borderTop: `1px solid ${RULE}`, margin: "16px 0" }} />;
