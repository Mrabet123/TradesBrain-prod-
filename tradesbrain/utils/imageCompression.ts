// D4 Section 3.3 — Tiered Photo Compression

export interface CompressionSettings {
  quality: number;
  maxDimension: number;
}

export function getCompressionSettings(stage: number): CompressionSettings {
  if (stage <= 1) return { quality: 0.6, maxDimension: 1024 };
  if (stage === 2) return { quality: 0.5, maxDimension: 800 };
  return { quality: 0.4, maxDimension: 600 }; // stages 3-5
}
