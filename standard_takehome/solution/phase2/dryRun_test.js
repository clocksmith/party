import assert from "node:assert/strict";
import fs from "fs";

import { plan } from "./index.js";
import { dryRun } from "./dryRun.js";

const scene = JSON.parse(fs.readFileSync(new URL("../../phase2_examples/obstacle_routing_example.json", import.meta.url), "utf8"));

const routine = plan(scene, {
  family: "obstacle_routing",
  variantId: scene.id,
  source: "public"
});
const result = dryRun(scene, routine);

assert.equal(result.ok, true);
assert.equal(result.complete, true);
assert.equal(result.partsPlaced, 3);
assert.equal(result.violations.length, 0);
