import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const absModule = path.isAbsolute(workerData.modulePath)
  ? workerData.modulePath
  : path.join(root, workerData.modulePath);

try {
  const mod = await import(pathToFileURL(absModule).href);
  const planner = mod.plan ?? mod.default;
  if (typeof planner !== "function") {
    parentPort.postMessage({ status: "bad_module", error: "module must export plan() or default" });
    process.exit(0);
  }
  const t0 = performance.now();
  const routine = await planner(workerData.scene, workerData.context);
  parentPort.postMessage({
    status: "ok",
    routine,
    elapsed_ms: performance.now() - t0,
    declared_family: mod.family ?? null
  });
} catch (e) {
  parentPort.postMessage({ status: "threw", error: e?.message ?? String(e) });
}
