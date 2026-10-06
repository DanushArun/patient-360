"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { useOptionalCopilot } from "@/components/copilot/copilot-provider";
import { SETTINGS_EVENT, VOICE_KEY, voicePreference } from "@/components/copilot/copilot-live-ui";
import styles from "./settings.module.css";

// Preferences are per browser (localStorage). None of them changes what a person may see:
// access, consent and every record check are enforced on the server.

export function SettingsView({ practitioner }: { practitioner: string }): ReactNode {
  const copilot = useOptionalCopilot();
  const [voice, setVoice] = useState(true);
  useEffect(() => { setVoice(voicePreference()); }, []);
  const changeVoice = (next: boolean) => {
    setVoice(next);
    try { localStorage.setItem(VOICE_KEY, next ? "on" : "off"); } catch { /* not stored */ }
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  };
  return <div className={styles.page}>
    <header className={styles.intro}>
      <h1>Settings</h1>
      <p>Preferences for this browser. They never change what you are allowed to see.</p>
    </header>

    <section className={styles.group} aria-labelledby="account-heading">
      <h2 id="account-heading">Account</h2>
      <div className={styles.rows}>
        <div className={styles.row}><span>Signed in as</span><strong>{practitioner}</strong></div>
        <div className={styles.row}><span>Workspace</span><strong>Day care · synthetic data only</strong></div>
        <div className={styles.row}><span>Access</span>
          <strong>Your active care team, with current patient consent</strong></div>
      </div>
    </section>

    <section className={styles.group} aria-labelledby="copilot-heading">
      <h2 id="copilot-heading">Copilot</h2>
      <div className={styles.rows}>
        <Toggle id="setting-copilot" label="Live copilot"
          detail="Opens records, switches tabs and brings items into the chat when you ask. Off: the chat still answers questions."
          checked={copilot?.live.enabled ?? false} disabled={!copilot}
          onChange={(next) => copilot?.live.setEnabled(next)} />
        <Toggle id="setting-voice" label="Voice input"
          detail="Speak requests to the copilot bar. Off: the bar offers typing instead and the microphone is never used."
          checked={voice} onChange={changeVoice} />
      </div>
    </section>

    <section className={styles.group} aria-labelledby="help-heading">
      <h2 id="help-heading">Help</h2>
      <div className={styles.rows}>
        <Link href="/guide" prefetch={false} className={styles.linkRow}>
          <BookOpen size={16} strokeWidth={1.8} aria-hidden />
          <span><strong>Guide</strong><small>Record states, blocked visits, navigation and the copilot.</small></span>
        </Link>
      </div>
    </section>
  </div>;
}

function Toggle({ id, label, detail, checked, disabled = false, onChange }: {
  id: string; label: string; detail: string; checked: boolean; disabled?: boolean;
  onChange: (next: boolean) => void;
}): ReactNode {
  return <div className={styles.row}>
    <label htmlFor={id} className={styles.label}><strong>{label}</strong><small>{detail}</small></label>
    <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled}
      className={styles.switch} onClick={() => onChange(!checked)}>
      <span className={styles.thumb} aria-hidden />
    </button>
  </div>;
}
