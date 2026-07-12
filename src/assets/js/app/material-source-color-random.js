const MATERIAL_SOURCE_COLOR_RANDOM_SEED = 0x6d2b79f5;

export function withDeterministicMaterialSourceColorRandom(callback) {
  const nativeRandom = Math.random;
  let seed = MATERIAL_SOURCE_COLOR_RANDOM_SEED;

  Math.random = () => {
    seed += MATERIAL_SOURCE_COLOR_RANDOM_SEED;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  try {
    return callback();
  } finally {
    Math.random = nativeRandom;
  }
}
