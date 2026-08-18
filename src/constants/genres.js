// Unified genre list — used across all screens for consistency
export const GENRES = [
  { id: 'romance', label: 'Romance' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'drama', label: 'Drama' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'sleep', label: 'Sleep' },
];

// For profile selection (capitalized)
export const PROFILE_GENRES = GENRES.map(g => g.label);

// Map for API calls (lowercase IDs)
export const GENRE_MAP = GENRES.reduce((acc, g) => {
  acc[g.label] = g.id;
  return acc;
}, {});
