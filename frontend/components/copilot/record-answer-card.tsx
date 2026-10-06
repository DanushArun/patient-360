import type { ReactNode } from "react";
import { Check, Circle, Minus, X } from "lucide-react";
import { Clock } from "@/components/ui/clock";
import { Button } from "@/components/ui/controls";
import type { RecordAnswer, RecordTone } from "@/lib/copilot-tools.mjs";
import styles from "./copilot.module.css";

// Inline answer card for a record-tool answer (COPILOT-EXPERIENCE §4): a title, one summary
// sentence, the rows that answer it, and at most two actions. Every value on it was read
// from a governed SQL view; the card says so, because no model wrote it.

const TONE_ICON: Record<RecordTone, ReactNode> = {
  positive: <Check size={12} aria-hidden />,
  neutral: <Circle size={10} aria-hidden />,
  warning: <Minus size={12} aria-hidden />,
  critical: <X size={12} aria-hidden />,
};

export function RecordAnswerCard({ record, onShowEvidence, onOpenSection }: {
  record: RecordAnswer;
  onShowEvidence?: (ruleId: string) => void;
  onOpenSection?: (section: string) => void;
}): ReactNode {
  return <section className={styles.recordCard} aria-label={record.title}>
    <header className={styles.recordHeader}>
      <h3>{record.title}</h3>
      {record.known_as_of && <span>Known as of <Clock value={record.known_as_of} /></span>}
    </header>
    <p className={styles.recordSummary}>{record.summary}</p>
    {!!record.items.length && <ul className={styles.recordRows}>
      {record.items.map((item) => <li key={item.id}>
        <div className={styles.recordRowHead}>
          <strong>{item.label}</strong>
          <span className={styles.recordState} data-tone={item.tone}>
            {TONE_ICON[item.tone]}{item.state}
          </span>
        </div>
        <p className={styles.recordValue}>{item.value}</p>
        {(item.note || (item.ruleId && onShowEvidence)) && <p className={styles.recordNote}>
          {item.note}
          {item.ruleId && onShowEvidence && <button type="button"
            onClick={() => onShowEvidence(item.ruleId!)}>Show evidence</button>}
        </p>}
      </li>)}
    </ul>}
    {record.more > 0 && <p className={styles.meta}>{record.more} more not shown.
      {record.actions[0] ? ` ${record.actions[0].label} for the full list.` : ""}</p>}
    {!!record.actions.length && onOpenSection && <div className={styles.recordActions}>
      {record.actions.map((action) => <Button key={action.label} size="small"
        onClick={() => onOpenSection(action.section)}>{action.label}</Button>)}
    </div>}
    <p className={styles.meta}>
      Read from the record by a fixed query; no AI wrote this answer.
      {record.basis ? ` ${record.basis}` : ""}
    </p>
  </section>;
}
