export function highlightMatch(text: string, query: string): string {
  if (!query || query.length < 2) return text;
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  let result = text;
  for (const word of words) {
    const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '⟪$1⟫');
  }
  return result;
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}
