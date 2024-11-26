export function getOrdinalSuffix(position: number): string {
  if (position === 1) return 'er';
  if (position === 2) return 'do';
  if (position === 3) return 'er';
  return 'to';
}