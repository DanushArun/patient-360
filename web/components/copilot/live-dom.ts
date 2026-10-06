// Screen helpers for the live copilot: finding tagged items, marking them, and the brief cue
// that shows an item moving into the chat. Items are found only through their
// data-copilot-ref tags (COPILOT-EXPERIENCE §6), never by reading values off the screen.

export type MarkKind = "found" | "cited" | "suggested";

const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function frames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) await nextFrame();
}

function aborted(): DOMException {
  return new DOMException("Stopped", "AbortError");
}

/** Resolves when `test` returns a value, polling once per frame; rejects on abort or timeout. */
export function waitFor<T>(test: () => T | null | undefined | false, signal: AbortSignal,
  timeout: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let frame = 0;
    const onAbort = () => { cancelAnimationFrame(frame); reject(aborted()); };
    if (signal.aborted) { reject(aborted()); return; }
    signal.addEventListener("abort", onAbort, { once: true });
    const poll = () => {
      const value = test();
      if (value) {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      } else if (performance.now() - started > timeout) {
        signal.removeEventListener("abort", onAbort);
        reject(new Error(timeoutMessage));
      } else {
        frame = requestAnimationFrame(poll);
      }
    };
    poll();
  });
}

/** Tagged items of one kind in the record area, excluding the copilot's own surfaces. */
export function taggedItems(kind: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-copilot-ref^="${kind}:"]`)]
    .filter((element) => !element.closest("[data-copilot-ignore]")
      && element.getClientRects().length > 0);
}

export function readRef(element: Element): { kind: string; id: string; label: string } | null {
  const [kind, ...rest] = (element.getAttribute("data-copilot-ref") ?? "").split(":");
  const id = rest.join(":");
  if (!kind || !id) return null;
  return { kind, id, label: element.getAttribute("data-copilot-label") ?? id };
}

export function mark(elements: Element[], kind: MarkKind): void {
  for (const element of elements) element.setAttribute("data-copilot-mark", kind);
}

export function clearMarks(kind?: MarkKind): void {
  const selector = kind ? `[data-copilot-mark="${kind}"]` : "[data-copilot-mark]";
  for (const element of document.querySelectorAll(selector)) {
    element.removeAttribute("data-copilot-mark");
  }
}

/** Bring an item into view only when it is not already comfortably visible. */
export function reveal(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const visible = rect.top >= 72 && rect.bottom <= window.innerHeight - 96;
  if (!visible) element.scrollIntoView({ block: "center",
    behavior: reducedMotion() ? "auto" : "smooth" });
}

/**
 * The transfer cue: a small labelled chip travels from the item to the chat composer. It is
 * decorative (aria-hidden); the chat announces the attachment itself. Skipped entirely under
 * reduced motion, where the chip simply appears in the composer.
 */
export async function flyToChat(source: HTMLElement, label: string): Promise<void> {
  const target = document.querySelector<HTMLElement>("[data-copilot-composer]");
  if (!target || reducedMotion()) return;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "copilot-flight";
  ghost.setAttribute("aria-hidden", "true");
  ghost.textContent = label;
  document.body.append(ghost);
  const start = { x: Math.max(8, from.left + 16), y: from.top + from.height / 2 - 12 };
  ghost.style.left = `${start.x}px`;
  ghost.style.top = `${start.y}px`;
  const dx = to.left + 12 - start.x;
  const dy = to.top + 8 - start.y;
  const lift = Math.min(-48, dy / 3);
  try {
    await ghost.animate([
      { transform: "translate(0, 0) scale(0.9)", opacity: 0 },
      { transform: "translate(0, -4px) scale(1)", opacity: 1, offset: 0.12 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 + lift}px) scale(1)`, opacity: 1,
        offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.92)`, opacity: 0.2 },
    ], { duration: 640, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" }).finished;
  } finally {
    ghost.remove();
  }
}
