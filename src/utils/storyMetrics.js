// Story metric helpers — shared by AppContext's metric store and the card
// variants that render these numbers. Kept out of the component tree so the
// context doesn't have to import UI code to read a play count.

// The one place that knows a story's play count has two possible field names.
// Increments always write `plays`; community stories published before that was
// settled carry a permanently-zero `playsCount` instead.
export function storyPlays(story) {
  return story?.plays ?? story?.playsCount ?? 0;
}

export function fmtPlays(n) {
  n = n || 0;
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function fmtMin(sec) {
  if (!sec && sec !== 0) return '';
  const m = Math.round(sec / 60);
  return `${m} min`;
}
