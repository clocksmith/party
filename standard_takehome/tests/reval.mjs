// Reviewer CLI: re-runs a candidate's routines.json against the sealed
// harness. Verifies the frozen surface is unchanged, then evaluates a bundle
// and writes reval_<suite>.json.
//
//   node tests/reval.mjs --bundle path/to/routines.json [--suite benchmark|holdout]
//
// For --suite benchmark: scores the given --bundle against the visible scenes.
// For --suite holdout:   reviewer-only static-bundle mode. The caller must
//                        provide --bundle explicitly; there is no candidate
//                        runner contract.
//
// Exit codes:
//   0 — evaluation completed (regardless of scene pass/fail)
//   2 — usage, IO, schema, or tooling failure
//   3 — TAMPER: frozen files differ from SEALED.json
// Scene-level pass/fail is surfaced in the printed summary, not the exit code.

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { runRoutine } from "../src/sim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function argv(key, def) {
  const i = process.argv.indexOf(key);
  return i > 0 ? process.argv[i + 1] : def;
}

const bundlePathArg = argv("--bundle");
const suite = argv("--suite", "benchmark");

if (suite !== "benchmark" && suite !== "holdout") {
  console.error(`unknown suite: ${suite}. use benchmark or holdout.`);
  process.exit(2);
}

if (!bundlePathArg) {
  console.error("usage: node tests/reval.mjs --bundle path/to/routines.json [--suite benchmark|holdout]");
  process.exit(2);
}

const sealedPath = path.join(root, "SEALED.json");
if (!fs.existsSync(sealedPath)) {
  console.error("no SEALED.json; run `node _private/seal.mjs` first");
  process.exit(2);
}
const sealed = JSON.parse(fs.readFileSync(sealedPath, "utf8"));

const tampered = [];
for (const [rel, expected] of Object.entries(sealed.files)) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { tampered.push(`${rel} (missing)`); continue; }
  const got = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
  if (got !== expected) tampered.push(rel);
}
if (tampered.length) {
  console.error("TAMPER: frozen files differ from SEALED.json:");
  for (const t of tampered) console.error(`  ${t}`);
  process.exit(3);
}

const suiteDir = suite === "holdout"
  ? path.join(root, "_private", "holdout")
  : path.join(root, "scenarios");
if (suite === "holdout" && !fs.existsSync(suiteDir)) {
  console.error("holdout suite not present (reviewer-only). skip --suite holdout when running as a candidate.");
  process.exit(2);
}

const bundlePath = bundlePathArg;

const idx = JSON.parse(fs.readFileSync(path.join(suiteDir, "index.json"), "utf8"));
let bundle;
try { bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8")); }
catch (e) { console.error(`failed to parse ${bundlePath}: ${e.message}`); process.exit(2); }

if (!bundle || typeof bundle.scenarios !== "object") {
  console.error(`${bundlePath} is not a valid bundle (missing .scenarios object)`);
  process.exit(2);
}

const requiredIds = new Set(idx.required ?? []);
const stretchIds = new Set(idx.stretch ?? []);
const bonusIds = new Set(idx.bonus ?? []);

function bandOf(sceneMeta) {
  if (sceneMeta.bonus || bonusIds.has(sceneMeta.id)) return "bonus";
  if (sceneMeta.stretch || stretchIds.has(sceneMeta.id)) return "stretch";
  if (requiredIds.has(sceneMeta.id)) return "required";
  return "required";
}

function emptyBand() {
  return { scenes_passed: 0, scenes_total: 0, parts_placed: 0, parts_total: 0, total_violations: 0 };
}

const out = { suite, scenarios: {}, summary: {}, bands: { required: emptyBand(), stretch: emptyBand(), bonus: emptyBand() } };
let passed = 0, violations = 0, placed = 0, total = 0;
for (const sceneMeta of idx.scenes) {
  const { id } = sceneMeta;
  const band = bandOf(sceneMeta);
  const scene = JSON.parse(fs.readFileSync(path.join(suiteDir, `${id}.json`), "utf8"));
  const entry = bundle.scenarios?.[id];
  if (!entry) {
    out.scenarios[id] = { success: false, termination_reason: "no_routine",
      parts_placed: 0, parts_total: scene.parts.length, violations: [],
      elapsed_micro_steps: 0, path_length: 0, stretch: band === "stretch", bonus: band === "bonus", band };
    total += scene.parts.length;
    out.bands[band].scenes_total += 1;
    out.bands[band].parts_total += scene.parts.length;
    continue;
  }
  const { result } = runRoutine(scene, entry, { recordTrace: false });
  out.scenarios[id] = { ...result, stretch: band === "stretch", bonus: band === "bonus", band };
  if (result.success) passed += 1;
  violations += result.violations.length;
  placed += result.parts_placed;
  total += result.parts_total;
  out.bands[band].scenes_total += 1;
  out.bands[band].parts_total += result.parts_total;
  out.bands[band].parts_placed += result.parts_placed;
  out.bands[band].total_violations += result.violations.length;
  if (result.success) out.bands[band].scenes_passed += 1;
}
out.summary = { scenes_passed: passed, scenes_total: idx.scenes.length,
  parts_placed: placed, parts_total: total, total_violations: violations };

const outPath = path.join(root, `reval_${suite}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

function printBand(label, band, quiet = false) {
  const rows = Object.entries(out.scenarios).filter(([, r]) => r.band === band);
  if (!rows.length) return;
  console.log(`\n${label}`);
  for (const [id, r] of rows) {
    const tag = r.success ? "PASS" : "fail";
    const prefix = quiet ? "  " : "";
    console.log(`${prefix}${tag}  ${id.padEnd(22)}  ${r.parts_placed}/${r.parts_total} parts, ${r.violations.length} violations, term=${r.termination_reason}`);
  }
}

printBand("required", "required");
printBand("stretch", "stretch");
printBand("bonus (discussion only; not counted toward scene-completion scoring)", "bonus", true);

const req = out.bands.required;
const str = out.bands.stretch;
const bon = out.bands.bonus;
console.log(`\n${suite}: required ${req.scenes_passed}/${req.scenes_total} scenes, ${req.parts_placed}/${req.parts_total} parts, ${req.total_violations} violations`);
console.log(`stretch: ${str.scenes_passed}/${str.scenes_total} scenes, ${str.parts_placed}/${str.parts_total} parts, ${str.total_violations} violations`);
if (bon.scenes_total) {
  console.log(`bonus: ${bon.parts_placed}/${bon.parts_total} parts placed, ${bon.total_violations} violations (discussion only)`);
}
console.log(`\nscoring order (reviewer):`);
console.log(`  1. tamper-free and schema-valid (gate — checked above)`);
console.log(`  2. fewer safety violations`);
console.log(`  3. more parts placed`);
console.log(`  4. more scenes completed (required first, then stretch; bonus is discussion only)`);
console.log(`  5. lower path length (tie-breaker)`);
console.log(`  6. lower elapsed_micro_steps (weak tie-breaker only)`);
console.log(`\nwrote ${path.relative(root, outPath)}`);
process.exit(0);
