// Unified genre list — used across all screens for consistency
export const GENRES = [
  { id: 'romance', label: 'Romance', icon: 'heart' },
  { id: 'mystery', label: 'Mystery', icon: 'search' },
  { id: 'drama', label: 'Drama', icon: 'theater-masks' },
  { id: 'adventure', label: 'Adventure', icon: 'compass' },
  { id: 'sleep', label: 'Sleep', icon: 'moon' },
  { id: 'motivation', label: 'Motivation', icon: 'star' },
  { id: 'devotional', label: 'Devotional', icon: 'flower' },
];

// For profile selection (capitalized)
export const PROFILE_GENRES = GENRES.map(g => g.label);

// Map for API calls (lowercase IDs)
export const GENRE_MAP = GENRES.reduce((acc, g) => {
  acc[g.label] = g.id;
  return acc;
}, {});

// Genre icons mapping
export const GENRE_ICONS = GENRES.reduce((acc, g) => {
  acc[g.id] = g.icon;
  return acc;
}, {});
