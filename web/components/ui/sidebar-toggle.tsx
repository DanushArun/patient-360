"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";

const KEY = "saarthi-sidebar";
const NARROW = "(min-width: 761px) and (max-width: 880px)";

/** Shows or hides the workspace sidebar (shell.css). Wide windows: the page card slides over
 * the sidebar and the choice is remembered. Narrow windows: the sidebar is hidden by default
 * and opens as an overlay; that temporary state is not remembered. */
export function SidebarToggle(): ReactNode {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(NARROW);
    const sync = () => {
      const state = document.documentElement.dataset.sidebar;
      setCollapsed(media.matches ? state !== "open" : state === "collapsed");
    };
    sync();
    media.addEventListener("change", sync);
    // Overlay mode (narrow windows): Esc or a click outside the sidebar dismisses it.
    const dismiss = () => {
      if (!media.matches || document.documentElement.dataset.sidebar !== "open") return;
      delete document.documentElement.dataset.sidebar;
      setCollapsed(true);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("#saarthi-sidebar, .sa-sidebar-toggle")) return;
      dismiss();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    const frame = requestAnimationFrame(() => {
      document.documentElement.setAttribute("data-shell-ready", "");
    });
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      cancelAnimationFrame(frame);
    };
  }, []);
  const toggle = () => {
    const next = !collapsed;
    const root = document.documentElement;
    setCollapsed(next);
    if (window.matchMedia(NARROW).matches) {
      if (next) delete root.dataset.sidebar;
      else root.dataset.sidebar = "open";
      return;
    }
    if (next) root.dataset.sidebar = "collapsed";
    else delete root.dataset.sidebar;
    try { localStorage.setItem(KEY, next ? "collapsed" : "open"); } catch { /* private mode */ }
  };
  return <button type="button" className="sa-sidebar-toggle" onClick={toggle}
    aria-label={collapsed ? "Show sidebar" : "Hide sidebar"} aria-expanded={!collapsed}
    aria-controls="saarthi-sidebar" title={collapsed ? "Show sidebar" : "Hide sidebar"}>
    <PanelLeft size={16} strokeWidth={1.8} aria-hidden />
  </button>;
}

/** Inline, runs before first paint so a collapsed sidebar never flashes open. */
export const SIDEBAR_BOOT_SCRIPT = `try{if(localStorage.getItem("${KEY}")==="collapsed")`
  + `document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;
