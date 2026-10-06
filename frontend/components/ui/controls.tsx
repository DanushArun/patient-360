"use client";

import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import styles from "./controls.module.css";

// Standard controls (docs/design/INTERFACE-GUIDELINES.md §5). One height, one text
// style; style, never size, marks the preferred choice.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "bordered" | "plain" | "prominent";
  size?: "regular" | "small";
};

export function Button({ variant = "bordered", size = "regular", className, type = "button",
  ...props }: ButtonProps): ReactNode {
  return <button type={type} data-style={variant} data-size={size}
    className={[styles.button, className].filter(Boolean).join(" ")} {...props} />;
}

export type Option = { value: string; label: string };

/** A flat list of mutually exclusive choices that shows the current value. */
export function PopUpButton({ label, value, options, onChange, disabled, id }: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}): ReactNode {
  const generated = useId();
  const controlId = id ?? generated;
  return <span className={styles.popUpField}>
    <label htmlFor={controlId}>{label}</label>
    <select id={controlId} className={styles.popUp} value={value} disabled={disabled}
      onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>
        {option.label}</option>)}
    </select>
  </span>;
}

/** Closely related, mutually exclusive choices for one view. Equal-width segments. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}): ReactNode {
  return <div role="group" aria-label={label} className={styles.segmented}>
    {options.map((option) => <button key={option.value} type="button"
      className={styles.segment} aria-pressed={option.value === value}
      onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function SearchField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}): ReactNode {
  return <span className={styles.search}>
    <Search size={14} aria-hidden />
    <input type="search" aria-label={label} value={value} placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)} />
    {value && <button type="button" className={styles.clear} aria-label="Clear search"
      onClick={() => onChange("")}><X size={12} aria-hidden /></button>}
  </span>;
}

/** Leading controls, then a trailing group pushed to the end. */
export function Toolbar({ label, children, trailing }: {
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
}): ReactNode {
  return <div role="group" aria-label={label} className={styles.toolbar}>
    <div className={styles.toolbarGroup}>{children}</div>
    {trailing && <div className={`${styles.toolbarGroup} ${styles.toolbarTrailing}`}>{trailing}
    </div>}
  </div>;
}
