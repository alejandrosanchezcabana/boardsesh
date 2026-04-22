export function isNoMatchClimb(description: string | null | undefined): boolean {
  return /^no match/i.test(description || '');
}
