import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("patient controls have accessible names and expose their state", async () => {
  const [client, evidence, css] = await Promise.all([
    read("../app/patient/[id]/patient-client.tsx"),
    read("../app/patient/[id]/patient-evidence.tsx"),
    read("../app/globals.css"),
  ]);

  assert.match(client, /aria-label="Ask about this patient's record"/);
  assert.match(client, /aria-pressed=\{mode === item\}/);
  assert.match(client, /role="log" aria-label="Patient conversation"/);
  assert.match(client, /role="alert"/);
  assert.match(evidence, /aria-expanded=\{selected\} aria-controls="readiness-evidence"/);
  assert.match(evidence, /role="status" aria-live="polite"/);
  assert.match(css, /:focus-visible\s*\{\s*outline: 2px solid/);
  assert.match(css, /\.sa-patient-header\s*\{\s*grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(client, /grid-cols-2 sm:grid-cols-4/);
});

test("readiness preserves the distinct neutral state for missing evidence", async () => {
  const [components, client, census] = await Promise.all([
    read("../components/sa.tsx"),
    read("../app/patient/[id]/patient-client.tsx"),
    read("../app/page.tsx"),
  ]);

  assert.match(components, /not_evaluated: \{ glyph: "–", word: "Not evaluated"/);
  assert.match(components, /border: `1px dashed \$\{INK_MUTED\}`/);
  assert.match(client, /Do not infer a check result from missing data/);
  assert.match(census, /Every status comes from the SQL readiness snapshot/);
});

test("conversation state is local to the mounted patient view", async () => {
  const client = await read("../app/patient/[id]/patient-client.tsx");

  assert.match(client, /function useTurns\(\)[\s\S]*?return useState<Turn\[]>\(EMPTY\)/);
  assert.doesNotMatch(client, /sessionStorage|localStorage/);
});

test("patient route remounts chat state when the patient changes", async () => {
  const route = await read("../app/patient/[id]/page.tsx");
  assert.match(route, /<PatientClient key=\{id\} patient=\{patient\} \/>/);
});
