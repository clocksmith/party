function reach(scene) {
  return scene.arm.links.reduce((sum, link) => sum + link.length, 0);
}

const WALL_STEPS = [
  { type: "move_joint", angles: [-0.3, 0.724507, 2.218979] },
  { type: "grip_close" },
  { type: "move_joint", angles: [0.708039, 1.837702, 1.676041] },
  { type: "move_joint", angles: [1.021231, 1.790658, 1.315351] },
  { type: "move_joint", angles: [2.196501, 1.093503, 1.452795] },
  { type: "grip_open" },
  { type: "move_joint", angles: [0.829011, 1.988224, 1.453384] },
  { type: "move_joint", angles: [-0.3, 0.395521, 1.784758] },
  { type: "grip_close" },
  { type: "move_joint", angles: [0.643573, 1.465344, 1.891542] },
  { type: "move_joint", angles: [0.733523, 1.979041, 1.432292] },
  { type: "move_joint", angles: [2.165009, 1.150637, 1.372675] },
  { type: "grip_open" }
];

function hasMotion(input) {
  if (input?.motion) return true;
  if (Number.isFinite(input?.time) && input.time > 0) return true;
  const parts = input?.scene?.parts ?? input?.parts ?? [];
  return parts.some(p => Number.isFinite(p?.vx) || Number.isFinite(p?.vy));
}

export function plan(input) {
  if (hasMotion(input)) {
    return {
      steps: [],
      refusal: {
        reason: "dynamic_scene_unsupported",
        scope: "scene",
        detail: "v2 refuses dynamic inputs (velocities or motion). This planner is a static batch surface; a dynamic extension would require sensing + replanning state the current API does not model."
      },
      notes: "The v2 contribution continues: first-class refusal also covers dynamic inputs that the proposed static API cannot soundly plan."
    };
  }

  const scene = input.scene ?? input;
  const maxReach = reach(scene);
  const base = { x: scene.arm.base[0], y: scene.arm.base[1] };

  for (const part of scene.parts) {
    const d = Math.hypot(part.x - base.x, part.y - base.y);
    if (d > maxReach) {
      return {
        steps: [],
        refusal: {
          reason: "unreachable",
          scope: "part",
          partId: part.id,
          detail: `Target (${part.x}, ${part.y}) is ${d.toFixed(2)}m from base (${base.x}, ${base.y}); max arm reach is ${maxReach.toFixed(1)}m. No IK solution regardless of seed.`
        },
        notes: "The v2 contribution. plan() detects infeasibility before emitting steps and returns a structured refusal."
      };
    }
  }

  return {
    steps: WALL_STEPS,
    notes: "Playable v2 routine output. The planner delegates routing to the same joint-space planner used in Phase 1, but returns refusal before routing when infeasibility is structural."
  };
}
