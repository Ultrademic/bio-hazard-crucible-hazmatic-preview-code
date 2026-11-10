/**
 * Living-tissue parallax for the three crucible sectors.
 * Strong shapes stay on the walls so the lane in the middle stays readable.
 */

export interface BiomeFrame {
  width: number;
  height: number;
  stage: number;
  stars: number;
  hills: number;
  cavern: number;
  foreground: number;
  time: number;
}

interface BiomePalette {
  top: string;
  throat: string;
  bot: string;
  far: string;
  wallBack: string;
  wall: string;
  shade: string;
  rim: string;
  vein: string;
  glow: string;
  core: string;
  mote: string;
  mist: string;
}

const BIOMES: BiomePalette[] = [
  {
    top: '#04070c',
    throat: '#102838',
    bot: '#07140f',
    far: '#0a1c24',
    wallBack: '#0c2820',
    wall: '#14382c',
    shade: '#06140e',
    rim: '#6ee7b7',
    vein: '#047857',
    glow: '#10b981',
    core: '#d1fae5',
    mote: '#a7f3d0',
    mist: 'rgba(16, 185, 129, 0.09)'
  },
  {
    top: '#101404',
    throat: '#2c320c',
    bot: '#161c06',
    far: '#1a2208',
    wallBack: '#2a3208',
    wall: '#3d4a0c',
    shade: '#121806',
    rim: '#d9f99d',
    vein: '#4d7c0f',
    glow: '#a3e635',
    core: '#f7fee7',
    mote: '#ecfccb',
    mist: 'rgba(163, 230, 53, 0.12)'
  },
  {
    top: '#120c06',
    throat: '#3a2410',
    bot: '#1a1008',
    far: '#261408',
    wallBack: '#3a220c',
    wall: '#5c3412',
    shade: '#1a0e06',
    rim: '#fcd34d',
    vein: '#b45309',
    glow: '#f59e0b',
    core: '#fffbeb',
    mote: '#fde68a',
    mist: 'rgba(245, 158, 11, 0.1)'
  },
  {
    top: '#140414',
    throat: '#301028',
    bot: '#120814',
    far: '#240c1c',
    wallBack: '#3b1030',
    wall: '#581c46',
    shade: '#140610',
    rim: '#f0abfc',
    vein: '#a21caf',
    glow: '#e879f9',
    core: '#fdf4ff',
    mote: '#f5d0fe',
    mist: 'rgba(232, 121, 249, 0.09)'
  },
  {
    top: '#06110a',
    throat: '#14301c',
    bot: '#0c1810',
    far: '#102416',
    wallBack: '#163222',
    wall: '#1f4a2c',
    shade: '#07140c',
    rim: '#fde047',
    vein: '#3f6212',
    glow: '#84cc16',
    core: '#fef9c3',
    mote: '#fef08a',
    mist: 'rgba(132, 204, 22, 0.08)'
  }
];

function paletteFor(stage: number): BiomePalette {
  const index = Math.max(0, Math.min(BIOMES.length - 1, stage - 1));
  return BIOMES[index];
}

function wrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}

function loopX(index: number, spacing: number, scroll: number, width: number, pad = 70): number {
  const span = width + pad * 2;
  return wrap(index * spacing - scroll, span) - pad;
}

/** Slow cave contour plus short local teeth, so the rim is a jaw instead of a sine wave. */
function tissue(x: number, scroll: number, phase: number): number {
  const along = x + scroll;
  const u = along * 0.011;
  let height = Math.sin(u + phase) * 6 + Math.sin(u * 2.15 + 1.4) * 2;
  const spike = Math.sin(along * 0.11 + phase * 5);
  if (spike > 0.78) height += (spike - 0.78) * 95;
  const nick = Math.sin(along * 0.29 + phase * 2.4);
  if (nick > 0.9) height += 8;
  return height;
}

function traceEdge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scroll: number,
  base: number,
  phase: number,
  top: boolean
) {
  ctx.beginPath();
  for (let x = 0; x <= width; x += 2) {
    const fold = base + tissue(x, scroll, phase);
    const y = top ? fold : height - fold;
    if (x === 0) ctx.moveTo(0, y);
    else ctx.lineTo(x, y);
  }
}

function fillWall(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scroll: number,
  base: number,
  phase: number,
  color: string,
  top: boolean
) {
  ctx.beginPath();
  if (top) {
    ctx.moveTo(0, 0);
    for (let x = 0; x <= width; x += 2) {
      ctx.lineTo(x, base + tissue(x, scroll, phase));
    }
    ctx.lineTo(width, 0);
  } else {
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 2) {
      ctx.lineTo(x, height - (base + tissue(x, scroll, phase)));
    }
    ctx.lineTo(width, height);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRim(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scroll: number,
  base: number,
  phase: number,
  color: string,
  top: boolean
) {
  traceEdge(ctx, width, height, scroll, base, phase, top);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function traceHex(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function cyst(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, palette: BiomePalette) {
  ctx.fillStyle = palette.shade;
  ctx.beginPath();
  ctx.arc(x, y, radius + 1.5, 0, Math.PI * 2);
  ctx.fill();
  const glow = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, radius);
  glow.addColorStop(0, palette.core);
  glow.addColorStop(0.55, palette.glow);
  glow.addColorStop(1, palette.shade);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function renderBiome(ctx: CanvasRenderingContext2D, frame: BiomeFrame) {
  const { width, height, stage, stars, hills, cavern, foreground, time } = frame;
  const palette = paletteFor(stage);

  ctx.save();

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, palette.top);
  sky.addColorStop(0.42, palette.throat);
  sky.addColorStop(0.72, palette.bot);
  sky.addColorStop(1, palette.top);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = palette.mote;
  for (let i = 0; i < 36; i++) {
    const x = loopX(i, 28, stars, width, 8);
    const y = (i * 47) % height;
    const size = i % 7 === 0 ? 2 : 1;
    const twinkle = 0.35 + (Math.sin(time * 2.2 + i) * 0.5 + 0.5) * 0.65;
    ctx.globalAlpha = 0.2 + twinkle * 0.45;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 12; i++) {
    const x = loopX(i, 78, stars * 1.6, width, 20);
    const y = 64 + ((i * 53) % (height - 128));
    ctx.fillRect(x, y, 6 + (i % 4) * 5, 1);
  }
  ctx.globalAlpha = 1;

  fillWall(ctx, width, height, hills, 16, 0.4, palette.wallBack, true);
  fillWall(ctx, width, height, hills, 14, 2.1, palette.wallBack, false);

  fillWall(ctx, width, height, cavern, 32, 1.1, palette.wall, true);
  fillWall(ctx, width, height, cavern, 30, 2.8, palette.wall, false);
  ctx.globalAlpha = 0.95;
  strokeRim(ctx, width, height, cavern, 32, 1.1, palette.rim, true);
  strokeRim(ctx, width, height, cavern, 30, 2.8, palette.rim, false);
  ctx.globalAlpha = 1;

  ctx.fillStyle = palette.shade;
  for (let i = 0; i < 16; i++) {
    const x = loopX(i, 42, cavern * 0.85, width, 8);
    const onCeiling = i % 2 === 0;
    const raw = (onCeiling ? 32 : 30) + tissue(x, cavern, onCeiling ? 1.1 : 2.8);
    const y = onCeiling ? raw - 8 : height - raw + 4;
    ctx.fillRect(x, y, 3, 3);
  }

  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const top = i % 2 === 0;
    const x = loopX(i, 130, cavern * 0.8, width, 30);
    const y = top ? 14 : height - 14;
    const droop = top ? 26 : -26;
    ctx.strokeStyle = palette.vein;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 24, y + droop, x + 64, y + droop * 0.35, x + 108, y + droop * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 46, y + droop * 0.62);
    ctx.lineTo(x + 58, y + droop * 1.15);
    ctx.stroke();
    ctx.strokeStyle = palette.rim;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 24, y + droop, x + 64, y + droop * 0.35, x + 108, y + droop * 0.12);
    ctx.stroke();
    ctx.lineWidth = 2;
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 8; i++) {
    const x = loopX(i, 96, cavern, width, 24);
    const onCeiling = i % 2 === 0;
    const raw = (onCeiling ? 32 : 30) + tissue(x, cavern, onCeiling ? 1.1 : 2.8);
    const y = onCeiling ? Math.min(raw - 3, 64) : Math.max(height - (raw - 3), height - 64);
    cyst(ctx, x, y, 3 + (i % 3), palette);
  }

  const floorWash = ctx.createLinearGradient(0, height - 64, 0, height);
  floorWash.addColorStop(0, 'rgba(0, 0, 0, 0)');
  floorWash.addColorStop(1, palette.mist);
  ctx.fillStyle = floorWash;
  ctx.fillRect(0, height - 64, width, 64);

  if (stage <= 1) {
    ctx.fillStyle = palette.glow;
    for (let i = 0; i < 5; i++) {
      const x = loopX(i, 160, foreground * 0.55, width, 40);
      if (x > 90 && x < width - 90) continue;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.moveTo(x, 36);
      ctx.quadraticCurveTo(x + 16, height / 2, x - 8, height - 36);
      ctx.lineTo(x + 6, height - 36);
      ctx.quadraticCurveTo(x + 28, height / 2, x + 10, 36);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const x = loopX(i, 64, foreground, width, 12);
      const y = 48 + ((i * 41 + Math.floor(time * 8)) % (height - 96));
      ctx.globalAlpha = 0.35 + (i % 3) * 0.12;
      ctx.fillStyle = i % 2 === 0 ? palette.core : palette.glow;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (stage === 2) {
    ctx.fillStyle = palette.glow;
    for (let i = 0; i < 8; i++) {
      const x = loopX(i, 84, cavern, width, 10);
      const drop = (time * 22 + i * 19) % 26;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x, 18, 2, 4);
      ctx.beginPath();
      ctx.arc(x + 1, 22 + drop, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = palette.rim;
    for (let i = 0; i < 7; i++) {
      const x = loopX(i, 110, foreground * 0.7, width, 16);
      const reed = 30 + (i % 3) * 8;
      ctx.fillRect(x, height - 8 - reed, 2, reed);
      ctx.fillRect(x - 4, height - 16 - (i % 2) * 6, 10, 2);
    }
    ctx.globalAlpha = 1;
  } else if (stage === 3) {
    for (let col = 0; col < 18; col++) {
      const x = loopX(col, 36, foreground, width, 16);
      const shift = (col % 2) * 8;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = palette.shade;
      traceHex(ctx, x, 16 + shift, 8);
      ctx.fill();
      ctx.strokeStyle = palette.rim;
      ctx.lineWidth = 1;
      ctx.stroke();
      traceHex(ctx, x, height - 16 - shift, 8);
      ctx.fill();
      ctx.stroke();
      if (col % 3 === 0) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = palette.core;
        ctx.fillRect(x - 1, 15 + shift, 2, 2);
        ctx.fillRect(x - 1, height - 17 - shift, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  } else if (stage === 4) {
    for (let i = 0; i < 9; i++) {
      const x = loopX(i, 78, foreground, width, 8);
      const length = 22 + (i % 5) * 12;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = i % 2 === 0 ? palette.glow : '#38bdf8';
      ctx.fillRect(x, 0, 3, length);
      ctx.fillRect(x, height - length, 3, length);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.core;
      ctx.fillRect(x + 1, length - 4, 1, 4);
      ctx.fillRect(x + 1, height - length, 1, 4);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = palette.shade;
    for (let i = 0; i < 6; i++) {
      const x = loopX(i, 128, foreground * 0.65, width, 20);
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, 0, 10, 48);
      ctx.fillStyle = palette.rim;
      ctx.fillRect(x - 4, 44, 18, 4);
      ctx.fillStyle = palette.shade;
      ctx.fillRect(x, height - 56, 10, 56);
      ctx.fillStyle = palette.rim;
      ctx.fillRect(x - 4, height - 60, 18, 4);
      ctx.fillStyle = palette.shade;
    }
    ctx.globalAlpha = 1;
  }

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.28, width / 2, height / 2, height * 0.78);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const x = loopX(i, 96, cavern, width, 24);
    const onCeiling = i % 2 === 0;
    const raw = (onCeiling ? 32 : 30) + tissue(x, cavern, onCeiling ? 1.1 : 2.8);
    const y = onCeiling ? Math.min(raw - 3, 64) : Math.max(height - (raw - 3), height - 64);
    const pulse = 0.35 + (Math.sin(time * 2.4 + i) * 0.5 + 0.5) * 0.4;
    ctx.globalAlpha = pulse;
    const bloom = ctx.createRadialGradient(x, y, 1, x, y, 14);
    bloom.addColorStop(0, palette.core);
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
