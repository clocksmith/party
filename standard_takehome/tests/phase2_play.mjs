// Candidate/reviewer CLI for playable Phase 2 fixtures.
//
//   node tests/phase2_play.mjs --solution solution/phase2
//   node tests/phase2_play.mjs --solution solution/phase2 --fixture row
//
// A Phase 2 solution exports plan(input) from planner.mjs. Each fixture input
// is either the plan input itself ({ scene, ... }) or a raw scene object, which
// this runner wraps as { scene }. If a matching .out.json exists, the planner
// output must match it exactly after key-order normalization. Returned steps
// are replayed through the same simulator used by Phase 1.

import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { evaluatePhase2Output, normalizePhase2Input } from "../src/harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function argv(key, def = null) {
  const i = process.argv.indexOf(key);
  return i > 0 ? process.argv[i + 1] : def;
}

function usage() {
  console.error("usage: node tests/phase2_play.mjs --solution solution/phase2 [--fixture name]");
  process.exit(2);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`failed to parse ${path.relative(root, file)}: ${e.message}`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
}

function sameJson(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function outputKind(output) {
  if (output?.refusal) return `REFUSAL ${output.refusal.reason ?? "unknown"}`;
  if (Array.isArray(output?.dropped) && output.dropped.length) return `PARTIAL dropped=${output.dropped.length}`;
  return "ROUTINE";
}

const solutionArg = argv("--solution", "solution/phase2");
if (process.argv.includes("--help") || process.argv.includes("-h")) usage();

const solutionDir = path.resolve(root, solutionArg);
const plannerPath = path.join(solutionDir, "planner.mjs");
const fixturesDir = path.join(solutionDir, "fixtures");
const onlyFixture = argv("--fixture");

if (!fs.existsSync(plannerPath)) {
  console.error(`missing ${path.relative(root, plannerPath)}; Phase 2 must export plan(input) from planner.mjs`);
  process.exit(2);
}
if (!fs.existsSync(fixturesDir)) {
  console.error(`missing ${path.relative(root, fixturesDir)}`);
  process.exit(2);
}

const fixtureNames = fs.readdirSync(fixturesDir)
  .filter(f => f.endsWith(".in.json"))
  .map(f => f.slice(0, -".in.json".length))
  .filter(name => !onlyFixture || name === onlyFixture)
  .sort();

if (!fixtureNames.length) {
  console.error(onlyFixture
    ? `no fixture named ${onlyFixture} under ${path.relative(root, fixturesDir)}`
    : `no *.in.json fixtures under ${path.relative(root, fixturesDir)}`);
  process.exit(2);
}

let mod;
try {
  mod = await import(pathToFileURL(plannerPath).href);
} catch (e) {
  console.error(`failed to import ${path.relative(root, plannerPath)}: ${e.message}`);
  process.exit(2);
}
if (typeof mod.plan !== "function") {
  console.error(`${path.relative(root, plannerPath)} must export function plan(input)`);
  process.exit(2);
}

let failures = 0;
const summary = [];

for (const name of fixtureNames) {
  const inPath = path.join(fixturesDir, `${name}.in.json`);
  const outPath = path.join(fixturesDir, `${name}.out.json`);
  let rawInput, expected, actual;
  const errors = [];

  try {
    rawInput = readJson(inPath);
    if (!fs.existsSync(outPath)) throw new Error(`missing ${path.relative(root, outPath)}`);
    expected = readJson(outPath);
    actual = await mod.plan(normalizePhase2Input(rawInput));
  } catch (e) {
    errors.push(e.message);
  }

  let evalOut = null;
  if (!errors.length) {
    evalOut = evaluatePhase2Output(rawInput, actual, { recordTrace: false });
    errors.push(...evalOut.issues);
    if (evalOut.result?.violations?.length) {
      for (const v of evalOut.result.violations) {
        errors.push(`routine violation ${v.kind} @ step ${v.step_index}: ${v.detail ?? ""}`.trim());
      }
    }
    if (!sameJson(actual, expected)) {
      errors.push(`${name}.out.json does not match plan(input) output`);
    }
  }

  if (errors.length) {
    failures += 1;
    console.log(`FAIL  ${name}`);
    for (const err of errors) console.log(`      ${err}`);
    continue;
  }

  const placed = evalOut.result ? `${evalOut.result.parts_placed}/${evalOut.result.parts_total} parts` : "no replay";
  const violations = evalOut.result ? `${evalOut.result.violations.length} violations` : "no replay";
  const steps = evalOut.routine ? `${evalOut.routine.steps.length} steps` : "no steps";
  console.log(`PASS  ${name.padEnd(18)} ${outputKind(actual)}, ${steps}, ${placed}, ${violations}`);
  summary.push({ name, output: outputKind(actual), steps: evalOut.routine?.steps.length ?? 0, placed: evalOut.result?.parts_placed ?? null, total: evalOut.result?.parts_total ?? null });
}

console.log(`\nphase2: ${fixtureNames.length - failures}/${fixtureNames.length} fixtures playable`);
if (failures) process.exit(1);

const outPath = path.join(root, "phase2_play_results.json");
fs.writeFileSync(outPath, JSON.stringify({ solution: path.relative(root, solutionDir), fixtures: summary }, null, 2) + "\n");
console.log(`wrote ${path.relative(root, outPath)}`);
