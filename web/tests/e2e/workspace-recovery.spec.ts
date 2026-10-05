import { expect, test, type Page, type Route } from "@playwright/test";

const patientId = "PAT-DC-04";
const routePath = `/test-workspace/${patientId}`;
const knownAsOf = "2026-09-23T14:14:48";
const taskId = "TASK-SYNTHETIC-1";

const patient = {
  patientId, patientName: "Fatima Begum", consentId: "CONSENT-SYNTHETIC-1",
  treatingPractitionerName: "Dr Example",
  practitionerName: "Dr Example", language: "Tamil", nextVisit: "2026-09-24",
  scheduledAt: "2026-09-24T09:30:00", cycleNumber: 3, regimen: "Synthetic regimen",
  knownAsOf, gates: [{ gate: "Platelet count", rule_id: "CLIN-PLT-001",
    rule_version: 1, outcome: "fail", severity: "blocker",
    reason: "Platelet result needs review.", evidence_ids: ["ASSERT-SYNTHETIC-1"],
    known_as_of: knownAsOf }],
};

type RouteTracker = {
  requests: Array<{ method: string; path: string; view: string | null;
    body: Record<string, unknown> }>;
  assertNoUnexpected: () => void;
};

type RecoveryAttempts = {
  nextFactAttempt: () => number;
  nextCreateAttempt: () => number;
  hasCreatedTask: () => boolean;
  markTaskCreated: () => void;
  hasRecomputed: () => boolean;
  markRecomputed: () => void;
  failRecompute: boolean;
  dropAfterCommit: boolean;
};

async function installRecoveryRoutes(page: Page, failRecompute = false,
  dropAfterCommit = false): Promise<RouteTracker> {
  const unexpected: string[] = [];
  const requests: RouteTracker["requests"] = [];
  let factAttempts = 0;
  let createAttempts = 0;
  let taskCreated = false;
  let recomputeRequested = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
    requests.push({ method: request.method(), path: url.pathname,
      view: url.searchParams.get("view"), body });
    const response = await routeResponse(route, url, {
      nextFactAttempt: () => ++factAttempts,
      nextCreateAttempt: () => ++createAttempts,
      hasCreatedTask: () => taskCreated,
      markTaskCreated: () => { taskCreated = true; },
      hasRecomputed: () => recomputeRequested,
      markRecomputed: () => { recomputeRequested = true; },
      failRecompute,
      dropAfterCommit,
    });
    if (response) return;
    unexpected.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.abort("failed");
  });
  return { requests, assertNoUnexpected: () => expect(unexpected).toEqual([]) };
}

async function routeResponse(route: Route, url: URL,
  attempts: RecoveryAttempts): Promise<true | null> {
  if (await writeResponse(route, url, attempts)) return true;
  const patientPath = `/api/patient/${patientId}`;
  if (url.pathname === patientPath && route.request().method() === "GET") {
    return fulfill(route, attempts.hasRecomputed() ? refreshedPatient : patient);
  }
  if (url.pathname === `${patientPath}/review-tasks`) {
    const tasks = attempts.hasCreatedTask() ? [closedTask] : [];
    return fulfill(route, { tasks, owners: [] });
  }
  if (url.pathname === `${patientPath}/workspace` && url.searchParams.get("view") === "facts") {
    if (attempts.nextFactAttempt() === 1) {
      return fulfill(route, { error: "workspace_read_unavailable" }, 503);
    }
    const domain = url.searchParams.get("domain");
    return fulfill(route, { domain, facts: domain === "labs" ? [] : { name: patient.patientName },
      known_as_of: knownAsOf, requested_known_as_of: knownAsOf,
      as_of_semantics: domain === "labs" ? "ingested_cutoff" : "current_at_query" });
  }
  if (url.pathname === `${patientPath}/workspace` && url.searchParams.get("view") === "documents") {
    return fulfill(route, { rows: [], expected_documents: [],
      known_as_of: url.searchParams.get("known_as_of") });
  }
  if (url.pathname === `${patientPath}/timeline`) return fulfill(route, timelineFixture);
  return null;
}

async function writeResponse(route: Route, url: URL,
  attempts: RecoveryAttempts): Promise<true | null> {
  if (route.request().method() !== "POST") return null;
  if (url.pathname === `/api/patient/${patientId}`) {
    if (attempts.failRecompute) return fulfill(route, { error: "readiness_refresh_unavailable" }, 503);
    attempts.markRecomputed();
    return fulfill(route, postRefreshPatient);
  }
  if (url.pathname === "/api/review-task" && route.request().method() === "POST") {
    if (attempts.nextCreateAttempt() === 1) {
      if (attempts.dropAfterCommit) {
        attempts.markTaskCreated();
        await route.abort('connectionreset');
        return true;
      }
      return fulfill(route, { error: "action_unavailable" }, 503);
    }
    attempts.markTaskCreated();
    return fulfill(route, { task_id: taskId, state: "closed", version: 2,
      idempotent_replay: true, read_back_confirmed: true });
  }
  return null;
}

const refreshedPatient = {
  ...patient, knownAsOf: "2026-10-02T10:00:00", gates: [{ ...patient.gates[0],
    reason: "A newer SQL snapshot confirms this result.", known_as_of: "2026-10-02T10:00:00" }],
};

const postRefreshPatient = {
  ...patient, knownAsOf: "2026-10-02T09:59:00", gates: [{ ...patient.gates[0],
    reason: "POST response must not replace the stored readback." }],
};

async function fulfill(route: Route, body: unknown, status = 200): Promise<true> {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  return true;
}

async function openWorkspace(page: Page, section: string): Promise<RouteTracker> {
  const tracker = await installRecoveryRoutes(page);
  await page.goto(routePath);
  await expect(page.getByRole("heading", { name: patient.patientName })).toBeVisible();
  await page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: section }).click();
  return tracker;
}

const closedTask = {
  taskId, issueId: `${patientId}:CLIN-PLT-001`, owner: "Dr Example", state: "closed",
  action: "request_document", reason: "Request document — CLIN-PLT-001: review",
  createdAt: "2026-09-23T14:20:00", ownerId: "PRACTITIONER-1", issueVersion: 2,
  isEvent: false, actor: "PRACTITIONER-1",
};

const timelineFixture = {
  known_as_of: knownAsOf, provenance_observed_at: "2026-09-23T14:15:00",
  total_events: 21, timeline_limit: 20, truncated: true,
  timeline: [{ concept: "Absolute neutrophil count", value: 1.2, unit: "10^9/L",
    is_derived: true, value_state: "present", derivation: "neutrophils × total WBC",
    abnormal_flag: "low", valid_until: "2026-09-24T00:00:00",
    source_event_ids: ["EVT-WBC", "EVT-NEUT"], source_assertion_ids: ["AST-1"],
    source_document_ids: ["DOC-1"], source_links_observed_at: "2026-09-23T14:15:00",
    event_time: "2026-09-22T09:00:00", source_recorded_at: "2026-09-22T10:00:00",
    ingested_at: "2026-09-22T10:10:00", event_id: "EVT-ANC" },
  { concept: "Final report", value: null, value_text: "Awaiting laboratory sign-off",
    unit: null, is_derived: false, value_state: "pending", event_time: "2026-09-23T12:00:00",
    source_recorded_at: "2026-09-23T12:00:00", ingested_at: "2026-09-23T12:01:00",
    event_id: "EVT-PENDING" }],
};

test("test_task_when_committed_response_drops_recovers_same_request_after_reload",
  async ({ page }) => {
  const tracker = await installRecoveryRoutes(page, false, true);
  await page.goto(routePath);
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Request document" }).click();
  await page.getByRole("button", { name: "Create document request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Task status not confirmed" }))
    .toBeVisible();
  const original = tracker.requests.find(row => row.path === '/api/review-task')?.body.requestId;
  await page.reload();
  await expect(page.getByRole("heading", { name: patient.patientName })).toBeVisible();
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Request document" }).click();
  await page.getByRole("button", { name: "Create document request" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Task already filed" }))
    .toContainText(taskId);
  const submissions = tracker.requests.filter(row => row.path === '/api/review-task');
  expect(submissions.map(row => row.body.requestId)).toEqual([original, original]);
  tracker.assertNoUnexpected();
  const screenshot = process.env.SAARTHI_CHAOS_SCREENSHOT;
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: true });
});

test("test_facts_retry_when_first_read_fails_shows_returned_clock_semantics", async ({ page }) => {
  const tracker = await openWorkspace(page, "Facts");
  const facts = page.getByRole("region", { name: "Patient facts" });
  await expect(facts.getByRole("alert")).toContainText("could not be loaded");
  await facts.getByRole("button", { name: "Retry" }).click();
  await expect(facts).toContainText(`Lab data ingested through ${knownAsOf}.`);
  await facts.getByRole("button", { name: "Demographics" }).click();
  await expect(facts).toContainText(
    `Current facts read at ${knownAsOf}; the requested historical cutoff does not apply.`,
  );
  await expect(facts).toContainText("Fatima Begum");
  tracker.assertNoUnexpected();
  expect(tracker.requests.filter((request) => request.path.endsWith("/workspace")
    && request.view === "facts"))
    .toHaveLength(3);
});

test("test_recompute_when_POST_succeeds_reads_updated_snapshot_and_keeps_section", async ({ page }) => {
  const tracker = await openWorkspace(page, "Facts");
  await page.getByRole("button", { name: "Recompute readiness" }).click();
  await expect(page.locator('time[datetime="2026-10-02T10:00:00"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: "Facts" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: "Overview" }).click();
  await expect(page.getByText("A newer SQL snapshot confirms this result.")).toBeVisible();
  expect(tracker.requests.filter((request) => request.path === `/api/patient/${patientId}`)
    .map((request) => request.method)).toEqual(["GET", "POST", "GET"]);
  tracker.assertNoUnexpected();
});

test("test_recompute_when_POST_fails_keeps_last_snapshot_and_disables_actions", async ({ page }) => {
  const tracker = await installRecoveryRoutes(page, true);
  await page.goto(routePath);
  await expect(page.getByRole("heading", { name: patient.patientName })).toBeVisible();
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Recompute readiness" }).click();
  await expect(page.getByRole("alert").filter({
    hasText: "Live readiness refresh failed",
  })).toBeVisible();
  await expect(page.locator(".sa-utility-bar")
    .locator(`time[datetime="${knownAsOf}"]`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Request document" })).toBeDisabled();
  expect(tracker.requests.filter((request) => request.path === `/api/patient/${patientId}`)
    .map((request) => request.method)).toEqual(["GET", "POST"]);
  tracker.assertNoUnexpected();
});

test("test_timeline_when_sql_returns_derived_and_pending_events_shows_provenance_and_bounds",
  async ({ page }) => {
  const tracker = await openWorkspace(page, "Timeline");
  const timeline = page.getByRole("region", { name: "Patient timeline" });
  await expect(timeline).toContainText("Showing 2 of 21 recorded events");
  await expect(timeline).toContainText("older events are not displayed");
  await expect(timeline).toContainText("Awaiting laboratory sign-off");
  await expect(timeline).toContainText("Derived value");
  await expect(timeline).toContainText("10^9/L");
  await expect(timeline).toContainText("EVT-WBC, EVT-NEUT");
  await expect(timeline).toContainText("DOC-1");
  await expect(timeline).toContainText("Source links reflect the record at 2026-09-23T14:15:00");
  tracker.assertNoUnexpected();
});

test("test_task_retry_when_receipt_is_uncertain_reuses_request_id_and_history_shows_readback_state",
  async ({ page }) => {
  const tracker = await openWorkspace(page, "Overview");
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Request document" }).click();
  await page.getByRole("button", { name: "Create document request" }).click();
  const uncertain = page.getByRole("status").filter({ hasText: "Task status not confirmed" });
  await expect(uncertain).toBeVisible();

  const requestId = tracker.requests.find((request) => request.path === "/api/review-task")
    ?.body.requestId;
  await page.reload();
  await expect(page.getByRole("heading", { name: patient.patientName })).toBeVisible();
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Request document" }).click();
  await page.getByRole("button", { name: "Create document request" }).click();
  const feedback = page.getByRole("status").filter({ hasText: "Task already filed" });
  await expect(feedback).toContainText("closed");
  await expect(feedback).toContainText(taskId);
  await expect(page.getByRole("region", { name: "Review task history" }))
    .toContainText("Document request · closed");
  const submissions = tracker.requests.filter((request) => request.path === "/api/review-task");
  expect(submissions).toHaveLength(2);
  expect(requestId).toBeTruthy();
  expect(submissions[1].body.requestId).toBe(requestId);
  tracker.assertNoUnexpected();
});

test("test_task_retry_when_session_storage_is_denied_explains_reload_limit", async ({ page }) => {
  await page.addInitScript(() => {
    const storage = window.sessionStorage;
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key.startsWith("saarthi:review-task:v1:")) {
        throw new DOMException("Storage access denied", "SecurityError");
      }
      setItem(key, value);
    };
  });
  const tracker = await openWorkspace(page, "Overview");
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Request document" }).click();
  await page.getByRole("button", { name: "Create document request" }).click();
  const feedback = page.getByRole("status").filter({ hasText: "Task status not confirmed" });
  await expect(feedback).toContainText("Reload recovery is unavailable");
  await page.getByRole("button", { name: "Create document request" }).click();
  const submissions = tracker.requests.filter((request) => request.path === "/api/review-task");
  expect(submissions).toHaveLength(2);
  expect(submissions[1].body.requestId).toBe(submissions[0].body.requestId);
  tracker.assertNoUnexpected();
});

test("test_review_task_draft_when_cancelled_returns_focus_without_writing", async ({ page }) => {
  const tracker = await openWorkspace(page, "Overview");
  await page.getByRole("button", { name: "View check" }).first().click();
  await page.getByRole("button", { name: "Request document" }).click();
  const draft = page.getByRole("region", { name: "Follow-up draft" });
  await expect(draft.getByRole("heading")).toBeFocused();
  await expect(draft).toContainText("Fatima Begum");
  await expect(draft).toContainText("Dr Example");
  await expect(draft).toContainText("Platelet result needs review.");
  await expect(draft).toContainText("ASSERT-SYNTHETIC-1");
  expect(tracker.requests.filter((request) => request.path === "/api/review-task")).toHaveLength(0);
  await draft.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Request document" })).toBeFocused();
  tracker.assertNoUnexpected();
});
