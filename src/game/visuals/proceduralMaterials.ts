import Phaser from 'phaser';
import { createSeededNoise, hashSeed, sampleFractalNoise } from '../core/proceduralNoise';
import type { EnemyType, HazardType, PlatformSpec, StageBlueprint } from '../types';

export type MaterialType =
  | 'brick'
  | 'stone'
  | 'metal'
  | 'wood'
  | 'floor'
  | 'glass'
  | 'energy';

export type MaterialQuality = 'low' | 'medium' | 'high';

export const MATERIAL_RENDER_CONFIG: {
  enabled: boolean;
  quality: MaterialQuality;
  readonly lightAngleDeg: number;
  readonly lightDirection: { readonly x: number; readonly y: number };
  readonly textureWorldSize: number;
  readonly maxPixelRatio: number;
} = {
  enabled: true,
  quality: 'high',
  lightAngleDeg: 135,
  lightDirection: { x: -0.707, y: -0.707 },
  textureWorldSize: 12,
  maxPixelRatio: 2,
};

interface MaterialTextureOptions {
  readonly material: MaterialType;
  readonly width: number;
  readonly height: number;
  readonly baseColor: number;
  readonly seed: number;
  readonly worldX?: number;
  readonly worldY?: number;
  readonly variant?: string;
  readonly quality?: MaterialQuality;
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const THEME_COLORS: Record<StageBlueprint['theme'], Record<MaterialType, number>> = {
  training: {
    brick: 0x405574,
    stone: 0x465b73,
    metal: 0x63758c,
    wood: 0x8a5c3f,
    floor: 0x324b67,
    glass: 0x3c9db2,
    energy: 0x32e9ff,
  },
  neon: {
    brick: 0x263b58,
    stone: 0x354661,
    metal: 0x506781,
    wood: 0x72526e,
    floor: 0x253c59,
    glass: 0x247d99,
    energy: 0x32e9ff,
  },
  foundry: {
    brick: 0x6b3e43,
    stone: 0x5a414b,
    metal: 0x70606a,
    wood: 0x875438,
    floor: 0x51363f,
    glass: 0x8a4f68,
    energy: 0xff8a49,
  },
  ruins: {
    brick: 0x4d4772,
    stone: 0x504b76,
    metal: 0x636783,
    wood: 0x71546a,
    floor: 0x3c395f,
    glass: 0x6855a4,
    energy: 0x9b68ff,
  },
};

function rgb(color: number): Rgb {
  return { r: (color >>> 16) & 0xff, g: (color >>> 8) & 0xff, b: color & 0xff };
}

function css(color: number, alpha = 1): string {
  const value = rgb(color);
  return `rgba(${value.r}, ${value.g}, ${value.b}, ${alpha})`;
}

function shade(color: number, amount: number): number {
  const source = rgb(color);
  const ratio = Math.min(1, Math.abs(amount) / 100);
  const target = amount >= 0 ? 255 : 0;
  const channel = (value: number): number => Math.round(value + (target - value) * ratio);
  return (channel(source.r) << 16) | (channel(source.g) << 8) | channel(source.b);
}

function fillDirectionalGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
  stops: readonly (readonly [number, number])[],
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  for (const [position, lightness] of stops) gradient.addColorStop(position, css(shade(baseColor, lightness)));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function strokeOuterBevel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
): void {
  const edge = Math.max(1, Math.min(3, Math.round(Math.min(width, height) * 0.035)));
  ctx.fillStyle = css(shade(baseColor, 30), 0.5);
  ctx.fillRect(edge, edge, width - edge * 2, edge);
  ctx.fillRect(edge, edge, edge, height - edge * 2);
  ctx.fillStyle = css(shade(baseColor, -52), 0.75);
  ctx.fillRect(0, height - edge * 2, width, edge * 2);
  ctx.fillRect(width - edge * 2, 0, edge * 2, height);
  ctx.strokeStyle = css(shade(baseColor, -48), 0.9);
  ctx.lineWidth = Math.max(1, edge * 0.75);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
}

function applyNoiseOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  worldX: number,
  worldY: number,
  strength: number,
  frequency: number,
  octaves: number,
): void {
  if (strength <= 0 || width * height > 1_600_000) return;
  const image = ctx.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (image.data[index + 3] === 0) continue;
      const noise = sampleFractalNoise(worldX + x, worldY + y, seed, octaves, frequency, 0.52);
      const factor = 1 + noise * strength;
      image.data[index] = Math.max(0, Math.min(255, image.data[index]! * factor));
      image.data[index + 1] = Math.max(0, Math.min(255, image.data[index + 1]! * factor));
      image.data[index + 2] = Math.max(0, Math.min(255, image.data[index + 2]! * factor));
    }
  }
  ctx.putImageData(image, 0, 0);
}

function drawStains(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  baseColor: number,
  coverage = 0.12,
): void {
  const random = createSeededNoise(seed ^ 0x7ac4d1);
  const count = Math.max(1, Math.min(14, Math.round((width * height * coverage) / 7000)));
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const radiusX = 5 + random() * Math.min(28, width * 0.08);
    const radiusY = 3 + random() * Math.min(16, height * 0.18);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(radiusX, radiusY));
    gradient.addColorStop(0, css(shade(baseColor, -36), 0.13));
    gradient.addColorStop(0.55, css(shade(baseColor, -24), 0.07));
    gradient.addColorStop(1, css(baseColor, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radiusX / Math.max(radiusX, radiusY), radiusY / Math.max(radiusX, radiusY));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(radiusX, radiusY), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBrick(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
  seed: number,
  worldX: number,
  worldY: number,
  irregular: boolean,
  quality: MaterialQuality,
): void {
  fillDirectionalGradient(ctx, width, height, baseColor, [[0, 12], [0.38, 3], [0.72, -7], [1, -18]]);
  applyNoiseOverlay(ctx, width, height, seed, worldX, worldY, quality === 'low' ? 0.025 : 0.055, 0.035, quality === 'high' ? 3 : 2);
  const brickHeight = Math.max(16, Math.min(24, Math.round(height / Math.max(1, Math.round(height / 22)))));
  const brickWidth = irregular ? 54 : 48;
  const mortar = Math.max(1, Math.min(3, Math.round(brickHeight * 0.08)));
  const rows = Math.ceil(height / brickHeight) + 1;
  for (let row = 0; row < rows; row += 1) {
    const top = row * brickHeight;
    ctx.fillStyle = css(shade(baseColor, -48), 0.88);
    ctx.fillRect(0, top, width, mortar);
    ctx.fillStyle = css(shade(baseColor, 28), 0.14);
    ctx.fillRect(0, top + mortar, width, 1);
    let x = row % 2 === 0 ? 0 : -brickWidth / 2;
    let column = 0;
    while (x < width) {
      const variation = irregular
        ? 0.78 + ((hashSeed(seed, row, column) & 255) / 255) * 0.48
        : 1;
      const cellWidth = brickWidth * variation;
      ctx.fillStyle = css(shade(baseColor, -46), 0.88);
      ctx.fillRect(Math.round(x), top, mortar, brickHeight);
      ctx.fillStyle = css(shade(baseColor, 25), 0.12);
      ctx.fillRect(Math.round(x + mortar), top + mortar, 1, Math.max(0, brickHeight - mortar));
      ctx.fillStyle = css(shade(baseColor, -18), 0.13);
      ctx.fillRect(Math.round(x + mortar), top + brickHeight - 2, Math.max(0, cellWidth - mortar), 2);
      x += cellWidth;
      column += 1;
    }
  }
  if (quality !== 'low') drawStains(ctx, width, height, seed, baseColor, irregular ? 0.18 : 0.12);
  strokeOuterBevel(ctx, width, height, baseColor);
}

function drawWood(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
  seed: number,
  worldX: number,
  worldY: number,
  quality: MaterialQuality,
): void {
  fillDirectionalGradient(ctx, width, height, baseColor, [[0, 13], [0.45, 0], [1, -16]]);
  applyNoiseOverlay(ctx, width, height, seed, worldX, worldY, quality === 'low' ? 0.018 : 0.045, 0.028, 2);
  const random = createSeededNoise(seed ^ 0x25a31);
  const spacing = quality === 'low' ? 11 : 7;
  ctx.lineCap = 'round';
  for (let baseY = spacing; baseY < height; baseY += spacing) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const bend = sampleFractalNoise(worldX + x, worldY + baseY, seed + baseY, 2, 0.025) * 3.5;
      if (x === 0) ctx.moveTo(x, baseY + bend);
      else ctx.lineTo(x, baseY + bend);
    }
    ctx.strokeStyle = css(shade(baseColor, -30), 0.11 + random() * 0.09);
    ctx.lineWidth = 0.7 + random() * 0.8;
    ctx.stroke();
  }
  if (quality === 'high' && width > 90 && height > 18) {
    const knotCount = Math.min(3, Math.floor(width / 180) + 1);
    for (let index = 0; index < knotCount; index += 1) {
      const x = 35 + random() * Math.max(1, width - 70);
      const y = 8 + random() * Math.max(1, height - 16);
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.strokeStyle = css(shade(baseColor, -38), 0.09 + ring * 0.025);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, 6 + ring * 5, 2.5 + ring * 2, random() * 0.25, 0.3, Math.PI * 1.85);
        ctx.stroke();
      }
    }
  }
  strokeOuterBevel(ctx, width, height, baseColor);
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
  seed: number,
  worldX: number,
  worldY: number,
  quality: MaterialQuality,
): void {
  const topBand = Math.max(6, Math.min(18, Math.round(height * 0.18)));
  fillDirectionalGradient(ctx, width, height, baseColor, [[0, 10], [0.45, 0], [1, -19]]);
  applyNoiseOverlay(ctx, width, height, seed, worldX, worldY, quality === 'low' ? 0.018 : 0.04, 0.045, 2);
  ctx.fillStyle = css(shade(baseColor, 20), 0.28);
  ctx.fillRect(0, 0, width, topBand);
  ctx.fillStyle = css(shade(baseColor, 42), 0.52);
  ctx.fillRect(0, 0, width, Math.min(2, topBand));
  ctx.fillStyle = css(shade(baseColor, -45), 0.78);
  ctx.fillRect(0, topBand, width, 2);
  const tileWidth = 72;
  const offset = ((Math.floor(worldX) % tileWidth) + tileWidth) % tileWidth;
  for (let x = -offset; x < width; x += tileWidth) {
    ctx.strokeStyle = css(shade(baseColor, -42), 0.72);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + tileWidth * 0.08, 0);
    ctx.lineTo(x, topBand);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.strokeStyle = css(shade(baseColor, 28), 0.11);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, topBand + 2);
    ctx.lineTo(x + 2, height);
    ctx.stroke();
  }
  if (quality !== 'low') drawStains(ctx, width, height, seed, baseColor, 0.07);
  strokeOuterBevel(ctx, width, height, baseColor);
}

function drawMetal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
  seed: number,
  worldX: number,
  worldY: number,
  quality: MaterialQuality,
): void {
  fillDirectionalGradient(ctx, width, height, baseColor, [[0, 24], [0.22, 8], [0.55, 0], [0.78, -18], [1, -34]]);
  applyNoiseOverlay(ctx, width, height, seed, worldX, worldY, quality === 'low' ? 0.008 : 0.022, 0.3, 1);
  if (quality !== 'low') {
    ctx.strokeStyle = css(shade(baseColor, 48), 0.055);
    ctx.lineWidth = 1;
    for (let y = 4; y < height; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  const stripeWidth = Math.max(8, Math.min(width, height) * 0.13);
  const shine = ctx.createLinearGradient(width * 0.18, height, width * 0.78, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.43, 'rgba(240,249,255,0.05)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.52)');
  shine.addColorStop(0.57, 'rgba(240,249,255,0.08)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.translate(width * 0.48, height * 0.5);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = shine;
  ctx.fillRect(-stripeWidth / 2, -Math.max(width, height), stripeWidth, Math.max(width, height) * 2);
  ctx.restore();
  strokeOuterBevel(ctx, width, height, baseColor);
}

function drawGlass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, css(shade(baseColor, 42), 0.58));
  gradient.addColorStop(0.48, css(baseColor, 0.28));
  gradient.addColorStop(1, css(shade(baseColor, -34), 0.62));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(235,252,255,0.45)';
  ctx.lineWidth = Math.max(1, Math.min(3, height * 0.07));
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * 0.75);
  ctx.lineTo(width * 0.35, height * 0.12);
  ctx.moveTo(width * 0.22, height * 0.92);
  ctx.lineTo(width * 0.49, height * 0.18);
  ctx.stroke();
  strokeOuterBevel(ctx, width, height, baseColor);
}

function drawEnergy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseColor: number,
  seed: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, css(baseColor, 0));
  gradient.addColorStop(0.22, css(baseColor, 0.28));
  gradient.addColorStop(0.5, css(shade(baseColor, 65), 0.78));
  gradient.addColorStop(0.78, css(baseColor, 0.28));
  gradient.addColorStop(1, css(baseColor, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const random = createSeededNoise(seed);
  ctx.strokeStyle = css(shade(baseColor, 65), 0.38);
  ctx.lineWidth = 1;
  for (let x = -height; x < width; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x + random() * 4, height);
    ctx.lineTo(x + height * 0.5 + random() * 4, 0);
    ctx.stroke();
  }
}

function drawMaterial(ctx: CanvasRenderingContext2D, options: Required<MaterialTextureOptions>): void {
  const { width, height, baseColor, seed, worldX, worldY, quality } = options;
  if (options.material === 'brick') drawBrick(ctx, width, height, baseColor, seed, worldX, worldY, false, quality);
  else if (options.material === 'stone') drawBrick(ctx, width, height, baseColor, seed, worldX, worldY, true, quality);
  else if (options.material === 'wood') drawWood(ctx, width, height, baseColor, seed, worldX, worldY, quality);
  else if (options.material === 'floor') drawFloor(ctx, width, height, baseColor, seed, worldX, worldY, quality);
  else if (options.material === 'metal') drawMetal(ctx, width, height, baseColor, seed, worldX, worldY, quality);
  else if (options.material === 'glass') drawGlass(ctx, width, height, baseColor);
  else drawEnergy(ctx, width, height, baseColor, seed);
}

function drawSpikes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
): void {
  const count = Math.max(2, Math.floor(width / 24));
  const segment = width / count;
  for (let index = 0; index < count; index += 1) {
    const left = index * segment;
    const tipX = left + segment / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left, height);
    ctx.lineTo(tipX, 0);
    ctx.lineTo(left + segment, height);
    ctx.closePath();
    ctx.clip();
    const gradient = ctx.createLinearGradient(left, 0, left + segment, height);
    gradient.addColorStop(0, '#f5fbff');
    gradient.addColorStop(0.18, '#cbd7e4');
    gradient.addColorStop(0.48, '#79899d');
    gradient.addColorStop(0.76, '#4b5265');
    gradient.addColorStop(1, '#202535');
    ctx.fillStyle = gradient;
    ctx.fillRect(left, 0, segment, height);
    const stripe = ctx.createLinearGradient(left, height, left + segment, 0);
    stripe.addColorStop(0.32, 'rgba(255,255,255,0)');
    stripe.addColorStop(0.47, 'rgba(255,255,255,0.08)');
    stripe.addColorStop(0.5, 'rgba(255,255,255,0.65)');
    stripe.addColorStop(0.56, 'rgba(255,255,255,0)');
    ctx.fillStyle = stripe;
    ctx.fillRect(left, 0, segment, height);
    ctx.restore();
    ctx.strokeStyle = 'rgba(15,18,28,0.92)';
    ctx.lineWidth = Math.max(1, Math.min(2, segment * 0.06));
    ctx.beginPath();
    ctx.moveTo(left, height - 0.5);
    ctx.lineTo(tipX, 0.8);
    ctx.lineTo(left + segment, height - 0.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.48)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 1.5, height - 2);
    ctx.lineTo(tipX, 2);
    ctx.stroke();
  }
  applyNoiseOverlay(ctx, width, height, seed, 0, 0, 0.016, 0.32, 1);
}

function drawBlade(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const outer = Math.min(width, height) * 0.49;
  const inner = outer * 0.38;
  for (let index = 0; index < 8; index += 1) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((index / 8) * Math.PI * 2);
    const gradient = ctx.createLinearGradient(0, -outer, inner, 0);
    gradient.addColorStop(0, '#f5fbff');
    gradient.addColorStop(0.32, '#aab8c9');
    gradient.addColorStop(1, '#33394c');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -outer);
    ctx.lineTo(inner * 0.65, -inner * 0.35);
    ctx.lineTo(0, 0);
    ctx.lineTo(-inner * 0.32, -inner * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,18,28,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -outer + 2);
    ctx.lineTo(-inner * 0.27, -inner * 0.5);
    ctx.stroke();
    ctx.restore();
  }
  const hub = ctx.createRadialGradient(centerX - 4, centerY - 5, 2, centerX, centerY, inner);
  hub.addColorStop(0, '#fff3bd');
  hub.addColorStop(0.24, '#d7b866');
  hub.addColorStop(0.7, '#66542f');
  hub.addColorStop(1, '#181a26');
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(centerX, centerY, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,221,133,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#171b29';
  ctx.beginPath();
  ctx.arc(centerX, centerY, inner * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

function drawPit(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#24132f');
  gradient.addColorStop(0.22, '#120b20');
  gradient.addColorStop(1, '#02030a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const random = createSeededNoise(seed);
  for (let index = 0; index < Math.min(30, Math.floor(width / 28)); index += 1) {
    ctx.fillStyle = `rgba(155,104,255,${0.025 + random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(random() * width, height * (0.25 + random() * 0.7), 1 + random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,92,99,0.3)';
  ctx.fillRect(0, 0, width, 2);
}

function drawFlame(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number): void {
  const random = createSeededNoise(seed);
  const count = Math.max(3, Math.floor(width / 15));
  for (let index = 0; index < count; index += 1) {
    const x = ((index + 0.5) / count) * width;
    const flameHeight = height * (0.64 + random() * 0.34);
    const flameWidth = width / count * (0.7 + random() * 0.5);
    const gradient = ctx.createLinearGradient(x, height, x, height - flameHeight);
    gradient.addColorStop(0, 'rgba(255,72,45,0.92)');
    gradient.addColorStop(0.38, 'rgba(255,157,48,0.94)');
    gradient.addColorStop(0.72, 'rgba(255,226,122,0.78)');
    gradient.addColorStop(1, 'rgba(255,246,210,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - flameWidth / 2, height);
    ctx.quadraticCurveTo(x - flameWidth * 0.45, height - flameHeight * 0.42, x, height - flameHeight);
    ctx.quadraticCurveTo(x + flameWidth * 0.55, height - flameHeight * 0.38, x + flameWidth / 2, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,239,174,0.82)';
  ctx.fillRect(0, height - 3, width, 3);
}

function drawEnemy(ctx: CanvasRenderingContext2D, type: EnemyType, seed: number): void {
  if (type === 'charger') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(4, 37);
    ctx.lineTo(22, 7);
    ctx.lineTo(53, 37);
    ctx.closePath();
    ctx.clip();
    const gradient = ctx.createRadialGradient(17, 12, 1, 25, 25, 38);
    gradient.addColorStop(0, '#ffb168');
    gradient.addColorStop(0.38, '#d75a4e');
    gradient.addColorStop(1, '#5a2337');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 58, 44);
    drawStains(ctx, 58, 44, seed, 0xb94749, 0.12);
    ctx.restore();
    ctx.strokeStyle = '#351b2a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,224,155,0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(6, 35);
    ctx.lineTo(22, 9);
    ctx.stroke();
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath();
    ctx.arc(35, 24, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#541328';
    ctx.beginPath();
    ctx.arc(36, 24, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'flyer') {
    const wing = (flip: number): void => {
      const gradient = ctx.createLinearGradient(30, 8, 30 + 30 * flip, 30);
      gradient.addColorStop(0, '#d9bdff');
      gradient.addColorStop(0.45, '#8e62cf');
      gradient.addColorStop(1, '#382951');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(30, 14);
      ctx.lineTo(30 + 29 * flip, 9);
      ctx.lineTo(30 + 21 * flip, 29);
      ctx.lineTo(30 + 8 * flip, 23);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(235,221,255,0.42)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    wing(-1);
    wing(1);
    const core = ctx.createRadialGradient(25, 14, 1, 30, 19, 14);
    core.addColorStop(0, '#dfc7ff');
    core.addColorStop(0.35, '#9364d8');
    core.addColorStop(1, '#302042');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(30, 19, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#261b39';
    ctx.lineWidth = 2;
    ctx.stroke();
    const eye = ctx.createRadialGradient(28, 17, 1, 30, 19, 6);
    eye.addColorStop(0, '#ffffff');
    eye.addColorStop(0.34, '#71f7ff');
    eye.addColorStop(1, '#16869d');
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(30, 19, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const width = type === 'turret' ? 50 : 58;
    const height = type === 'turret' ? 54 : 68;
    drawMetal(ctx, width, height, type === 'turret' ? 0x65738e : 0x59647f, seed, 0, 0, 'high');
    if (type === 'turret') {
      ctx.fillStyle = '#11182a';
      ctx.fillRect(5, 0, 40, 22);
      const core = ctx.createRadialGradient(21, 17, 1, 25, 22, 13);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.25, '#ff9adc');
      core.addColorStop(1, '#7a164f');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(25, 22, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#252b3f';
      ctx.fillRect(24, 4, 6, 15);
    } else {
      const visor = ctx.createLinearGradient(18, 24, 40, 29);
      visor.addColorStop(0, '#ffdde3');
      visor.addColorStop(0.35, '#ff5c63');
      visor.addColorStop(1, '#771d34');
      ctx.fillStyle = visor;
      ctx.fillRect(18, 24, 22, 6);
      ctx.strokeStyle = 'rgba(255,210,112,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4.5, 4.5, 49, 61);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, 8);
      ctx.lineTo(12, 61);
      ctx.stroke();
    }
  }
}

export function choosePlatformMaterial(
  theme: StageBlueprint['theme'],
  spec: PlatformSpec,
): MaterialType {
  if (spec.id.includes('glass')) return 'glass';
  if (spec.kind === 'conveyor' || spec.kind === 'moving') return 'metal';
  if (theme === 'ruins') return 'stone';
  if (theme === 'foundry') return spec.id.includes('rune') ? 'stone' : 'metal';
  if (theme === 'training' && spec.height <= 30) return 'wood';
  return spec.height >= 60 ? 'floor' : theme === 'neon' ? 'metal' : 'wood';
}

export class ProceduralMaterialRenderer {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly quality: MaterialQuality = MATERIAL_RENDER_CONFIG.quality,
  ) {}

  renderMaterial(options: MaterialTextureOptions): string {
    const normalized: Required<MaterialTextureOptions> = {
      ...options,
      width: Math.max(2, Math.ceil(options.width)),
      height: Math.max(2, Math.ceil(options.height)),
      worldX: options.worldX ?? 0,
      worldY: options.worldY ?? 0,
      variant: options.variant ?? 'default',
      quality: options.quality ?? this.quality,
    };
    const key = [
      'proc',
      normalized.material,
      normalized.width,
      normalized.height,
      normalized.baseColor.toString(16),
      normalized.seed.toString(16),
      normalized.variant,
      normalized.quality,
      MATERIAL_RENDER_CONFIG.enabled ? 'material' : 'flat',
    ].join('-');
    if (this.scene.textures.exists(key)) return key;
    const texture = this.scene.textures.createCanvas(key, normalized.width, normalized.height);
    if (!texture) throw new Error(`Unable to create procedural texture: ${key}`);
    if (MATERIAL_RENDER_CONFIG.enabled) drawMaterial(texture.context, normalized);
    else {
      texture.context.fillStyle = css(normalized.baseColor);
      texture.context.fillRect(0, 0, normalized.width, normalized.height);
      strokeOuterBevel(texture.context, normalized.width, normalized.height, normalized.baseColor);
    }
    texture.refresh();
    return key;
  }

  createBackdropTile(theme: StageBlueprint['theme'], stageSeed: number): string {
    const material: MaterialType = theme === 'ruins' ? 'stone' : 'brick';
    return this.renderMaterial({
      material,
      width: 288,
      height: 132,
      baseColor: THEME_COLORS[theme][material],
      seed: hashSeed(stageSeed, theme, 'backdrop'),
      variant: `backdrop-${theme}`,
      quality: 'medium',
    });
  }

  createPlatformTexture(
    theme: StageBlueprint['theme'],
    stageSeed: number,
    spec: PlatformSpec,
  ): string {
    const material = choosePlatformMaterial(theme, spec);
    return this.renderMaterial({
      material,
      width: spec.width,
      height: spec.height,
      baseColor: THEME_COLORS[theme][material],
      seed: hashSeed(stageSeed, spec.id, material),
      worldX: spec.x - spec.width / 2,
      worldY: spec.y - spec.height / 2,
      variant: `${theme}-${spec.kind ?? 'solid'}`,
    });
  }

  createHazardTexture(
    theme: StageBlueprint['theme'],
    stageSeed: number,
    hazard: { readonly id: string; readonly type: HazardType; readonly width: number; readonly height: number },
  ): string {
    const width = Math.max(2, Math.ceil(hazard.width));
    const height = Math.max(2, Math.ceil(hazard.height));
    const seed = hashSeed(stageSeed, hazard.id, hazard.type);
    const key = `proc-hazard-${hazard.type}-${width}-${height}-${seed.toString(16)}-${MATERIAL_RENDER_CONFIG.enabled ? 'material' : 'flat'}`;
    if (this.scene.textures.exists(key)) return key;
    const texture = this.scene.textures.createCanvas(key, width, height);
    if (!texture) throw new Error(`Unable to create procedural hazard texture: ${key}`);
    const ctx = texture.context;
    if (!MATERIAL_RENDER_CONFIG.enabled) {
      ctx.fillStyle = css(hazard.type === 'low-tunnel' ? 0x283459 : 0xff5c63, hazard.type.includes('field') ? 0.18 : 0.86);
      if (hazard.type === 'spikes') {
        const count = Math.max(2, Math.floor(width / 24));
        const segment = width / count;
        for (let index = 0; index < count; index += 1) {
          ctx.beginPath();
          ctx.moveTo(index * segment, height);
          ctx.lineTo((index + 0.5) * segment, 0);
          ctx.lineTo((index + 1) * segment, height);
          ctx.closePath();
          ctx.fill();
        }
      } else ctx.fillRect(0, 0, width, height);
    } else if (hazard.type === 'spikes') drawSpikes(ctx, width, height, seed);
    else if (hazard.type === 'blade') drawBlade(ctx, width, height);
    else if (hazard.type === 'pit') drawPit(ctx, width, height, seed);
    else if (hazard.type === 'flame') drawFlame(ctx, width, height, seed);
    else if (hazard.type === 'laser') drawEnergy(ctx, width, height, 0xff5c63, seed);
    else if (hazard.type.includes('field')) drawEnergy(ctx, width, height, THEME_COLORS[theme].energy, seed);
    else {
      const material: MaterialType = hazard.type === 'cracked-wall' ? (theme === 'ruins' ? 'stone' : 'brick') : 'metal';
      drawMaterial(ctx, {
        material,
        width,
        height,
        baseColor: THEME_COLORS[theme][material],
        seed,
        worldX: 0,
        worldY: 0,
        variant: hazard.type,
        quality: this.quality,
      });
      if (hazard.type === 'cracked-wall') {
        ctx.strokeStyle = 'rgba(238,242,255,0.72)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(width * 0.55, 4);
        ctx.lineTo(width * 0.38, height * 0.32);
        ctx.lineTo(width * 0.62, height * 0.52);
        ctx.lineTo(width * 0.36, height * 0.76);
        ctx.lineTo(width * 0.5, height - 4);
        ctx.moveTo(width * 0.39, height * 0.32);
        ctx.lineTo(width * 0.18, height * 0.43);
        ctx.moveTo(width * 0.62, height * 0.52);
        ctx.lineTo(width * 0.82, height * 0.62);
        ctx.stroke();
      }
    }
    texture.refresh();
    return key;
  }

  createEnemyTextures(stageSeed = 0): void {
    const dimensions: Record<EnemyType, readonly [number, number]> = {
      charger: [58, 44],
      flyer: [60, 38],
      turret: [50, 54],
      'armored-blocker': [58, 68],
    };
    for (const type of Object.keys(dimensions) as EnemyType[]) {
      if (this.scene.textures.exists(type)) this.scene.textures.remove(type);
      const [width, height] = dimensions[type];
      const texture = this.scene.textures.createCanvas(type, width, height);
      if (!texture) throw new Error(`Unable to create procedural enemy texture: ${type}`);
      drawEnemy(texture.context, type, hashSeed(stageSeed, type));
      texture.refresh();
    }
  }
}
