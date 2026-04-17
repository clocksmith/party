// Small fixed-size ring buffer + sparkline renderer.
// Used by the canvas overlay to show trailing-window metrics during playback.

export function createRingBuffer(size) {
  return { data: new Float32Array(size), head: 0, count: 0, size };
}

export function pushRing(buf, v) {
  buf.data[buf.head] = v;
  buf.head = (buf.head + 1) % buf.size;
  if (buf.count < buf.size) buf.count += 1;
}

export function clearRing(buf) {
  buf.head = 0;
  buf.count = 0;
}

export function drawSpark(ctx, buf, opts) {
  const { width, height, min, max } = opts;
  ctx.clearRect(0, 0, width, height);

  // subtle baseline at 0 if zero is in range
  if (min < 0 && max > 0) {
    const zy = height - ((0 - min) / (max - min)) * height;
    ctx.strokeStyle = "rgba(240,240,242,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, zy + 0.5);
    ctx.lineTo(width, zy + 0.5);
    ctx.stroke();
  }

  if (buf.count < 2) return;

  const n = buf.count;
  const start = buf.count === buf.size ? buf.head : 0;
  const range = max - min || 1;

  ctx.strokeStyle = opts.stroke ?? "#f0f0f2";
  ctx.lineWidth = opts.lineWidth ?? 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % buf.size;
    const v = buf.data[idx];
    const x = (i / Math.max(1, n - 1)) * width;
    const clamped = Math.max(min, Math.min(max, v));
    const y = height - ((clamped - min) / range) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // mark the newest value with a small dot
  if (n >= 1) {
    const lastIdx = (start + n - 1) % buf.size;
    const v = buf.data[lastIdx];
    const clamped = Math.max(min, Math.min(max, v));
    const x = width - 1;
    const y = height - ((clamped - min) / range) * height;
    ctx.fillStyle = opts.stroke ?? "#f0f0f2";
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
