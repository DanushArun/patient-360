// Demo preflight: drives the exact keynote demo path (docs/submission/DEMO-KEYNOTE.md) in a
// real browser against the running app and live Snowflake data, and fails loudly if any beat
// is empty, wrong or slow. Run before every rehearsal and on demo day, after
// `python -m backend.scripts.prepare_demo` has passed:
//
//   npm run demo:check                 # http://127.0.0.1:3000
//   DEMO_BASE=http://host:port npm run demo:check
//
// Writes evidence/demo/preflight-latest.json and one screenshot per beat. Speech input is
// replaced by a stand-in recogniser that "hears" the scripted sentence; everything after the
// transcript (planning, confirmation, navigation, governed reads) is the real path.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "evidence/demo");
const SHOTS = path.join(OUT, "preflight");
const BASE = process.env.DEMO_BASE ?? "http://127.0.0.1:3000";
const HERO = { id: "PAT-DC-12", name: "Anjali Deshpande" };
const ANSWER_BUDGET_MS = 30000;

mkdirSync(SHOTS, { recursive: true });
const checks = [];
const started = Date.now();

function record(beat, ok, detail, ms = null) {
  checks.push({ beat, ok, detail, ms });
  console.log(`${ok ? "PASS" : "FAIL"}  ${beat}${ms === null ? "" : ` (${(ms / 1000).toFixed(1)} s)`}  ${detail}`);
}

async function beat(name, page, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    record(name, true, detail ?? "", Date.now() - t0);
  } catch (error) {
    record(name, false, String(error?.message ?? error).split("\n")[0], Date.now() - t0);
  }
  await page.screenshot({ path: path.join(SHOTS, `${String(checks.length).padStart(2, "0")}-${
    name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`) }).catch(() => {});
}

const fakeSpeech = () => {
  class Recogniser {
    start() {
      const text = window.__demoSay ?? "";
      setTimeout(() => this.onstart?.(), 10);
      setTimeout(() => this.onspeechstart?.(), 80);
      setTimeout(() => this.onresult?.({ resultIndex: 0,
        results: [Object.assign([{ transcript: text }], { isFinal: true })] }), 700);
      setTimeout(() => { this.onspeechend?.(); this.onend?.(); }, 800);
    }
    stop() {}
    abort() { this.onend?.(); }
  }
  window.SpeechRecognition = Recogniser;
};

// Sections load their data after they render, so poll until the content arrives (or 45 s).
const expectText = async (locator, pattern, what, timeout = 45000) => {
  const until = Date.now() + timeout;
  let text = "";
  while (Date.now() < until) {
    text = await locator.innerText({ timeout: 5000 }).catch(() => "");
    if (pattern.test(text)) return text;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${what}: expected ${pattern}, saw "${text.slice(0, 160)}"`);
};

async function ask(page, question) {
  const composer = page.locator("[data-copilot-composer] textarea");
  const before = await page.locator(".sa-turn-assistant").count();
  const t0 = Date.now();
  await composer.fill(question);
  await composer.press("Enter");
  await page.waitForFunction((n) => document.querySelectorAll(".sa-turn-assistant").length > n,
    before, { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector("[aria-label='Answer progress']"),
    null, { timeout: 120000 });
  const ms = Date.now() - t0;
  const turn = page.locator(".sa-turn-assistant").last();
  const block = turn.locator("xpath=..");
  const text = await block.innerText();
  if (/No answer is available|could not be|unavailable|Retry/i.test(text)) {
    throw new Error(`error answer: ${text.slice(0, 160)}`);
  }
  if (ms > ANSWER_BUDGET_MS) throw new Error(`slow: ${(ms / 1000).toFixed(1)} s`);
  return { text, ms };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.addInitScript(fakeSpeech);
await page.addInitScript(() => { try { sessionStorage.clear(); } catch { /* fresh */ } });

// ---- Act 1: the day-care list (risk stratification) ----------------------------------
await beat("Day care opens with tomorrow's list", page, async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120000 });
  const status = await expectText(page.locator("#day-care-status"), /\d+ upcoming visits/, "census header");
  const cards = await page.locator("[data-copilot-ref^='patient:']").count();
  if (cards < 12) throw new Error(`only ${cards} visit cards`);
  return `${status}; ${cards} cards`;
});

await beat("Hero is on the list, blocked, with its reason", page, async () => {
  const card = page.locator(`[data-copilot-ref='patient:${HERO.id}']`).first();
  await expectText(card, /Blocked/, "hero status");
  return (await expectText(card, /LVEF/, "hero headline")).replace(/\n+/g, " · ");
});

await beat("Voice: who is blocked today", page, async () => {
  await page.evaluate(() => { window.__demoSay = "Who is blocked today?"; });
  await page.click("button[aria-label='Speak a request']");
  await page.waitForFunction(() => document.querySelectorAll("[data-copilot-mark='cited']").length > 0,
    null, { timeout: ANSWER_BUDGET_MS });
  return `${await page.locator("[data-copilot-mark='cited']").count()} patients marked on the list`;
});

// ---- Act 2: one patient, end to end ---------------------------------------------------
await beat("Voice: open the hero's record (person confirms)", page, async () => {
  await page.evaluate((name) => { window.__demoSay = `Open ${name.split(" ")[0]}'s record`; }, HERO.name);
  await page.click("button[aria-label='Speak a request']");
  const dock = page.locator("section[aria-label='Saarthi live copilot']");
  await page.waitForSelector("section[aria-label='Saarthi live copilot'][data-state='awaiting']",
    { timeout: 15000 });
  await expectText(dock, new RegExp(HERO.name), "confirmation names the patient");
  await dock.locator("button", { hasText: "Open record" }).click();
  await page.waitForURL(new RegExp(`/patient/${HERO.id}`), { timeout: 60000 });
  await expectText(page.locator("h1"), new RegExp(HERO.name), "patient header");
  return "confirmed by click, record opened";
});

await beat("Overview: blocked LVEF and pre-auth conflict with rule versions", page, async () => {
  const table = page.locator("table[aria-label='Readiness checks']");
  await expectText(table, /SURV-LVEF-002/, "LVEF rule");
  await expectText(table, /COV-AUTH-001/, "pre-auth rule");
  return (await table.innerText()).split("\n").filter((line) => /LVEF|pre-auth/i.test(line)).join(" | ");
});

for (const [section, pattern, what] of [
  ["Facts", /LVEF|PLT|WBC/, "lab facts"],
  ["Timeline", /Record timeline/, "timeline"],
  ["Documents", /DOC-ECHO-DC-12/, "echo report listed"],
  ["Coverage", /PM-JAY/, "coverage"],
  ["Family", /Family preparation/, "family view"],
]) {
  await beat(`${section} section has content`, page, async () => {
    await page.locator(".sa-patient-tabs button", { hasText: new RegExp(`^${section}$`) }).click();
    const main = page.locator("section[aria-label='Patient workspace content']");
    await expectText(main, pattern, what);
    if (section === "Documents") {
      const rows = await main.locator("tr[data-copilot-ref^='document:']").count();
      if (rows < 5) throw new Error(`${rows} of 5 hero documents listed`);
      await expectText(main, /verified/i, "verified assertions shown");
      return `${rows} documents`;
    }
    return "ok";
  });
}

await beat("Copilot chat opens beside the record", page, async () => {
  await page.locator(".sa-patient-tabs button", { hasText: /^Overview$/ }).click({ timeout: 10000 });
  await page.keyboard.press("Meta+k");
  await page.locator("[data-copilot-composer] textarea").waitFor({ timeout: 10000 });
  return "composer ready";
});

for (const [question, pattern] of [
  ["Why is she blocked?", /LVEF|SURV-LVEF-002/],
  ["What does the echo show?", /LVEF|49/],
  ["Is her pre-authorisation approved?", /pending|approved|conflict/i],
  ["Show me the latest lab results", /Platelets|WBC|ANC/],
  ["What medication is she on?", /recorded regimen is .*trastuzumab/i],
]) {
  await beat(`Ask: ${question}`, page, async () => {
    const { text } = await ask(page, question);
    if (!pattern.test(text)) throw new Error(`answer lacks ${pattern}: ${text.slice(0, 160)}`);
    return text.split("\n").find((line) => pattern.test(line))?.slice(0, 120);
  });
}

await beat("Ask: clinical judgement is refused with an evidence packet", page, async () => {
  const { text } = await ask(page, "Should we hold her trastuzumab?");
  if (!/Clinical decision/.test(text)) throw new Error(`not refused: ${text.slice(0, 160)}`);
  return "refused; packet offered to the treating practitioner";
});

await beat("Cited source opens on the echo report text", page, async () => {
  await page.goto(`${BASE}/patient/${HERO.id}`, { waitUntil: "networkidle" });
  await page.locator(".sa-patient-tabs button", { hasText: /^Documents$/ }).click();
  const row = page.locator("tr[data-copilot-ref='document:DOC-ECHO-DC-12']");
  await row.locator("button").first().click();
  await page.locator("section[aria-label='Patient workspace content']")
    .getByRole("link", { name: /Open source/ }).first().click({ timeout: 30000 });
  await page.waitForURL(/\/documents\/DOC-ECHO-DC-12/, { timeout: 60000 });
  const source = page.locator("text=LVEF (biplane Simpson): 49 %").first();
  await source.waitFor({ timeout: 45000 });
  return "LVEF (biplane Simpson): 49 % visible";
});

await beat("No page errors during the run", page, async () => {
  if (pageErrors.length) throw new Error(pageErrors.slice(0, 3).join(" | "));
  return "0 page errors";
});

await browser.close();
const failed = checks.filter((check) => !check.ok);
const report = { recorded_at: new Date().toISOString(), base: BASE, hero: HERO,
  status: failed.length ? "FAIL" : "PASS", passed: checks.length - failed.length,
  total: checks.length, seconds: Math.round((Date.now() - started) / 1000), checks };
writeFileSync(path.join(OUT, "preflight-latest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`\n${report.status}: ${report.passed}/${report.total} beats in ${report.seconds} s`);
process.exit(failed.length ? 1 : 0);
