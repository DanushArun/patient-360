import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

let ui: typeof import("@testing-library/react");
let userEvent: typeof import("@testing-library/user-event").default;
let React: typeof import("react");
let PatientClient: typeof import("../app/patient/[id]/patient-client").default;
let CensusErrorNotice: typeof import("../components/census-error").CensusErrorNotice;
let dom: JSDOM;
function h(...args: unknown[]): import("react").ReactElement {
  return (React.createElement as unknown as (...values: unknown[]) => import("react").ReactElement)(...args);
}

async function setup(): Promise<void> {
  if (ui) return;
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    self: dom.window,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.assign(dom.window, {
    requestIdleCallback: (callback: IdleRequestCallback) => setTimeout(() => callback({
      didTimeout: false, timeRemaining: () => 0,
    } as IdleDeadline), 0),
    cancelIdleCallback: (id: number) => clearTimeout(id),
  });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  ui = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).default;
  React = await import("react");
  PatientClient = (await import("../app/patient/[id]/patient-client")).default;
  CensusErrorNotice = (await import("../components/census-error")).CensusErrorNotice;
}

type GateFixture = {
  gate: string;
  outcome: "pass" | "fail" | "not_evaluated" | "conflicting";
  rule_id: string;
  rule_version: number;
  reason: string;
  evidence_ids: string[];
};

const gate = (id: string, outcome: GateFixture["outcome"]): GateFixture => ({
  gate: id, outcome, rule_id: id, rule_version: 1, reason: `Synthetic ${outcome} evidence`, evidence_ids: [`SYNTH-${id}`],
});

function patient(patientId: string, gates = [gate("CBC", "not_evaluated"), gate("Authorization", "conflicting")]) {
  return {
    patientId, patientName: `Synthetic ${patientId}`, consentId: "SYNTH-CONSENT",
    practitionerName: "Dr. Synthetic Practitioner", language: "English", nextVisit: null,
    scheduledAt: null, cycleNumber: null, regimen: null, knownAsOf: "2026-09-25T10:00:00Z", gates,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function stubFetch(): void {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("/api/patient/")) return jsonResponse(patient(decodeURIComponent(url.split("/")[3])));
    if (url === "/api/ask") return jsonResponse({
      text: "Synthetic record answer", thinking: "", tools: [], suggested: [], gates: [],
      known_as_of: "2026-09-25T10:00:00Z", error: null,
    });
    if (url === "/api/review-task") return jsonResponse({ task_id: "SYNTH-TASK-1" });
    if (url.includes("review-tasks")) return jsonResponse({ tasks: [] });
    throw new Error(`Unexpected test request: ${url} ${init?.method ?? "GET"}`);
  };
}

test("keyboard activation expands readiness evidence and files a review action", async () => {
  await setup();
  stubFetch();
  const user = userEvent.setup();
  const view = ui.render(h(PatientClient, { patient: patient("SYNTH-01", [gate("CBC", "fail")]) }));
  try {
    const readiness = await ui.screen.findByRole("button", { name: "CBC, fail. Show check details" });
    readiness.focus();
    await user.keyboard("{Enter}");
    assert.equal(readiness.getAttribute("aria-expanded"), "true");
    assert.match((await ui.screen.findByLabelText("Evidence for CBC")).textContent ?? "", /SYNTH-CBC/);

    const request = ui.screen.getByRole("button", { name: "Request document" });
    request.focus();
    await user.keyboard("{Enter}");
    assert.match((await ui.screen.findByText("Task filed")).textContent ?? "", /Task filed/);
  } finally {
    view.unmount();
    ui.cleanup();
  }
});

test("chat submits from the keyboard and clears when the keyed patient changes", async () => {
  await setup();
  stubFetch();
  const user = userEvent.setup();
  function SwitchHarness() {
    const [id, setId] = React.useState("SYNTH-01");
    return h(React.Fragment, null,
      h("button", { type: "button", onClick: () => setId("SYNTH-02") }, "Switch synthetic patient"),
      h(PatientClient, { key: id, patient: patient(id, []) }),
    );
  }
  const view = ui.render(h(SwitchHarness));
  try {
    const input = await ui.screen.findByRole("textbox", { name: "Ask about this patient's record" });
    input.focus();
    await user.type(input, "what is missing?");
    await user.keyboard("{Enter}");
    await ui.screen.findByText("Synthetic record answer");
    assert.ok(ui.screen.getByText("what is missing?"));

    await user.click(ui.screen.getByRole("button", { name: "Switch synthetic patient" }));
    await ui.waitFor(() => assert.equal(ui.screen.queryByText("what is missing?"), null));
    assert.ok(ui.screen.getByRole("textbox", { name: "Ask about this patient's record" }));
  } finally {
    view.unmount();
    ui.cleanup();
  }
});

test("rendered readiness keeps missing evidence distinct from conflicting evidence", async () => {
  await setup();
  stubFetch();
  const view = ui.render(h(PatientClient, { patient: patient("SYNTH-03") }));
  try {
    await ui.screen.findByRole("button", { name: "CBC, not_evaluated. Show check details" });
    const statuses = [...dom.window.document.querySelectorAll(".sa-status")].map((item) => item.textContent?.trim());
    assert.ok(statuses.includes("–Not evaluated"));
    assert.ok(statuses.includes("⇄Conflicting"));
    assert.notEqual(
      dom.window.document.querySelector(".sa-status")?.getAttribute("style"),
      dom.window.document.querySelectorAll(".sa-status")[1]?.getAttribute("style"),
    );
  } finally {
    view.unmount();
    ui.cleanup();
  }
});

test("census errors render a generic announcement without leaking diagnostics", async () => {
  await setup();
  const view = ui.render(h(CensusErrorNotice));
  try {
    const error = ui.screen.getByRole("alert");
    assert.equal(error.textContent, "The patient list is unavailable. Try again later.");
    assert.doesNotMatch(error.textContent ?? "", /Snowflake|SQL|Error|password/i);
  } finally {
    view.unmount();
    ui.cleanup();
  }
});
