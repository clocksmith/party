import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runRoutine } from "../src/sim.js";
import { naiveSolve } from "../src/planning_api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const idx = JSON.parse(fs.readFileSync(path.join(root, "scenarios/index.json"), "utf8"));

let passed = 0, failed = 0;
for (const { id } of idx.scenes) {
  const scene = JSON.parse(fs.readFileSync(path.join(root, "scenarios", `${id}.json`), "utf8"));
  const routine = naiveSolve(scene);
  const { result } = runRoutine(scene, routine, { recordTrace: false });
  const tag = result.success ? "PASS" : "fail";
  console.log(`${tag}  ${id.padEnd(14)}  ${result.parts_placed}/${result.parts_total} parts, ${result.violations.length} violations, term=${result.termination_reason}, steps=${result.elapsed_micro_steps}`);
  for (const v of result.violations) {
    console.log(`      ${v.kind} @ step ${v.step_index}: ${v.detail}`);
  }
  if (result.success) passed += 1; else failed += 1;
}

console.log(`\nbaseline across ${passed + failed} scenes: ${passed} pass, ${failed} fail`);
