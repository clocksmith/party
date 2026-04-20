// Reviewer and candidate CLI: re-runs a routines.json against the public
// harness, evaluates the bundle, and writes reval_benchmark.json.
//
//   node tests/reval.mjs --bundle path/to/routines.json
//
// Exit codes:
//   0 — evaluation completed and safety gate passed (zero violations)
//   1 — safety gate failed (at least one scene violated)
//   2 — usage, IO, schema, or tooling failure

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runRoutine } from "../src/sim.js";
import { classifyResult, coveragePartsPlaced, coveragePartsTotal, validateRoutineBundle } from "../src/harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function argv(key, def) {
  const i = process.argv.indexOf(key);
  return i > 0 ? process.argv[i + 1] : def;
}

const bundlePathArg = argv("--bundle");
const suite = "benchmark";

if (!bundlePathArg) {
  console.error("usage: node tests/reval.mjs --bundle path/to/routines.json");
  process.exit(2);
}

const suiteDir = path.join(root, "scenarios");
const bundlePath = bundlePathArg;

const idx = JSON.parse(fs.readFileSync(path.join(suiteDir, "index.json"), "utf8"));
let bundle;
try { bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8")); }
catch (e) { console.error(`failed to parse ${bundlePath}: ${e.message}`); process.exit(2); }

const bundleIssues = validateRoutineBundle(bundle);
if (bundleIssues.length) {
  console.error(`${bundlePath} is not a valid bundle:`);
  for (const issue of bundleIssues) console.error(`  ${issue}`);
  process.exit(2);
}

const requiredIds = new Set(idx.required ?? []);
const hardIds = new Set(idx.hard ?? []);

function bandOf(sceneMeta) {
  if (sceneMeta.hard || hardIds.has(sceneMeta.id)) return "hard";
  if (requiredIds.has(sceneMeta.id)) return "required";
  return "required";
}

function emptyBand() {
  return { scenes_passed: 0, scenes_total: 0, parts_placed: 0, parts_total: 0,
    coverage_parts_placed: 0, coverage_parts_total: 0, total_violations: 0 };
}

const out = { suite, scenarios: {}, summary: {}, bands: { required: emptyBand(), hard: emptyBand() } };
let passed = 0, violations = 0, placed = 0, total = 0;
let coveragePlaced = 0, coverageTotal = 0;
for (const sceneMeta of idx.scenes) {
  const { id } = sceneMeta;
  const band = bandOf(sceneMeta);
  const scene = JSON.parse(fs.readFileSync(path.join(suiteDir, `${id}.json`), "utf8"));
  scene.coverage_parts_total = sceneMeta.coverage_parts_total;
  const sceneCoverageTotal = coveragePartsTotal(scene);
  const entry = bundle.scenarios?.[id];
  if (!entry) {
    out.scenarios[id] = { success: false, termination_reason: "no_routine",
      parts_placed: 0, parts_total: scene.parts.length, violations: [],
      elapsed_micro_steps: 0, path_length: 0, band,
      coverage_parts_placed: 0, coverage_parts_total: sceneCoverageTotal };
    total += scene.parts.length;
    coverageTotal += sceneCoverageTotal;
    out.bands[band].scenes_total += 1;
    out.bands[band].parts_total += scene.parts.length;
    out.bands[band].coverage_parts_total += sceneCoverageTotal;
    continue;
  }
  const { result } = runRoutine(scene, entry, { recordTrace: false });
  const sceneCoveragePlaced = coveragePartsPlaced(result, scene);
  out.scenarios[id] = { ...result, band,
    coverage_parts_placed: sceneCoveragePlaced, coverage_parts_total: sceneCoverageTotal };
  if (result.success) passed += 1;
  violations += result.violations.length;
  placed += result.parts_placed;
  total += result.parts_total;
  coveragePlaced += sceneCoveragePlaced;
  coverageTotal += sceneCoverageTotal;
  out.bands[band].scenes_total += 1;
  out.bands[band].parts_total += result.parts_total;
  out.bands[band].parts_placed += result.parts_placed;
  out.bands[band].coverage_parts_total += sceneCoverageTotal;
  out.bands[band].coverage_parts_placed += sceneCoveragePlaced;
  out.bands[band].total_violations += result.violations.length;
  if (result.success) out.bands[band].scenes_passed += 1;
}
out.summary = { scenes_passed: passed, scenes_total: idx.scenes.length,
  parts_placed: placed, parts_total: total,
  coverage_parts_placed: coveragePlaced, coverage_parts_total: coverageTotal,
  total_violations: violations };

const outPath = path.join(root, `reval_${suite}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

function printBand(label, band, quiet = false) {
  const rows = Object.entries(out.scenarios).filter(([, r]) => r.band === band);
  if (!rows.length) return;
  console.log(`\n${label}`);
  for (const [id, r] of rows) {
    const tag = {
      pass: "PASS   ",
      violate: "VIOLATE",
      missing: "MISSING",
      partial: "PARTIAL"
    }[classifyResult(r)];
    const prefix = quiet ? "  " : "";
    console.log(`${prefix}${tag}  ${id.padEnd(22)}  ${r.parts_placed}/${r.parts_total} parts, ${r.violations.length} violations, term=${r.termination_reason}`);
  }
}

printBand("required", "required");
printBand("hard", "hard");

const req = out.bands.required;
const hard = out.bands.hard;
console.log(`\n${suite}: required ${req.scenes_passed}/${req.scenes_total} scenes, ${req.coverage_parts_placed}/${req.coverage_parts_total} coverage (${req.parts_placed}/${req.parts_total} raw parts), ${req.total_violations} violations`);
console.log(`hard: ${hard.scenes_passed}/${hard.scenes_total} scenes, ${hard.coverage_parts_placed}/${hard.coverage_parts_total} coverage (${hard.parts_placed}/${hard.parts_total} raw parts), ${hard.total_violations} violations`);
console.log(`\nrubric: RUBRIC.md — safe (gate), coverage (scalar), tradeoff clarity (tiebreaker).`);
console.log(`phase 2 is checked separately with tests/phase2_play.mjs (solution/phase2/planner.mjs + fixtures + prose).`);
console.log(`\nwrote ${path.relative(root, outPath)}`);
if (violations > 0) {
  console.log(`safety gate: FAIL (${violations} violations across ${out.bands.required.scenes_total + out.bands.hard.scenes_total} scenes)`);
  process.exit(1);
}
console.log(`safety gate: PASS`);
process.exit(0);
