import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const view = loadView();

const issue = {
  key: "PAT-DC-04:VISIT-1:COVERAGE:AUTH-001", patientId: "PAT-DC-04",
  patientName: "Fatima Begum", encounterId: "VISIT-1", scheduled: "2026-10-03T09:00:00",
  daysToVisit: 1, gate: "Coverage", ruleId: "AUTH-001", ruleVersion: 2,
  outcome: "conflicting", severity: "blocker", reason: "Two dates disagree.",
  knownAsOf: "2026-10-02T09:42:00", tasks: [{
    taskId: "TASK-1", issueId: "ISSUE-1", patientId: "PAT-DC-04", ruleId: "AUTH-001",
    encounterId: "VISIT-1", ownerId: "PRACT-1", owner: "Dr Meera Iyer", state: "open",
    action: "request_document", reason: "Please verify the letter.",
    createdAt: "2026-10-02T10:00:00",
  }],
};

const queue = {
  patients: [{ id: "PAT-DC-04", name: "Fatima Begum" }], issues: [issue],
  unavailable: [], otherTasks: [],
};

test("review queue renders separate workflow and rule provenance with patient review link", () => {
  const markup = renderToStaticMarkup(React.createElement(view.ReviewQueueView, {
    queue, loadedAt: "2026-10-02T10:02:00", ownersByPatient: {},
  }));

  assert.match(markup, /Review queue/);
  assert.match(markup, /Day care/);
  assert.match(markup, /Open/);
  assert.match(markup, /Dr Meera Iyer/);
  assert.match(markup, /Task created/);
  assert.match(markup, /Rule outcome/);
  assert.match(markup, /Known as of/);
  assert.match(markup, /Queue loaded/);
  assert.match(markup, /href="\/patient\/PAT-DC-04/);
  assert.match(markup, /10:02:00/);
  assert.match(markup, /09:42:00/);
});

test("review queue does not invent readiness age, consent status, or a ready action", () => {
  const markup = renderToStaticMarkup(React.createElement(view.ReviewQueueView, {
    queue, loadedAt: "2026-10-02T10:02:00", ownersByPatient: {},
  }));

  assert.doesNotMatch(markup, /consent required|overdue|clear ready|ready to proceed/i);
  assert.match(markup, /Two dates disagree\./);
});

test("empty and unavailable data render distinct truthful states", () => {
  const empty = renderToStaticMarkup(React.createElement(view.ReviewQueueView, {
    queue: { patients: [], issues: [], unavailable: [], otherTasks: [] },
    loadedAt: "2026-10-02T10:02:00", ownersByPatient: {},
  }));
  const noIssues = renderToStaticMarkup(React.createElement(view.ReviewQueueView, {
    queue: { patients: queue.patients, issues: [], unavailable: [], otherTasks: [] },
    loadedAt: "2026-10-02T10:02:00", ownersByPatient: {},
  }));

  assert.match(empty, /No authorized patient records/);
  assert.match(noIssues, /No review tasks or readiness gaps/);
});

test("queue exposes task board groups and contextual task detail without changing rule state", () => {
  const markup = renderToStaticMarkup(React.createElement(view.ReviewQueueView, {
    queue, loadedAt: "2026-10-02T10:02:00",
  }));
  assert.match(markup, /Evidence received/);
  assert.match(markup, /Closed/);
  assert.match(markup, /Task details/);
  assert.match(markup, /Conflicting/);
  assert.match(markup, /Active issues/);
});

function loadView() {
  const path = fileURLToPath(new URL("../app/review-queue/review-queue-view.tsx", import.meta.url));
  const source = readFileSync(path, "utf8");
  const compiled = require("typescript").transpileModule(source, { compilerOptions: {
    jsx: require("typescript").JsxEmit.ReactJSX, module: require("typescript").ModuleKind.CommonJS,
    target: require("typescript").ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require: dependency });
  return module.exports;
}

function dependency(name) {
  if (name === "next/link") {
    return { __esModule: true, default: ({ href, children, prefetch, ...props }) =>
      React.createElement("a", { href, ...props }, children) };
  }
  if (name === "@/components/sa") {
    return { Page: ({ children }) => React.createElement("main", null, children),
      WorkspaceNav: () => React.createElement("nav", null,
        React.createElement("a", { href: "/" }, "Day care"), "Review queue") };
  }
  if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, {
    get: (_, key) => String(key),
  }) };
  return require(name);
}
