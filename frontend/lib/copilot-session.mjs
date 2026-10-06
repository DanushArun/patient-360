/** A route-independent, in-memory worklist conversation for the shared supervisor panel. */
export function createCohortSession({ request = requestCohort, createId = () => crypto.randomUUID() } = {}) {
  let snapshot = { turns: [], busy: false, question: "" };
  let controller = null;
  const listeners = new Set();
  const publish = (next) => {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setQuestion(question) { publish({ question }); },
    async send(text) {
      const question = text.trim();
      if (!question || snapshot.busy) return;
      publish({ question: "", busy: true, turns: [...snapshot.turns,
        { id: createId(), role: "user", text: question }] });
      controller = new AbortController();
      try {
        const result = await request(question, controller.signal);
        publish({ turns: [...snapshot.turns, { id: createId(), role: "assistant",
          title: null, rows: [], basis: null, known_as_of: null, ...result,
          error: result.error ?? null }] });
      } catch (error) {
        publish({ turns: [...snapshot.turns, { id: createId(), role: "assistant",
          title: null, rows: [], basis: null, known_as_of: null,
          error: error?.name === "AbortError" ? "cancelled" : "record_service_unavailable" }] });
      } finally {
        controller = null;
        publish({ busy: false });
      }
    },
    stop() { controller?.abort(); },
  };
}

async function requestCohort(question, signal) {
  const response = await fetch("/api/copilot/cohort", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]) });
  const result = await response.json();
  if (!response.ok && !result.error) throw new Error("record_service_unavailable");
  return result;
}
