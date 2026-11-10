/**
 * Sprites for the four organisms in the Genetic Mutation Lab vats, turned to face right.
 * Orestes flies as the blue serpent, Electra as the green spawn-wing,
 * Hiob as the horned carapace, and Pyron as the glow-stalker.
 * Both the lab preview and the arcade canvas call this so they stay the same ship.
 */

type Pt = [number, number];

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  outline = '#020617'
) {
  dot(ctx, x - 1, y - 1, w + 2, h + 2, outline);
  dot(ctx, x, y, w, h, fill);
}

/** Fill a polygon as 1px pixel rows so it keeps the chunky look. */
function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  ctx.fillStyle = color;
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    const hits: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
        hits.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const x0 = Math.round(hits[i]);
      const x1 = Math.round(hits[i + 1]);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }
}

/** Outlined polygon: a dark rim one pixel out, then the fill. */
function shape(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string, rim = '#020617') {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const grow = pts.map(([x, y]): Pt => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * 1.2, y + (dy / d) * 1.2];
  });
  poly(ctx, grow, rim);
  poly(ctx, pts, fill);
}

function line(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, size: number, color: string) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    dot(ctx, ax + (bx - ax) * k - size / 2, ay + (by - ay) * k - size / 2, size, size, color);
  }
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -ry; y < ry; y++) {
    const k = (y + 0.5) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - k * k));
    if (half < 0.5) continue;
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), Math.max(1, Math.round(half * 2)), 1);
  }
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= alpha;
  blob(ctx, x, y, r, r, color);
  ctx.restore();
}

/** Mirror a list of points across the body's center line. */
function flipY(pts: Pt[]): Pt[] {
  return pts.map(([x, y]): Pt => [x, -y]);
}

// ---------------------------------------------------------------------------
// Electra: green spawn-wing. Jagged spread wings, horned head, orange core.
// ---------------------------------------------------------------------------
function drawSpawnWing(ctx: CanvasRenderingContext2D, time: number) {
  const beat = 0.5 + 0.5 * Math.sin(time * 9);
  const s = 0.55 + 0.45 * beat;

  // Hind wings (smaller, behind the main pair)
  const hind: Pt[] = [[-1, -3], [-6, -10 * s], [-9, -15 * s], [-12, -11 * s], [-15, -13 * s], [-14, -7 * s], [-10, -3]];
  for (const pts of [hind, flipY(hind)]) shape(ctx, pts, '#15803d', '#052e16');

  // Main wings with a jagged, spiky outer edge
  const wing: Pt[] = [
    [9, -4], [12, -11 * s], [10, -15 * s], [13, -21 * s], [7, -19 * s], [5, -25 * s],
    [1, -20 * s], [-3, -24 * s], [-4, -17 * s], [-8, -19 * s], [-5, -10 * s], [-2, -4]
  ];
  for (const pts of [wing, flipY(wing)]) {
    shape(ctx, pts, '#16a34a', '#052e16');
    const dir = pts === wing ? -1 : 1;
    // Inner membrane and veins
    poly(ctx, pts.map(([x, y]): Pt => [x * 0.75 + 1, y * 0.7]), '#22c55e');
    line(ctx, 4, dir * 4, 5, dir * 22 * s, 1, '#86efac');
    line(ctx, 2, dir * 4, -2, dir * 20 * s, 1, '#4ade80');
    line(ctx, 6, dir * 4, 11, dir * 17 * s, 1, '#4ade80');
  }

  // Spiky segmented abdomen trailing back to a barbed tail
  for (let i = 0; i < 5; i++) {
    const x = -4 - i * 5;
    const h = 8 - i;
    plate(ctx, x, -h / 2, 5, h, i % 2 === 0 ? '#166534' : '#15803d', '#052e16');
    dot(ctx, x + 1, -h / 2 - 2, 2, 2, '#14532d');
    dot(ctx, x + 1, h / 2, 2, 2, '#14532d');
  }
  dot(ctx, -29, -1, 4, 2, '#bbf7d0');
  dot(ctx, -31, -3, 2, 2, '#86efac');
  dot(ctx, -31, 1, 2, 2, '#86efac');

  // Thorax with the glowing orange core
  blob(ctx, 4, 0, 8, 6, '#052e16');
  blob(ctx, 4, 0, 7, 5, '#15803d');
  dot(ctx, 0, -3, 7, 1, '#4ade80');
  const pulse = 0.6 + 0.4 * Math.sin(time * 6);
  glow(ctx, 4, 0, 4, '#fb923c', 0.5 * pulse);
  plate(ctx, 2, -2, 4, 4, '#ea580c', '#7c2d12');
  dot(ctx, 3, -1, 2, 2, '#fde68a');

  // Head, orange eyes, and forward-curving horns
  blob(ctx, 13, 0, 5, 5, '#052e16');
  blob(ctx, 13, 0, 4, 4, '#166534');
  dot(ctx, 14, -3, 2, 2, '#f97316');
  dot(ctx, 14, 1, 2, 2, '#f97316');
  dot(ctx, 15, -3, 1, 1, '#fef08a');
  dot(ctx, 15, 1, 1, 1, '#fef08a');
  line(ctx, 15, -4, 20, -8, 2, '#14532d');
  line(ctx, 20, -8, 24, -7, 1, '#bbf7d0');
  line(ctx, 15, 4, 20, 8, 2, '#14532d');
  line(ctx, 20, 8, 24, 7, 1, '#bbf7d0');
  dot(ctx, 17, -1, 4, 2, '#4ade80');
}

// ---------------------------------------------------------------------------
// Hiob: crimson horned carapace. Cyan-tipped claws forward, three purple thrusters.
// ---------------------------------------------------------------------------
function drawCarapace(ctx: CanvasRenderingContext2D, time: number) {
  // Three thrusters with flickering purple flames
  const nozzles: Array<[number, number]> = [[-8, 1], [0, 1.3], [8, 1]];
  nozzles.forEach(([y, len], i) => {
    const flick = 5 + Math.abs(Math.sin(time * 26 + i * 1.7)) * 6;
    const f = flick * len;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    dot(ctx, -19 - f, y - 2, f, 4, '#a21caf');
    dot(ctx, -19 - f * 0.75, y - 1, f * 0.75, 2, '#e879f9');
    dot(ctx, -19 - f * 0.35, y - 1, f * 0.35, 2, '#fae8ff');
    ctx.restore();
    plate(ctx, -19, y - 3, 5, 6, '#1f2937', '#020617');
    dot(ctx, -18, y - 2, 3, 1, '#4b5563');
    dot(ctx, -15, y - 2, 2, 4, '#14532d');
  });

  // Armored shell built from stacked crimson plates
  const shell: Pt[] = [[-15, -9], [-9, -14], [0, -15], [8, -13], [13, -8], [15, 0], [13, 8], [8, 13], [0, 15], [-9, 14], [-15, 9]];
  shape(ctx, shell, '#881337', '#1c0a0f');
  poly(ctx, shell.map(([x, y]): Pt => [x * 0.8, y * 0.8]), '#9f1239');
  poly(ctx, shell.map(([x, y]): Pt => [x * 0.5 + 1, y * 0.55]), '#be123c');
  // Plate seams
  line(ctx, -12, -6, 10, -6, 1, '#4c0519');
  line(ctx, -12, 6, 10, 6, 1, '#4c0519');
  line(ctx, -3, -13, -3, 13, 1, '#4c0519');
  line(ctx, 5, -12, 5, 12, 1, '#4c0519');
  dot(ctx, -8, -11, 8, 1, '#fb7185');
  dot(ctx, -1, -3, 5, 1, '#fda4af');

  // Magenta orbs and green gems on the flanks
  for (const dir of [-1, 1]) {
    plate(ctx, -9, dir * 12 - 2, 4, 4, '#c026d3', '#4a044e');
    dot(ctx, -8, dir * 12 - 1, 1, 1, '#fae8ff');
    plate(ctx, 2, dir * 13 - 2, 4, 4, '#be185d', '#4a044e');
    dot(ctx, 3, dir * 13 - 1, 1, 1, '#fce7f3');
    plate(ctx, 9, dir * 9 - 1, 3, 3, '#15803d', '#052e16');
  }

  // Head with a cyan visor
  shape(ctx, [[12, -6], [18, -5], [21, 0], [18, 5], [12, 6]], '#7f1d1d', '#1c0a0f');
  dot(ctx, 16, -3, 3, 6, '#22d3ee');
  dot(ctx, 17, -2, 1, 2, '#ecfeff');

  // Big curved claws reaching forward, cyan tipped
  const snap = Math.sin(time * 4) * 1.2;
  for (const dir of [-1, 1]) {
    const claw: Pt[] = [
      [8, dir * 10], [14, dir * 15], [21, dir * (17 + snap)], [27, dir * (14 + snap)],
      [29, dir * (9 + snap)], [25, dir * (11 + snap)], [20, dir * (12 + snap)], [14, dir * 9]
    ];
    shape(ctx, claw, '#9f1239', '#1c0a0f');
    line(ctx, 13, dir * 12, 20, dir * (14 + snap), 1, '#e11d48');
    line(ctx, 26, dir * (13 + snap), 29, dir * (9 + snap), 2, '#22d3ee');
    dot(ctx, 29, dir * (9 + snap) - 1, 2, 2, '#a5f3fc');
    // Inner pincer
    line(ctx, 18, dir * 10, 23, dir * (8 + snap * 0.5), 2, '#881337');
    dot(ctx, 23, dir * (8 + snap * 0.5) - 1, 2, 2, '#67e8f9');
  }
}

// ---------------------------------------------------------------------------
// Orestes: blue segmented serpent. Fin-ridged head, scaled body, curled tail.
// ---------------------------------------------------------------------------
function drawSerpent(ctx: CanvasRenderingContext2D, time: number) {
  const wave = (i: number) => Math.sin(time * 6 + i * 0.6) * 3.2;

  // Curled tail tip behind the last segment
  const tailY = wave(9);
  const curl = Math.sin(time * 4) * 1.5;
  plate(ctx, -36, tailY - 1, 5, 6, '#1d4ed8', '#0b1d4a');
  plate(ctx, -40, tailY + 3 + curl * 0.5, 5, 5, '#2563eb', '#0b1d4a');
  plate(ctx, -40, tailY + 8 + curl, 4, 4, '#1d4ed8', '#0b1d4a');
  plate(ctx, -36, tailY + 11 + curl, 3, 3, '#2563eb', '#0b1d4a');
  dot(ctx, -39, tailY + 6 + curl * 0.5, 3, 1, '#2dd4bf');
  dot(ctx, -33, tailY + 12 + curl, 2, 1, '#7dd3fc');

  // Body segments, tail to neck
  for (let i = 8; i >= 0; i--) {
    const x = 9 - i * 5;
    const y = wave(i);
    const h = Math.max(6, 13 - i);
    plate(ctx, x, y - h / 2, 6, h, i % 2 === 0 ? '#1d4ed8' : '#2563eb', '#0b1d4a');
    // Scale highlights and the pale teal belly
    dot(ctx, x + 1, y - h / 2 + 1, 2, 2, '#60a5fa');
    dot(ctx, x + 3, y - h / 2 + 2, 2, 1, '#3b82f6');
    dot(ctx, x, y + h / 2 - 3, 6, 2, '#2dd4bf');
    dot(ctx, x + 1, y + h / 2 - 2, 3, 1, '#99f6e4');
    // Dorsal fin ridge
    const finH = i < 6 ? 4 : 2;
    dot(ctx, x + 2, y - h / 2 - finH, 2, finH, '#38bdf8');
    dot(ctx, x + 2, y - h / 2 - finH, 1, 1, '#e0f2fe');
    // Small side fins on alternate segments
    if (i % 3 === 1) {
      line(ctx, x + 3, y + h / 2, x - 1, y + h / 2 + 4, 2, '#0ea5e9');
    }
  }

  // Head with a fin crest, tan horns, and orange eye
  const hy = wave(-1);
  shape(ctx, [[12, hy - 6], [20, hy - 6], [27, hy - 2], [28, hy + 2], [20, hy + 6], [12, hy + 6]], '#1d4ed8', '#0b1d4a');
  dot(ctx, 13, hy - 4, 9, 2, '#3b82f6');
  dot(ctx, 14, hy + 3, 10, 2, '#2dd4bf');
  for (let k = 0; k < 3; k++) {
    dot(ctx, 13 + k * 3, hy - 9 + k, 2, 4 - k, '#38bdf8');
  }
  line(ctx, 16, hy - 6, 11, hy - 11, 1, '#d6d3d1');
  line(ctx, 18, hy - 6, 14, hy - 12, 1, '#e7e5e4');
  dot(ctx, 21, hy - 3, 3, 2, '#f97316');
  dot(ctx, 22, hy - 3, 1, 1, '#fef08a');
  dot(ctx, 26, hy + 1, 3, 1, '#082f49');
}

// ---------------------------------------------------------------------------
// Pyron: purple glow-stalker. Round body, ring of orange eyes, pink core,
// many curling tentacles trailing back, cyan thruster wisps.
// ---------------------------------------------------------------------------
function drawGlowStalker(ctx: CanvasRenderingContext2D, time: number) {
  // Cyan thruster wisps behind the body
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const len = 6 + Math.abs(Math.sin(time * 18 + k * 2)) * 6;
    const y = (k - 1) * 3 + Math.sin(time * 7 + k) * 1;
    dot(ctx, -12 - len, y, len, 1, '#22d3ee');
    dot(ctx, -12 - len * 0.5, y, len * 0.5, 1, '#a5f3fc');
  }
  ctx.restore();

  // Tentacles fanning back and curling, some tipped teal like in the vat
  const roots = [-2.0, -1.65, -1.25, -0.6, 0.6, 1.25, 1.65, 2.0, 2.45, -2.45];
  roots.forEach((r, i) => {
    const base = Math.PI + r * 0.9;
    const sway = Math.sin(time * 3.2 + i * 0.9);
    const curlDir = r < 0 ? -1 : 1;
    let px = Math.cos(base) * 8;
    let py = Math.sin(base) * 8;
    let angle = base;
    const segs = 9;
    for (let s = 1; s <= segs; s++) {
      angle += curlDir * (0.12 + 0.1 * sway) * (s / segs) * 2.2;
      const nx = px + Math.cos(angle) * 2.6;
      const ny = py + Math.sin(angle) * 2.6;
      const size = s < 4 ? 3 : 2;
      const teal = i % 3 === 0 && s > 5;
      line(ctx, px, py, nx, ny, size, teal ? '#0891b2' : (s % 2 ? '#5b21b6' : '#6d28d9'));
      if (s === 3) dot(ctx, nx - 1, ny - 1, 2, 2, '#7c3aed');
      px = nx;
      py = ny;
    }
    dot(ctx, px - 1, py - 1, 2, 2, i % 3 === 0 ? '#67e8f9' : '#c4b5fd');
  });

  // Small horns on the front of the mantle
  line(ctx, 8, -6, 13, -9, 2, '#3b0764');
  line(ctx, 8, 6, 13, 9, 2, '#3b0764');
  dot(ctx, 13, -10, 2, 2, '#a78bfa');
  dot(ctx, 13, 9, 2, 2, '#a78bfa');

  // Dark round body
  blob(ctx, 0, 0, 12, 11, '#020617');
  blob(ctx, 0, 0, 11, 10, '#2e1065');
  blob(ctx, 1, -1, 9, 8, '#3b0764');
  dot(ctx, -5, -8, 9, 1, '#6d28d9');
  dot(ctx, -6, 6, 10, 1, '#1e1b4b');

  // Ring of glowing orange eyes
  const blink = Math.sin(time * 1.3) > 0.97;
  const eyes: Pt[] = [[6, -6], [8, 1], [4, 6], [-3, 8], [-6, -6], [0, -9], [-8, 2]];
  eyes.forEach(([x, y], i) => {
    plate(ctx, x - 1, y - 1, 3, 3, blink && i % 2 === 0 ? '#3b0764' : '#f97316', '#1e1b4b');
    if (!(blink && i % 2 === 0)) dot(ctx, x, y - 1, 1, 1, '#fef08a');
  });

  // Pink core with a yellow heart
  const pulse = 0.6 + 0.4 * Math.sin(time * 8);
  glow(ctx, 0, 0, 6, '#f0abfc', 0.45 * pulse);
  blob(ctx, 0, 0, 4, 4, '#db2777');
  blob(ctx, 0, 0, 3, 3, '#f472b6');
  dot(ctx, -1, -1, 2, 2, '#fde047');
}

export function drawBioShip(ctx: CanvasRenderingContext2D, shipId: string, time: number) {
  if (shipId === 'electra') drawSpawnWing(ctx, time);
  else if (shipId === 'hiob') drawCarapace(ctx, time);
  else if (shipId === 'pyron') drawGlowStalker(ctx, time);
  else drawSerpent(ctx, time);
}
