import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Compass, OctagonAlert, Sparkles, Tags } from "lucide-react";
import { CensusChip, StatusChip } from "@/components/sa";
import { GUIDES, type Guide, type GuideBlock, type GuideIcon } from "@/lib/guides";
import styles from "./guide.module.css";

const ICONS: Record<GuideIcon, typeof BookOpen> = {
  states: Tags, blocked: OctagonAlert, navigation: Compass, copilot: Sparkles, glossary: BookOpen,
};

export function GuideDirectory(): ReactNode {
  return <section className={styles.directory} aria-label="Guides">
    <header className={styles.intro}>
      <h1>Guide</h1>
      <p>How Saarthi shows the state of a record, what to do when a visit is blocked, and how to
        work with the copilot. Five short guides, each readable in a couple of minutes.</p>
    </header>
    <ul className={styles.cards}>
      {GUIDES.map((guide) => {
        const Icon = ICONS[guide.icon];
        return <li key={guide.slug}>
          <Link href={`/guide/${guide.slug}`} prefetch={false} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
            <strong>{guide.title}</strong>
            <span>{guide.summary}</span>
          </Link>
        </li>;
      })}
    </ul>
  </section>;
}

export function GuideArticle({ guide }: { guide: Guide }): ReactNode {
  return <div className={styles.layout}>
    <nav className={styles.toc} aria-label="All guides">
      <Link href="/guide" prefetch={false} className={styles.tocHome}>All guides</Link>
      <ul>{GUIDES.map((item) => <li key={item.slug}>
        <Link href={`/guide/${item.slug}`} prefetch={false}
          aria-current={item.slug === guide.slug ? "page" : undefined}>{item.title}</Link>
      </li>)}</ul>
    </nav>
    <article className={styles.article}>
      <header className={styles.intro}>
        <h1>{guide.title}</h1>
        <p>{guide.summary}</p>
      </header>
      {guide.sections.map((section) => <section key={section.heading} className={styles.section}>
        <h2>{section.heading}</h2>
        {section.blocks.map((block, index) => <Block key={index} block={block} />)}
      </section>)}
    </article>
  </div>;
}

function Block({ block }: { block: GuideBlock }): ReactNode {
  switch (block.kind) {
    case "text": return <p className={styles.text}>{block.text}</p>;
    case "states": return <dl className={styles.rows}>{block.rows.map((row) =>
      <div key={row.status} className={styles.row}>
        <dt><CensusChip status={row.status} /></dt>
        <dd><p>{row.meaning}</p><p className={styles.next}><strong>Next:</strong> {row.action}</p></dd>
      </div>)}</dl>;
    case "outcomes": return <dl className={styles.rows}>{block.rows.map((row) =>
      <div key={row.outcome} className={styles.row}>
        <dt><StatusChip outcome={row.outcome} /></dt><dd><p>{row.meaning}</p></dd>
      </div>)}</dl>;
    case "terms": return <dl className={styles.rows}>{block.rows.map((row) =>
      <div key={row.term} className={styles.row}>
        <dt className={styles.term}>{row.term}</dt><dd><p>{row.meaning}</p></dd>
      </div>)}</dl>;
    case "steps": return <ol className={styles.steps}>{block.rows.map((row) =>
      <li key={row}>{row}</li>)}</ol>;
    case "examples": return <dl className={styles.rows}>{block.rows.map((row) =>
      <div key={row.say} className={styles.row}>
        <dt className={styles.say}>“{row.say}”</dt><dd><p>{row.does}</p></dd>
      </div>)}</dl>;
    case "keys": return <dl className={styles.rows}>{block.rows.map((row) =>
      <div key={row.keys} className={styles.row}>
        <dt><kbd className={styles.kbd}>{row.keys}</kbd></dt><dd><p>{row.does}</p></dd>
      </div>)}</dl>;
  }
}
