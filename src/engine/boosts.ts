/** Multiplier for a stat boost stage (-6..+6). Dependency-free so the UI can use it. */
export function boostMultiplier(stage: number) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}
