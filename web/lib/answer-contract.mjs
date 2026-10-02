import Ajv2020 from "ajv/dist/2020.js";
import schema from "../../frontend/contracts/answer_schema.json" with { type: "json" };

const validator = new Ajv2020({
  strict: true,
  // Conditional constraints use types and properties declared by the parent schema.
  strictRequired: false,
  strictTypes: false,
  allowUnionTypes: true,
  coerceTypes: false,
  removeAdditional: false,
  useDefaults: false,
}).compile(schema);

/** @param {unknown} answer @returns {void} */
export function assertAnswerContract(answer) {
  if (!validator(answer)) throw new Error("answer_contract_invalid");
}
