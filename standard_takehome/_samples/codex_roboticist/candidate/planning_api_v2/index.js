import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { dryRun } from "./dryRun.js";
import { solveScene } from "../phase1_planner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");

export class IntentPlanner {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.axis = opts.axis ?? "testability";
    this.intents = [];
    this._routine = null;
  }

  placeAll(opts = {}) {
    this.intents.push({
      type: "place_all",
      order: opts.order ?? "topological-safe",
      refuseUnsafe: opts.refuseUnsafe ?? true,
      dryRun: opts.dryRun ?? true
    });
    this._routine = null;
    return this;
  }

  compile() {
    if (this._routine) return this._routine;

    // This minimal v2 intentionally keeps the compiler small: intent expands
    // through the same simulator-checked Phase 1 planning core, then dryRun is
    // part of the returned API instead of an external debugging habit.
    const routine = solveScene(this.scene);
    routine.notes = `planning_api_v2 intent compile (${this.axis}); ${routine.notes}`;
    this._routine = routine;
    return routine;
  }

  dryRun(routine = this.compile()) {
    return dryRun(this.scene, routine);
  }

  build() {
    const routine = this.compile();
    const check = this.dryRun(routine);
    if (!check.ok) {
      throw new Error(`refusing unsafe routine: ${check.violations.map(v => v.kind).join(", ")}`);
    }
    return routine;
  }
}

export function plan(scene, opts) {
  return new IntentPlanner(scene, opts);
}

function loadScene(id) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "scenarios", `${id}.json`), "utf8"));
}

function updateBundle(sceneId) {
  const bundlePath = path.join(ROOT, "_samples/codex0/candidate/routines.json");
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const scene = loadScene(sceneId);
  const planner = plan(scene, { axis: "testability" }).placeAll();
  const routine = planner.build();
  routine.notes = `${routine.notes}; re-solved with planning_api_v2`;
  bundle.scenarios[sceneId] = routine;
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2) + "\n");
  const check = planner.dryRun(routine);
  console.log(`${sceneId}: ${check.partsPlaced}/${check.partsTotal} parts, ${check.violations.length} violations`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateBundle(process.argv[2] ?? "07_precedence");
}
