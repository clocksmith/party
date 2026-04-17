// Canvas renderer. Visual language: matte black cylindrical links, orange
// accent rings at joint seams, white hexagon logo on joint caps, bright
// green LED at the gripper, light gray studio background.

const COLORS = {
  bg: "#e8e8ea",
  grid: "#dcdce0",
  floor: "#5a5a62",
  warningBand: "#f4c430",
  warningBandDark: "#1a1a1c",
  obstacle: "#2a2a2c",
  obstacleEdge: "#0a0a0a",
  bin: "#5a5a60",
  binFill: "rgba(255,255,255,0.45)",
  fixtureNest: "rgba(255,255,255,0.34)",
  fixtureNestEdge: "rgba(26,26,28,0.28)",
  fixtureNestInner: "rgba(26,26,28,0.08)",
  partKinds: {
    a: "#9a4ad6",
    b: "#ffffff",
    c: "#cf6a3a",
    d: "#0a0a0c"
  },
  partMissing: "#ff00ff",
  link: "#0c0c0e",
  linkHighlight: "#3a3a3e",
  jointCap: "#101012",
  jointRing: "#ff6a1f",
  jointHex: "#ffffff",
  gripperBody: "#1a1a1c",
  gripperLED: "#39ff7d",
  gripperLEDDim: "#1c5a32",
  text: "#1a1a1c",
  textDim: "#5a5a60"
};

export function makeView(canvas, world) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const wW = world.x_max - world.x_min;
  const wH = world.y_max - world.y_min;
  const scale = Math.min(cssW / wW, cssH / wH);
  const offX = (cssW - wW * scale) / 2 - world.x_min * scale;
  const offY = cssH - (cssH - wH * scale) / 2 + world.y_min * scale;

  return {
    ctx, scale, w: cssW, h: cssH,
    toScreen(x, y) { return [offX + x * scale, offY - y * scale]; },
    sx(x) { return offX + x * scale; },
    sy(y) { return offY - y * scale; }
  };
}

function drawHexagon(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawCapsule(ctx, x1, y1, x2, y2, thickness) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);
  const r = thickness / 2;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(len, -r);
  ctx.arc(len, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, "rgba(255,255,255,0.18)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(len, -r);
  ctx.arc(len, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBackground(view, scene) {
  const { ctx, w, h } = view;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const step = 0.1;
  const world = scene._world;
  for (let x = Math.ceil(world.x_min / step) * step; x <= world.x_max; x += step) {
    const sx = view.sx(x);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
    ctx.stroke();
  }
  for (let y = Math.ceil(world.y_min / step) * step; y <= world.y_max; y += step) {
    const sy = view.sy(y);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();
  }

  const floorY = view.sy(0);
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, floorY, w, h - floorY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, floorY - 6, w, 6);
  ctx.clip();
  const stripeW = 14;
  for (let x = -h; x < w + h; x += stripeW * 2) {
    ctx.fillStyle = COLORS.warningBand;
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x + stripeW, floorY);
    ctx.lineTo(x + stripeW + 6, floorY - 6);
    ctx.lineTo(x + 6, floorY - 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawObstacles(view, scene) {
  const { ctx } = view;
  for (const obs of scene.obstacles ?? []) {
    const [x, y] = view.toScreen(obs.x, obs.y + obs.h);
    const w = obs.w * view.scale;
    const h = obs.h * view.scale;
    ctx.fillStyle = COLORS.obstacle;
    ctx.strokeStyle = COLORS.obstacleEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(255,255,255,0.06)");
    grad.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }
}

function drawBins(view, scene, state) {
  const { ctx } = view;
  for (const bin of scene.bins) {
    const [x, y] = view.toScreen(bin.x, bin.y + bin.h);
    const w = bin.w * view.scale;
    const h = bin.h * view.scale;
    ctx.fillStyle = COLORS.binFill;
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = COLORS.bin;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.fillText(bin.id, x + 4, y + 12);

    if (state) {
      const placedHere = (state.placedParts ?? []).filter(pid => {
        const pos = state.partPositions?.[pid];
        if (!pos) return false;
        return pos.x >= bin.x && pos.x <= bin.x + bin.w && pos.y >= bin.y && pos.y <= bin.y + bin.h;
      });
      const cap = bin.capacity != null ? `/${bin.capacity}` : "";
      ctx.fillText(`${placedHere.length}${cap}`, x + w - 22, y + 12);
    }
  }
}

function drawPartNest(ctx, sx, sy, r) {
  ctx.save();
  ctx.fillStyle = COLORS.fixtureNest;
  ctx.strokeStyle = COLORS.fixtureNestEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(sx, sy + r * 0.08, r * 1.55, r * 1.18, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COLORS.fixtureNestInner;
  ctx.beginPath();
  ctx.ellipse(sx, sy + r * 0.1, r * 0.95, r * 0.7, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParts(view, scene, state) {
  const { ctx } = view;
  for (const part of scene.parts) {
    const pos = state?.partPositions?.[part.id] ?? { x: part.x, y: part.y };
    const r = (part.r ?? 0.025) * view.scale;
    const [sx, sy] = view.toScreen(pos.x, pos.y);
    const color = COLORS.partKinds[part.kind] ?? COLORS.partMissing;
    const placed = state?.placedParts?.includes(part.id);
    const held = state?.heldPart === part.id;

    if (!placed && !held) {
      drawPartNest(ctx, sx, sy, r);
      ctx.beginPath();
      ctx.ellipse(sx + 1, sy + 3, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fill();
    }

    const grad = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.35, r * 0.1, sx, sy, r);
    if (luminance(color) > 0.85) {
      grad.addColorStop(0, color);
      grad.addColorStop(1, darken(color, 0.28));
    } else {
      grad.addColorStop(0, lighten(color, 0.35));
      grad.addColorStop(1, color);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (state?.placedParts?.includes(part.id)) {
      ctx.strokeStyle = COLORS.gripperLED;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawArm(view, scene, state) {
  const { ctx } = view;
  const points = state.points;
  const arm = scene.arm;
  const linkPx = (arm.thickness ?? 0.015) * 2 * view.scale;

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = view.toScreen(points[i].x, points[i].y);
    const [x2, y2] = view.toScreen(points[i + 1].x, points[i + 1].y);
    ctx.fillStyle = COLORS.link;
    drawCapsule(ctx, x1, y1, x2, y2, linkPx);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const [cx, cy] = view.toScreen(points[i].x, points[i].y);
    const isBase = i === 0;
    const r = isBase ? linkPx * 0.95 : linkPx * 0.7;
    ctx.fillStyle = COLORS.jointCap;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.jointRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.jointHex;
    ctx.lineWidth = 1;
    drawHexagon(ctx, cx, cy, r * 0.45);
    ctx.stroke();
    if (isBase) {
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const ee = points[points.length - 1];
  const [ex, ey] = view.toScreen(ee.x, ee.y);
  const gripperR = (arm.gripper_radius ?? 0.04) * view.scale;
  ctx.fillStyle = COLORS.gripperBody;
  ctx.beginPath();
  ctx.arc(ex, ey, gripperR * 0.6, 0, Math.PI * 2);
  ctx.fill();
  const ledOn = state.gripper === "closed";
  ctx.shadowBlur = ledOn ? 18 : 6;
  ctx.shadowColor = COLORS.gripperLED;
  ctx.strokeStyle = ledOn ? COLORS.gripperLED : COLORS.gripperLEDDim;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(ex, ey, gripperR * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16)
  ];
}

function lighten(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${lr},${lg},${lb})`;
}

function darken(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return `rgb(${dr},${dg},${db})`;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function render(view, scene, state) {
  if (!scene._world) {
    scene._world = scene.world ?? { x_min: -1.0, x_max: 1.0, y_min: -0.05, y_max: 0.9 };
  }
  drawBackground(view, scene);
  drawBins(view, scene, state);
  drawObstacles(view, scene);
  drawParts(view, scene, state);
  drawArm(view, scene, state);
}
