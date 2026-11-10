/**
 * Side-view bestiary in the same pixel language as the bio-ships.
 * Everything faces left, toward the pilot. Wings, legs, and sacs animate from pattern time.
 */

import { Enemy } from './types';

function px(
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

function glowOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  core: string
) {
  const glow = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, 0.5, x, y, radius);
  glow.addColorStop(0, core);
  glow.addColorStop(0.5, color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, x - 1, y - 1, 2, 2, '#ffffff');
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = '#ef4444') {
  px(ctx, x - 1, y - 1, w + 2, h + 2, '#020617');
  px(ctx, x, y, w, h, color);
  px(ctx, x + w - 1, y, 1, 1, '#fee2e2');
}

function drawSwarmer(ctx: CanvasRenderingContext2D, time: number, color: string) {
  const brood = color === '#e879f9';
  const shell = brood
    ? ['#4a044e', '#86198f', '#c026d3', '#e879f9']
    : ['#0c4a6e', '#075985', '#0369a1', '#38bdf8'];
  const fin = brood ? '#f5d0fe' : '#e0f2fe';
  const bob = Math.sin(time * 7) * 1.4;

  px(ctx, 8, -7 + bob, 3, 3, shell[0]);
  px(ctx, 10, -5 + bob, 4, 2, fin);
  px(ctx, 8, 4 - bob, 3, 3, shell[0]);
  px(ctx, 10, 3 - bob, 4, 2, fin);

  shell.forEach((plate, index) => {
    const height = 11 - index;
    const x = 6 - index * 4;
    px(ctx, x, -height / 2, 5, height, '#020617');
    px(ctx, x + 1, -height / 2 + 1, 3, height - 2, plate);
    px(ctx, x + 1, -1, 3, 2, fin);
  });

  px(ctx, -14, -5, 10, 10, '#020617');
  px(ctx, -13, -4, 8, 8, shell[2]);
  px(ctx, -12, -3, 4, 3, fin);
  eye(ctx, -12, -1, 3, 3);
  px(ctx, -17, -1, 4, 2, fin);
}

function drawWasp(ctx: CanvasRenderingContext2D, time: number) {
  const flap = Math.sin(time * 18) > 0 ? 0 : 4;
  ctx.save();
  ctx.globalAlpha = 0.8;
  px(ctx, -2, -13 - flap, 16, 3, '#fef3c7');
  px(ctx, 2, -16 - flap, 11, 3, '#fde68a');
  px(ctx, 6, -19 - flap, 6, 3, '#fbbf24');
  px(ctx, 0, -12 - flap, 12, 1, '#b45309');
  px(ctx, -2, 10 + flap, 16, 3, '#fef3c7');
  px(ctx, 2, 13 + flap, 11, 3, '#fde68a');
  px(ctx, 6, 16 + flap, 6, 3, '#fbbf24');
  px(ctx, 0, 11 + flap, 12, 1, '#b45309');
  ctx.restore();

  const bands = ['#1c1917', '#b45309', '#1c1917', '#f59e0b', '#44403c'];
  bands.forEach((band, index) => {
    const height = 9 - Math.abs(2 - index);
    const x = 12 - index * 4;
    px(ctx, x, -height / 2, 5, height, '#020617');
    px(ctx, x + 1, -height / 2 + 1, 3, height - 2, band);
  });

  px(ctx, -5, -5, 10, 10, '#0c0a09');
  px(ctx, -4, -4, 8, 8, '#44403c');
  px(ctx, -3, -2, 5, 3, '#a8a29e');
  px(ctx, -12, -4, 8, 8, '#0c0a09');
  px(ctx, -11, -3, 6, 6, '#292524');
  eye(ctx, -12, -2, 3, 2, '#fb923c');
  eye(ctx, -12, 1, 3, 2, '#fb923c');
  px(ctx, -17, -1, 6, 2, '#fde68a');
  px(ctx, -19, 0, 3, 1, '#ffffff');
}

function drawCrawler(ctx: CanvasRenderingContext2D, time: number) {
  const step = Math.sin(time * 12);
  const legs = [-12, -4, 4, 10];
  legs.forEach((x, index) => {
    const reach = (index % 2 === 0 ? step : -step) * 2;
    px(ctx, x, 6, 3, 4, '#14532d');
    px(ctx, x + reach, 9, 3, 3, '#4ade80');
  });

  px(ctx, -15, -7, 30, 14, '#020617');
  px(ctx, -14, -6, 28, 12, '#14532d');
  px(ctx, -12, -5, 22, 7, '#166534');
  px(ctx, -8, -4, 12, 3, '#86efac');
  px(ctx, -6, -7, 4, 2, '#052e16');
  px(ctx, 4, -7, 4, 2, '#052e16');
  eye(ctx, -16, -3, 3, 2);
  eye(ctx, -16, 1, 3, 2);
  px(ctx, -20, -2, 5, 1, '#d9f99d');
  px(ctx, -20, 1, 5, 1, '#d9f99d');
}

function drawJelly(ctx: CanvasRenderingContext2D, time: number) {
  const pulse = Math.sin(time * 4);
  const rows: Array<[number, number, number]> = [
    [-3, -13, 6],
    [-6, -10, 12],
    [-9, -7, 18],
    [-11, -4, 22],
    [-11, -1, 22],
    [-8, 2, 16]
  ];
  for (const [x, y, w] of rows) {
    px(ctx, x - 1, y, w + 2, 3, '#3b0764');
    px(ctx, x, y, w, 3, '#7e22ce');
  }
  px(ctx, -5, -8, 10, 6, '#e9d5ff');
  px(ctx, -2, -7 + pulse, 4, 3, '#ffffff');
  px(ctx, -8, -6, 2, 2, '#c4b5fd');
  px(ctx, 6, -6, 2, 2, '#c4b5fd');

  for (let i = -8; i <= 8; i += 4) {
    const sway = Math.sin(time * 5 + i * 0.45) * 3;
    px(ctx, i + sway, 4, 2, 5, '#d8b4fe');
    px(ctx, i + sway * 1.5, 9, 2, 4, '#a855f7');
    px(ctx, i + sway * 1.7, 13, 2, 2, '#f0abfc');
  }
}

function drawCentipede(ctx: CanvasRenderingContext2D, time: number, head: boolean) {
  const step = Math.sin(time * 14);
  const joints = [-6, 2];
  for (const x of joints) {
    px(ctx, x, -8, 2, 4, '#3f6212');
    px(ctx, x + step, -11, 2, 3, '#84cc16');
    px(ctx, x, 5, 2, 4, '#3f6212');
    px(ctx, x - step, 8, 2, 3, '#84cc16');
  }

  px(ctx, -8, -6, 16, 12, '#020617');
  px(ctx, -7, -5, 14, 10, head ? '#4d7c0f' : '#365314');
  px(ctx, -5, -3, 8, 4, head ? '#bef264' : '#84cc16');
  px(ctx, -6, -6, 12, 1, '#ecfccb');

  if (head) {
    px(ctx, -14, -5, 8, 10, '#1a2e05');
    px(ctx, -13, -4, 6, 8, '#3f6212');
    eye(ctx, -14, -3, 3, 2);
    eye(ctx, -14, 1, 3, 2);
    const bite = Math.sin(time * 10) > 0 ? 1 : -1;
    px(ctx, -20, -3 + bite, 7, 2, '#fde047');
    px(ctx, -20, 1 - bite, 7, 2, '#facc15');
  } else {
    px(ctx, -1, -1, 3, 3, '#f7fee7');
  }
}

/** Fill a polygon as stacked pixel rows so it stays in the chunky sprite style. */
function pixelPoly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, color: string, rowH = 2) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  ctx.fillStyle = color;
  for (let y = Math.floor(minY); y < maxY; y += rowH) {
    const sy = y + rowH / 2;
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
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, rowH);
    }
  }
}

/** Pixel line for wing bones and veins. */
function pixelLine(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, size: number, color: string) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    px(ctx, ax + (bx - ax) * k - size / 2, ay + (by - ay) * k - size / 2, size, size, color);
  }
}

/**
 * One big membranous bat wing for the hive spitter. `dir` is -1 for the upper wing
 * and 1 for the lower wing. An arm bone runs out to a wrist, three finger bones fan
 * back from it, and the membrane hangs between them with scalloped edges.
 */
function drawSpitterWing(ctx: CanvasRenderingContext2D, time: number, dir: 1 | -1, rootY: number) {
  // Slow, heavy beat: fully spread, then folded to about a third.
  const beat = 0.5 + 0.5 * Math.sin(time * 6.5);
  const spread = 0.34 + 0.66 * beat;
  const sweep = (1 - beat) * 6;
  // Wing-local point: x runs back along the body, v runs outward from the root.
  const size = 1.35;
  const at = (x: number, v: number): [number, number] => [
    (x + sweep * (v / 34)) * size,
    rootY + dir * v * spread * size
  ];

  const shoulder = at(-2, 0);
  const wrist = at(-8, 18);
  const tips: Array<[number, number]> = [at(-4, 36), at(14, 31), at(28, 20), at(34, 7)];
  const root = at(24, 0);

  // Membrane outline with scallops sagging toward the wrist between finger tips.
  const outline: Array<[number, number]> = [shoulder, wrist, tips[0]];
  for (let i = 0; i < tips.length - 1; i++) {
    const [ax, ay] = tips[i];
    const [bx, by] = tips[i + 1];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    outline.push([mx + (wrist[0] - mx) * 0.32, my + (wrist[1] - my) * 0.32]);
    outline.push(tips[i + 1]);
  }
  outline.push([root[0] + 6, root[1] + dir * 2 * spread], root);

  ctx.save();
  ctx.globalAlpha = 0.9;
  pixelPoly(ctx, outline, '#3b0f05');
  // Inner membrane, warmer toward the edge, with a thin translucent glow band.
  const inner = outline.map(([x, y]): [number, number] => [x + (wrist[0] + 8 - x) * 0.14, y + (wrist[1] - y) * 0.14]);
  pixelPoly(ctx, inner, '#9a3412');
  const core = outline.map(([x, y]): [number, number] => [x + (wrist[0] + 8 - x) * 0.42, y + (wrist[1] - y) * 0.42]);
  pixelPoly(ctx, core, '#7c2d12');
  ctx.globalAlpha = 0.35 + 0.2 * beat;
  pixelPoly(ctx, inner.map(([x, y]): [number, number] => [x, y + dir * -1]), 'rgba(251, 146, 60, 0.35)');
  ctx.restore();

  // Veins from the root to each scallop, then the finger bones.
  for (let i = 3; i < outline.length - 2; i += 2) {
    pixelLine(ctx, root[0] - 6, root[1], outline[i][0], outline[i][1], 1, '#fdba74');
  }
  pixelLine(ctx, shoulder[0], shoulder[1], wrist[0], wrist[1], 3, '#451a03');
  pixelLine(ctx, shoulder[0] + 1, shoulder[1], wrist[0] + 1, wrist[1], 1, '#fde68a');
  for (const [tx, ty] of tips.slice(0, 3)) {
    pixelLine(ctx, wrist[0], wrist[1], tx, ty, 2, '#451a03');
  }
  // Claw hook on the wrist.
  px(ctx, wrist[0] - 3, wrist[1] + dir * 1 - 1, 3, 2, '#fef3c7');
  px(ctx, wrist[0] - 5, wrist[1] + dir * 2 - 1, 2, 2, '#fffbeb');

  // Faint warm glow where the membrane meets the body.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.2 + 0.18 * beat;
  px(ctx, -6, rootY + dir * 3, 22, 3, '#fb923c');
  ctx.restore();
}

function drawSpitter(ctx: CanvasRenderingContext2D, time: number) {
  // Big organic wings sit behind the body.
  drawSpitterWing(ctx, time, -1, -12);
  drawSpitterWing(ctx, time, 1, 7);

  const pulse = Math.sin(time * 7);
  const rows: Array<[number, number, number]> = [
    [-2, -12, 14],
    [-6, -9, 22],
    [-8, -5, 26],
    [-8, -1, 26],
    [-6, 3, 22],
    [-2, 6, 16]
  ];
  for (const [x, y, w] of rows) {
    px(ctx, x, y, w, 4, '#451a03');
    px(ctx, x + 1, y, w - 2, 3, '#b45309');
  }
  px(ctx, -2, -4, 12, 8, '#f59e0b');
  px(ctx, 0, -2 + pulse, 6, 4, '#fffbeb');
  eye(ctx, 6, -7, 3, 3, '#fde68a');
  eye(ctx, 6, 4, 3, 3, '#fde68a');

  px(ctx, -16, -4, 10, 8, '#292524');
  px(ctx, -18, -3, 6, 6, '#44403c');
  px(ctx, -22, -2, 6, 4, '#78350f');
  px(ctx, -24, -1, 4, 2, '#fde68a');
  if (pulse > 0.65) px(ctx, -26, 2, 2, 3, '#f59e0b');
}

function drawHornet(ctx: CanvasRenderingContext2D, time: number) {
  const flap = Math.sin(time * 14) * 5;
  ctx.save();
  ctx.globalAlpha = 0.78;
  px(ctx, -8, -30 + flap, 40, 6, '#fef3c7');
  px(ctx, 0, -36 + flap, 30, 6, '#fde68a');
  px(ctx, 8, -40 + flap, 16, 5, '#fbbf24');
  px(ctx, -4, -28 + flap, 34, 2, '#b45309');
  px(ctx, -8, 24 - flap, 40, 6, '#fef3c7');
  px(ctx, 0, 30 - flap, 30, 6, '#fde68a');
  px(ctx, 8, 35 - flap, 16, 5, '#fbbf24');
  px(ctx, -4, 26 - flap, 34, 2, '#b45309');
  ctx.restore();

  const bands = ['#18181b', '#d97706', '#18181b', '#f59e0b', '#27272a', '#b45309'];
  bands.forEach((band, index) => {
    const height = 16 - index;
    const x = 28 - index * 8;
    px(ctx, x, -height / 2, 9, height, '#020617');
    px(ctx, x + 1, -height / 2 + 2, 6, height - 4, band);
    px(ctx, x + 2, -2, 4, 2, '#fde68a');
  });

  px(ctx, -22, -12, 24, 24, '#0c0a09');
  px(ctx, -20, -10, 20, 20, '#292524');
  px(ctx, -16, -6, 12, 6, '#57534e');
  px(ctx, -34, -10, 14, 20, '#1c1917');
  eye(ctx, -36, -7, 6, 4, '#fb923c');
  eye(ctx, -36, 3, 6, 4, '#fb923c');

  const bite = Math.sin(time * 8) * 2;
  px(ctx, -48, -8 + bite, 14, 3, '#fde047');
  px(ctx, -44, -5 + bite, 8, 2, '#facc15');
  px(ctx, -48, 5 - bite, 14, 3, '#fde047');
  px(ctx, -44, 3 - bite, 8, 2, '#facc15');

  px(ctx, -24, -16, 16, 4, '#075985');
  px(ctx, -24, 12, 16, 4, '#075985');
  px(ctx, -28, -15, 4, 2, '#7dd3fc');
  px(ctx, -28, 13, 4, 2, '#7dd3fc');

  const flame = 6 + Math.sin(time * 30) * 3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  px(ctx, 34, -3, flame, 6, '#fb923c');
  px(ctx, 34, -1, flame * 0.7, 2, '#ffffff');
  ctx.restore();
}

function drawNautilus(ctx: CanvasRenderingContext2D, time: number) {
  for (let i = 0; i < 6; i++) {
    const rootY = -14 + i * 6;
    const wave = Math.sin(time * 5 + i) * 6;
    px(ctx, 18, rootY, 8, 3, '#065f46');
    px(ctx, 26, rootY + wave * 0.45, 8, 3, '#059669');
    px(ctx, 34, rootY + wave, 8, 3, '#34d399');
    px(ctx, 42, rootY + wave * 1.3, 4, 2, '#a7f3d0');
  }

  const coils: Array<[number, number, number, number, string]> = [
    [-6, -20, 36, 8, '#1e1b4b'],
    [-16, -14, 50, 8, '#312e81'],
    [-24, -6, 58, 8, '#1e1b4b'],
    [-24, 2, 56, 8, '#064e3b'],
    [-16, 10, 46, 8, '#065f46'],
    [-6, 16, 32, 6, '#022c22']
  ];
  for (const [x, y, w, h, color] of coils) {
    px(ctx, x, y, w, h, '#020617');
    px(ctx, x + 2, y + 1, w - 4, h - 2, color);
  }
  px(ctx, -18, -8, 28, 2, '#6ee7b7');
  px(ctx, -10, 0, 20, 2, '#34d399');
  px(ctx, -4, 8, 14, 2, '#a7f3d0');

  glowOrb(ctx, -6, -8, 5, '#4ade80', '#ecfccb');
  glowOrb(ctx, -8, 6, 4, '#4ade80', '#ecfccb');
  glowOrb(ctx, -16, 0, 6, '#86efac', '#f0fdf4');

  px(ctx, -36, -8, 16, 16, '#022c22');
  px(ctx, -34, -6, 12, 12, '#064e3b');
  eye(ctx, -34, -3, 7, 6);
  px(ctx, -40, -1, 6, 2, '#fef9c3');
}

function drawBossCentipede(ctx: CanvasRenderingContext2D, time: number) {
  const step = Math.sin(time * 10);
  for (let i = 0; i < 5; i++) {
    const swing = Math.sin(time * 9 + i) * 2;
    px(ctx, -18 + i * 14, -32, 4, 8, '#14532d');
    px(ctx, -16 + i * 14 + swing, -38, 3, 6, '#4ade80');
    px(ctx, -18 + i * 14, 24, 4, 8, '#14532d');
    px(ctx, -16 + i * 14 - swing, 30, 3, 6, '#4ade80');
  }

  const rows: Array<[number, number, number, string]> = [
    [-28, -30, 72, '#052e16'],
    [-36, -24, 88, '#14532d'],
    [-44, -17, 100, '#166534'],
    [-48, -10, 106, '#15803d'],
    [-48, -3, 108, '#22c55e'],
    [-46, 4, 102, '#16a34a'],
    [-40, 11, 92, '#166534'],
    [-32, 18, 78, '#14532d'],
    [-24, 24, 62, '#052e16']
  ];
  for (const [x, y, w, color] of rows) px(ctx, x, y, w, 8, color);
  for (let i = 0; i < 4; i++) px(ctx, -22 + i * 20, -22, 2, 46, '#022c22');
  px(ctx, -36, -14, 72, 3, '#bbf7d0');

  px(ctx, -62, -16, 20, 32, '#052e16');
  px(ctx, -60, -14, 16, 28, '#166534');
  const eyes: Array<[number, number]> = [
    [-58, -12], [-58, -5], [-58, 2], [-58, 9], [-50, -16], [-50, 12]
  ];
  for (const [x, y] of eyes) eye(ctx, x, y, 4, 3);

  const bite = step * 2;
  px(ctx, -78, -12 + bite, 18, 4, '#fde047');
  px(ctx, -72, -8 + bite, 10, 3, '#facc15');
  px(ctx, -78, 8 - bite, 18, 4, '#fde047');
  px(ctx, -72, 5 - bite, 10, 3, '#facc15');

  const sac = 7 + Math.sin(time * 3);
  glowOrb(ctx, 40, -14, sac, '#4ade80', '#ecfccb');
  glowOrb(ctx, 44, 14, sac * 0.85, '#4ade80', '#ecfccb');
  glowOrb(ctx, 52, 0, sac + 2, '#86efac', '#f0fdf4');
}

function drawBossBrood(ctx: CanvasRenderingContext2D, time: number) {
  const flap = Math.sin(time * 6) * 3;
  ctx.save();
  ctx.globalAlpha = 0.55;
  px(ctx, -20, -40 + flap, 56, 8, '#f5d0fe');
  px(ctx, -8, -46 + flap, 40, 7, '#e879f9');
  px(ctx, -4, -42 + flap, 36, 2, '#fae8ff');
  px(ctx, -20, 32 - flap, 56, 8, '#f5d0fe');
  px(ctx, -8, 39 - flap, 40, 7, '#e879f9');
  px(ctx, -4, 36 - flap, 36, 2, '#fae8ff');
  ctx.restore();

  const rows: Array<[number, number, number, string]> = [
    [-20, -26, 64, '#4a044e'],
    [-32, -20, 84, '#701a75'],
    [-40, -12, 96, '#86198f'],
    [-44, -4, 102, '#c026d3'],
    [-44, 4, 102, '#a21caf'],
    [-38, 12, 92, '#86198f'],
    [-28, 20, 74, '#701a75']
  ];
  for (const [x, y, w, color] of rows) px(ctx, x, y, w, 8, color);
  px(ctx, -30, -8, 48, 16, '#f0abfc');
  px(ctx, -22, -4, 28, 6, '#fdf4ff');

  const pulse = 5 + Math.sin(time * 4) * 1.5;
  glowOrb(ctx, 22, -14, pulse, '#f9a8d4', '#fff1f2');
  glowOrb(ctx, 26, 14, pulse * 0.8, '#f0abfc', '#fdf4ff');
  glowOrb(ctx, 38, 0, pulse * 0.9, '#e879f9', '#fae8ff');

  eye(ctx, -36, -8, 5, 4, '#fef08a');
  eye(ctx, -38, -1, 6, 4, '#fde047');
  eye(ctx, -36, 6, 5, 4, '#fef08a');

  const bite = Math.sin(time * 7);
  px(ctx, -62, -10 + bite, 20, 4, '#fbcfe8');
  px(ctx, -56, -6 + bite, 12, 3, '#f9a8d4');
  px(ctx, -62, 6 - bite, 20, 4, '#fbcfe8');
  px(ctx, -56, 3 - bite, 12, 3, '#f9a8d4');
}

function drawBossHive(ctx: CanvasRenderingContext2D, time: number) {
  const crown = Math.sin(time * 3) * 3;
  px(ctx, -2, -48 + crown, 8, 10, '#b45309');
  px(ctx, 2, -56 + crown, 8, 14, '#f59e0b');
  px(ctx, 10, -48 + crown, 8, 10, '#b45309');
  px(ctx, 4, -44, 6, 8, '#fde68a');

  const rows: Array<[number, number, number, string]> = [
    [-16, -30, 64, '#78350f'],
    [-28, -22, 84, '#92400e'],
    [-38, -14, 100, '#b45309'],
    [-42, -6, 108, '#f59e0b'],
    [-42, 2, 108, '#d97706'],
    [-36, 10, 98, '#b45309'],
    [-26, 18, 80, '#92400e'],
    [-16, 26, 60, '#78350f']
  ];
  for (const [x, y, w, color] of rows) px(ctx, x, y, w, 8, color);

  ctx.strokeStyle = '#fffbeb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(4, -16);
  ctx.lineTo(26, 0);
  ctx.lineTo(4, 16);
  ctx.closePath();
  ctx.stroke();
  px(ctx, 2, -2, 5, 4, '#fef3c7');

  glowOrb(ctx, -22, 0, 9, '#ef4444', '#fecaca');
  px(ctx, -24, -2, 4, 4, '#450a0a');

  const cells: Array<[number, number]> = [
    [24, -16], [34, -4], [24, 8], [40, 10]
  ];
  for (const [x, y] of cells) {
    px(ctx, x, y, 8, 8, '#fde68a');
    px(ctx, x + 2, y + 2, 4, 4, '#fffbeb');
  }

  for (let i = 0; i < 3; i++) {
    const drip = (time * 10 + i * 7) % 10;
    px(ctx, 8 + i * 10, 30, 2, 3 + drip, '#fbbf24');
  }
}

function drawMoth(ctx: CanvasRenderingContext2D, time: number) {
  // Faint dusty halo so the swarm reads against the dark cavern.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
  halo.addColorStop(0, 'rgba(233, 213, 255, 0.28)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Three-frame flap: open, half, folded.
  const beat = Math.sin(time * 22);
  const lift = beat > 0.35 ? 0 : beat > -0.35 ? 3 : 6;
  const span = 7 - lift;
  ctx.save();
  ctx.globalAlpha = 0.9;
  // Upper wing
  px(ctx, -3, -3 - span, 11, span, '#57534e');
  px(ctx, -2, -3 - span, 9, Math.max(1, span - 1), '#d6d3d1');
  px(ctx, 0, -4 - span, 6, 2, '#e7e5e4');
  if (span > 3) px(ctx, 2, -1 - span, 2, 2, '#a855f7');
  // Lower wing
  px(ctx, -3, 3, 11, span, '#57534e');
  px(ctx, -2, 4, 9, Math.max(1, span - 1), '#d6d3d1');
  px(ctx, 0, 2 + span, 6, 2, '#e7e5e4');
  if (span > 3) px(ctx, 2, -1 + span, 2, 2, '#a855f7');
  ctx.restore();

  // Fuzzy segmented body
  px(ctx, -5, -3, 14, 6, '#1c1917');
  px(ctx, -4, -2, 5, 4, '#a8a29e');
  px(ctx, 1, -2, 3, 4, '#78716c');
  px(ctx, 4, -2, 3, 4, '#a8a29e');
  px(ctx, 7, -1, 2, 2, '#78716c');
  px(ctx, -3, -2, 3, 1, '#f5f5f4');

  // Head, glowing eyes, feathery antennae reaching toward the light
  px(ctx, -8, -2, 4, 4, '#1c1917');
  px(ctx, -7, -1, 2, 2, '#e9d5ff');
  const twitch = Math.sin(time * 9) > 0 ? 0 : 1;
  px(ctx, -11, -4 - twitch, 4, 1, '#d6d3d1');
  px(ctx, -12, -5 - twitch, 2, 1, '#f5f5f4');
  px(ctx, -11, 3 + twitch, 4, 1, '#d6d3d1');
  px(ctx, -12, 4 + twitch, 2, 1, '#f5f5f4');
}

export function drawEnemySprite(ctx: CanvasRenderingContext2D, enemy: Enemy, flipY: boolean) {
  ctx.save();
  if (flipY) ctx.scale(1, -1);
  const time = enemy.patternParam;

  switch (enemy.type) {
    case 'swarmer':
      drawSwarmer(ctx, time, enemy.color);
      break;
    case 'wasp':
      drawWasp(ctx, time);
      break;
    case 'crawler':
      drawCrawler(ctx, time);
      break;
    case 'jelly':
      drawJelly(ctx, time);
      break;
    case 'dread_hornet':
      drawHornet(ctx, time);
      break;
    case 'nautilus_carrier':
      drawNautilus(ctx, time);
      break;
    case 'centipede_segment':
      drawCentipede(ctx, time, (enemy.chainIndex ?? 0) === 0);
      break;
    case 'hive_spitter':
      drawSpitter(ctx, time);
      break;
    case 'boss_centipede':
      drawBossCentipede(ctx, time);
      break;
    case 'boss_brood':
      drawBossBrood(ctx, time);
      break;
    case 'boss_hive':
      drawBossHive(ctx, time);
      break;
    case 'moth':
      drawMoth(ctx, time);
      break;
    default:
      px(ctx, -8, -6, 16, 12, '#334155');
      eye(ctx, -6, -2, 3, 3);
      break;
  }

  ctx.restore();
}
