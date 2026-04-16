import assert from "node:assert/strict";
import fs from "fs";

import { plan } from "./index.js";

const scene = JSON.parse(fs.readFileSync(new URL("../../../../scenarios/01_warmup.json", import.meta.url), "utf8"));

const planner = plan(scene, { axis: "testability" }).placeAll();
const routine = planner.build();
const result = planner.dryRun(routine);

assert.equal(result.ok, true);
assert.equal(result.complete, true);
assert.equal(result.partsPlaced, 1);
assert.equal(result.violations.length, 0);
