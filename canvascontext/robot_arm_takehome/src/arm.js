// Forward and inverse kinematics for an n-joint planar revolute arm.
// All angles in radians, relative to the previous link.

export function fk(angles, lengths, base = { x: 0, y: 0 }) {
  const points = [{ x: base.x, y: base.y }];
  let theta = 0;
  let x = base.x;
  let y = base.y;
  for (let i = 0; i < angles.length; i++) {
    theta += angles[i];
    x += lengths[i] * Math.cos(theta);
    y += lengths[i] * Math.sin(theta);
    points.push({ x, y });
  }
  return points;
}

export function endEffector(angles, lengths, base) {
  const pts = fk(angles, lengths, base);
  return pts[pts.length - 1];
}

export function reach(lengths) {
  return lengths.reduce((s, l) => s + l, 0);
}

// Damped least squares IK seeded from currentAngles. Deterministic:
// on stagnation, restarts from a sequence of fixed seed poses and returns
// the best solution found.
export function ik(targetX, targetY, currentAngles, lengths, opts = {}) {
  const base = opts.base ?? { x: 0, y: 0 };
  const tol = opts.tol ?? 2e-3;
  const limits = opts.limits ?? null;

  const seeds = [currentAngles.slice()];
  const n = currentAngles.length;
  for (let k = 0; k < 6; k++) {
    const s = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = (k * 0.7 + i * 1.1) % (2 * Math.PI);
      s[i] = a - Math.PI + (i === 0 ? 1.0 : 0);
      if (limits && limits[i]) s[i] = Math.max(limits[i][0], Math.min(limits[i][1], s[i]));
    }
    seeds.push(s);
  }

  let best = null;
  for (const seed of seeds) {
    const r = _solveIK(targetX, targetY, seed, lengths, base, limits, opts);
    if (r.converged) return r;
    if (!best || r.error < best.error) best = r;
  }
  return best;
}

function _solveIK(targetX, targetY, seed, lengths, base, limits, opts) {
  const maxIter = opts.maxIter ?? 400;
  const tol = opts.tol ?? 2e-3;
  const damping = opts.damping ?? 0.03;
  const maxStep = opts.maxStep ?? 0.15;
  const angles = seed.slice();
  const n = angles.length;
  let lastErr = Infinity;
  let stag = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    const pts = fk(angles, lengths, base);
    const ee = pts[n];
    const dx = targetX - ee.x;
    const dy = targetY - ee.y;
    const err = Math.hypot(dx, dy);
    if (err < tol) return { angles, converged: true, iterations: iter, error: err };
    if (Math.abs(lastErr - err) < 1e-6) { stag += 1; if (stag > 20) break; } else { stag = 0; }
    lastErr = err;

    let JJtxx = damping * damping;
    let JJtyy = damping * damping;
    let JJtxy = 0;
    const J = new Array(n);
    for (let i = 0; i < n; i++) {
      const ax = ee.x - pts[i].x;
      const ay = ee.y - pts[i].y;
      J[i] = [-ay, ax];
      JJtxx += J[i][0] * J[i][0];
      JJtyy += J[i][1] * J[i][1];
      JJtxy += J[i][0] * J[i][1];
    }
    const det = JJtxx * JJtyy - JJtxy * JJtxy;
    if (!isFinite(det) || Math.abs(det) < 1e-18) break;
    const ixx = JJtyy / det;
    const iyy = JJtxx / det;
    const ixy = -JJtxy / det;
    const zx = ixx * dx + ixy * dy;
    const zy = ixy * dx + iyy * dy;

    for (let i = 0; i < n; i++) {
      let dt = J[i][0] * zx + J[i][1] * zy;
      if (dt > maxStep) dt = maxStep;
      if (dt < -maxStep) dt = -maxStep;
      angles[i] += dt;
      if (limits && limits[i]) {
        angles[i] = Math.max(limits[i][0], Math.min(limits[i][1], angles[i]));
      }
    }
  }

  const ee = endEffector(angles, lengths, base);
  const err = Math.hypot(targetX - ee.x, targetY - ee.y);
  return { angles, converged: err < tol, iterations: maxIter, error: err };
}
