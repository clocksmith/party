// Example Phase 1 planner in JS. Produces a routines.json bundle via stdout
// or via the in-browser runner (see README).
//
// This planner uses the provided Planning API v1 directly. It is a baseline,
// not a ceiling. A thoughtful candidate will do better on scenes 03, 05, 06.

import { naiveSolve, pickAndPlace, Routine, compatibleBins } from "../src/planning_api.js";
import { loadSceneIndex, loadScene } from "../src/scene.js";

// Slightly smarter than naive: sorts parts so that those closer to a
// compatible bin are placed first. Still a greedy heuristic; no path routing.
export function greedyNearestBin(scene) {
  const assignments = [];
  const used = {};
  for (const part of scene.parts) {
    const bins = compatibleBins(scene, part)
      .filter(b => (used[b.id] ?? 0) < (b.capacity ?? Infinity))
      .sort((a, b) => {
        const da = Math.hypot((a.x + a.w / 2) - part.x, (a.y + a.h / 2) - part.y);
        const db = Math.hypot((b.x + b.w / 2) - part.x, (b.y + b.h / 2) - part.y);
        return da - db;
      });
    if (!bins.length) continue;
    const bin = bins[0];
    used[bin.id] = (used[bin.id] ?? 0) + 1;
    assignments.push({ part, bin });
  }
  assignments.sort((x, y) => x.part.x - y.part.x);
  const r = new Routine();
  r.notes = "example greedy: sort by x; assign to nearest compatible open bin";
  for (const { part, bin } of assignments) {
    pickAndPlace(r, scene, part.id, bin.id);
  }
  return r.build();
}

export async function buildBundle(strategy = "greedy") {
  const idx = await loadSceneIndex();
  const bundle = {
    candidate: "example",
    generator: `example_planner.js (${strategy})`,
    scenarios: {}
  };
  for (const { id } of idx.scenes) {
    const scene = await loadScene(id);
    bundle.scenarios[id] = strategy === "naive" ? naiveSolve(scene) : greedyNearestBin(scene);
  }
  return bundle;
}
