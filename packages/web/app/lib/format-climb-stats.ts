/** Format ascent count: <1000 as-is, 1000–9999 with 1 decimal + k, ≥10000 rounded + k */
export function formatAscents(count: number): string {
  if (count < 1000) return `${count}`;
  const thousands = count / 1000;
  if (thousands < 10) {
    const fixed = thousands.toFixed(1);
    // Avoid "10.0k" at boundary — drop decimal when it rounds to 10+
    return fixed.startsWith('10') ? '10k' : `${fixed}k`;
  }
  return `${Math.round(thousands)}k`;
}

/** Round quality_average to 1 decimal place */
export function formatQuality(quality: string): string {
  const n = parseFloat(quality);
  if (Number.isNaN(n)) return quality;
  return n.toFixed(1);
}
