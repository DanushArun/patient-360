/** "Carcinoma breast · C50.9": the condition as recorded, with its ICD-10 code. */
export function diagnosisLabel(name, code) {
  const text = typeof name === "string" ? name.trim() : "";
  if (!text) return null;
  const icd = typeof code === "string" ? code.trim() : "";
  return icd ? `${text} · ${icd}` : text;
}
