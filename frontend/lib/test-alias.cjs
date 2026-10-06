// Test-only module hook, loaded by `npm test` (--require). Render tests compile one component
// and mock its direct imports; anything they do not mock falls through to Node's require.
// This resolves the app's "@/" alias the way tsconfig does, and transpiles .ts/.tsx on load,
// so a component may use shared UI and helpers without every render test re-mocking them.
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

const webRoot = path.resolve(__dirname, "..");
const extensions = ["", ".mjs", ".ts", ".tsx", ".js"];
const resolve = Module._resolveFilename;

Module._resolveFilename = function resolveAlias(request, parent, ...rest) {
  if (typeof request === "string" && request.startsWith("@/")) {
    const base = path.join(webRoot, request.slice(2));
    const hit = extensions.map((ext) => base + ext).find((file) => fs.existsSync(file)
      && fs.statSync(file).isFile());
    if (hit) return hit;
  }
  return resolve.call(this, request, parent, ...rest);
};

let ts;
function transpile(module, filename) {
  ts ??= require("typescript");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
}
for (const ext of [".ts", ".tsx"]) {
  if (!Module._extensions[ext]) Module._extensions[ext] = transpile;
}
