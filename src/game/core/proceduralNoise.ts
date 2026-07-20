function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

/** Stable integer hash used by every procedural material. */
export function hashSeed(...parts: readonly (number | string)[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

/** A deterministic random value in the 0..1 range for an integer lattice point. */
export function latticeNoise(x: number, y: number, seed: number): number {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967295;
}

/** Smooth value noise in the -1..1 range. Coordinates are in world space. */
export function sampleValueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothStep(x - x0);
  const ty = smoothStep(y - y0);
  const top = mix(latticeNoise(x0, y0, seed), latticeNoise(x0 + 1, y0, seed), tx);
  const bottom = mix(
    latticeNoise(x0, y0 + 1, seed),
    latticeNoise(x0 + 1, y0 + 1, seed),
    tx,
  );
  return mix(top, bottom, ty) * 2 - 1;
}

/** Multi-octave noise. Frequency is expressed per world-space pixel. */
export function sampleFractalNoise(
  worldX: number,
  worldY: number,
  seed: number,
  octaves = 3,
  frequency = 0.04,
  persistence = 0.5,
): number {
  let amplitude = 1;
  let total = 0;
  let amplitudeTotal = 0;
  let octaveFrequency = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += sampleValueNoise(worldX * octaveFrequency, worldY * octaveFrequency, seed + octave * 1013) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= persistence;
    octaveFrequency *= 2;
  }
  return amplitudeTotal === 0 ? 0 : total / amplitudeTotal;
}

export function createSeededNoise(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
