// Scene loading and basic validation. Scenes are static JSON.

export async function loadSceneIndex(base = "./scenarios/") {
  const res = await fetch(base + "index.json");
  if (!res.ok) throw new Error(`Failed to load scene index: ${res.status}`);
  return await res.json();
}

export async function loadScene(id, base = "./scenarios/") {
  const res = await fetch(`${base}${id}.json`);
  if (!res.ok) throw new Error(`Failed to load scene ${id}: ${res.status}`);
  return await res.json();
}

export function validateScene(scene) {
  const issues = [];
  if (!scene.id) issues.push("missing id");
  if (!scene.arm) issues.push("missing arm");
  else {
    if (!Array.isArray(scene.arm.base) || scene.arm.base.length !== 2) issues.push("arm.base must be [x,y]");
    if (!Array.isArray(scene.arm.links) || scene.arm.links.length < 2) issues.push("arm.links must have >=2");
  }
  if (!Array.isArray(scene.parts)) issues.push("parts must be array");
  if (!Array.isArray(scene.bins)) issues.push("bins must be array");
  return issues;
}
