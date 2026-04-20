function binCenter(bin) {
  return {
    x: Number((bin.x + bin.w / 2).toFixed(6)),
    y: Number((bin.y + bin.h / 2).toFixed(6))
  };
}

function accepts(bin, part) {
  const a = bin.accepts ?? "any";
  const kind = part.kind ?? "default";
  return a === "any" || (Array.isArray(a) && (a.includes(kind) || a.includes(part.id)));
}

function binSharedness(scene, bin) {
  const a = bin.accepts ?? "any";
  if (a === "any") return 1000;
  const kinds = new Set(scene.parts.map(p => p.kind ?? "default"));
  return [...kinds].filter(k => Array.isArray(a) && a.includes(k)).length;
}

function chooseBin(scene, part, used) {
  return scene.bins
    .filter(bin => accepts(bin, part) && (used[bin.id] ?? 0) < (bin.capacity ?? Infinity))
    .sort((a, b) => binSharedness(scene, a) - binSharedness(scene, b))[0] ?? null;
}

export function plan(input) {
  const scene = input.scene ?? input;
  const steps = [];
  const assignments = [];
  const dropped = [];
  const used = {};

  for (const part of scene.parts) {
    const bin = chooseBin(scene, part, used);
    if (!bin) {
      dropped.push({
        partId: part.id,
        reason: "no_compatible_bin",
        detail: `No compatible bin accepts kind '${part.kind ?? "default"}'.`
      });
      continue;
    }

    const c = binCenter(bin);
    steps.push(
      { type: "move_pose", x: part.x, y: part.y },
      { type: "grip_close" },
      { type: "move_pose", x: c.x, y: c.y },
      { type: "grip_open" }
    );
    assignments.push({ partId: part.id, binId: bin.id });
    used[bin.id] = (used[bin.id] ?? 0) + 1;
  }

  return {
    steps,
    assignments,
    dropped,
    notes: dropped.length
      ? "Playable v2 batch output: safe partial completion with structured dropped parts."
      : "Playable v2 batch output: one plan call handled assignment, capacity, and ordering."
  };
}
