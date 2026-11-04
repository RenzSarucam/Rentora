/** Room codes may already include their label, e.g. "Room 1". */
export function roomLabel(code: string): string {
  const value = code.trim();
  return /^room(?:\s|\d|#|-|$)/i.test(value) ? value.replace(/^room/i, "Room") : `Room ${value}`;
}
