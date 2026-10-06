import assert from "node:assert/strict";
import test from "node:test";
import { matchPatients, planRequest, rankItems, stepMovesView } from "./copilot-intent.mjs";

const roster = [
  { id: "PAT-DC-03", name: "Rakesh Kumar Yadav" },
  { id: "PAT-DC-04", name: "Fatima Begum" },
  { id: "PAT-DC-06", name: "Priya Sharma" },
  { id: "PAT-DC-07", name: "Gopal Das" },
];
const census = { route: "census", patient: null, section: null, roster };
const rakesh = { route: "patient", patient: roster[0], section: "Overview", roster };
const types = (plan) => plan.steps.map((step) => step.type);

test("a spoken name is only a suggestion: the first step waits for a person to choose", () => {
  const plan = planRequest("Open Rakesh's record and show what's missing", census);
  assert.deepEqual(types(plan), ["select_patient", "section", "ask", "mark"]);
  assert.deepEqual(plan.steps[0].candidates, [roster[0]]);
  // An instruction is asked in classifier-recognised record-state wording.
  assert.equal(plan.steps[2].question, "What is missing in the record?");
});

test("names resolve only against the authorised roster, tolerate one misheard letter, and stay ambiguous when tied", () => {
  assert.deepEqual(matchPatients("open rakash's coverage", roster), [roster[0]]);
  assert.deepEqual(matchPatients("open PAT DC 04", roster), [roster[1]]);
  assert.deepEqual(matchPatients("open Meera's record", roster), []);
  const twins = [...roster, { id: "PAT-DC-09", name: "Priya Nair" }];
  assert.equal(matchPatients("open Priya", twins).length, 2);
});

test("record questions open the section that holds their evidence, then ask and mark", () => {
  assert.deepEqual(planRequest("What's the latest platelet count?", rakesh).steps
    .map((step) => step.section ?? step.type), ["Facts", "ask", "mark"]);
  // Already on Overview: no needless navigation.
  assert.deepEqual(types(planRequest("Do any sources disagree?", rakesh)), ["ask", "mark"]);
  // A question in the person's own words is sent unchanged.
  assert.equal(planRequest("Do any sources disagree?", rakesh).steps[0].question,
    "Do any sources disagree?");
});

test("cohort questions go to the day-care list, never into one patient's record", () => {
  const plan = planRequest("Who is blocked today?", rakesh);
  assert.deepEqual(types(plan), ["go", "ask", "mark"]);
  assert.equal(plan.steps[1].scope, "cohort");
  assert.deepEqual(types(planRequest("List the blocked patients", census)), ["ask", "mark"]);
});

test("bring-into-chat finds a specific item and collects it; a place noun alone just opens the place", () => {
  const plan = planRequest("Bring the lab report into the chat", rakesh);
  assert.deepEqual(types(plan), ["section", "find", "collect"]);
  assert.equal(plan.steps[1].kind, "document");
  assert.deepEqual(plan.steps[1].terms, ["lab"], "a place noun never decides a match alone");
  assert.equal(plan.steps[1].phrase, "lab report");
  assert.deepEqual(planRequest("open the documents", rakesh).steps,
    [{ type: "section", section: "Documents" }]);
  const check = planRequest("bring the ANC check into chat and explain why it's blocked", rakesh);
  assert.deepEqual(types(check), ["find", "collect", "ask", "mark"]);
  assert.equal(check.steps[0].kind, "check");
});

test("navigation and control words map to the closed vocabulary", () => {
  assert.deepEqual(planRequest("go back to day care", rakesh).steps, [{ type: "go", to: "census" }]);
  assert.deepEqual(planRequest("go to the review queue", rakesh).steps, [{ type: "go", to: "queue" }]);
  assert.equal(planRequest("go back", rakesh).control, "back");
  assert.equal(planRequest("Stop", rakesh).control, "cancel");
});

test("a patient section needs a patient: the planner says so instead of guessing", () => {
  const plan = planRequest("open documents", census);
  assert.deepEqual(plan.steps, []);
  assert.match(plan.reply, /whose record/);
});

test("clinical-judgement questions are still only routed to the governed record path", () => {
  // The server's classifier refuses Class A; the planner adds no view or answer of its own.
  const plan = planRequest("Should he proceed with chemo?", rakesh);
  assert.deepEqual(types(plan), ["ask", "mark"]);
  assert.equal(plan.steps[0].scope, "patient");
});

test("only screen-moving steps are paused by manual work", () => {
  assert.equal(stepMovesView({ type: "section", section: "Facts" }), true);
  assert.equal(stepMovesView({ type: "ask", scope: "patient", question: "x" }), false);
  assert.equal(stepMovesView({ type: "mark", scope: "patient" }), false);
});

test("find ranks by matched terms and keeps the newest item on a tie", () => {
  const items = [{ text: "Lab report DOC-LAB-2" }, { text: "Discharge summary" },
    { text: "Lab report DOC-LAB-1" }];
  assert.equal(rankItems(items, ["lab"]), 0);
  assert.equal(rankItems(items, ["discharge"]), 1);
  assert.equal(rankItems([{ text: "lab_report" }], ["lab"]), 0);
  assert.equal(rankItems(items, []), 0, "no specific words: the newest item");
});

test("a request for an item that is not on screen fails instead of grabbing a near miss", () => {
  const plan = planRequest("bring the echo report into the chat", rakesh);
  const find = plan.steps.find((step) => step.type === "find");
  assert.deepEqual(find.terms, ["echo"]);
  assert.equal(rankItems([{ text: "Lab report DOC-LAB-DC-03" }], find.terms, find.codes), -1);
});

test("spoken lab names find their concept code on the facts table", () => {
  const find = planRequest("find the platelet count", rakesh).steps
    .find((step) => step.type === "find");
  assert.deepEqual(find.codes, ["plt"]);
  const rows = [{ text: "WBC count 3.2" }, { text: "PLT 82000 /µL" }];
  assert.equal(rankItems(rows, find.terms, find.codes), 1);
});

test("show-me record questions, including the suggested starters, are asked, not searched for", () => {
  for (const text of ["Show me the latest lab results", "Show me the conflicts in the record",
    "Show me the recent timeline", "Show me the visit schedule", "Show me the documents"]) {
    const plan = planRequest(text, rakesh);
    const ask = plan.steps.find((step) => step.type === "ask");
    assert.ok(ask, text);
    assert.equal(ask.question, text, "the person's own words are sent");
    assert.ok(!plan.steps.some((step) => step.type === "find"), text);
  }
  // Going to an item is still navigation.
  assert.ok(planRequest("Open the lab report", rakesh).steps.some((step) => step.type === "find"));
});
