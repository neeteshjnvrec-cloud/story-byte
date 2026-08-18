// Unified tag list — used across all screens for consistency
export const TAGS = [
  { id: 'friendship', label: 'Friendship' },
  { id: 'family', label: 'Family' },
  { id: 'love', label: 'Love' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'magic', label: 'Magic' },
  { id: 'nature', label: 'Nature' },
  { id: 'teamwork', label: 'Teamwork' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'moral', label: 'Moral Story' },
  { id: 'humor', label: 'Humor' },
  { id: 'courage', label: 'Courage' },
  { id: 'kindness', label: 'Kindness' },
  { id: 'growth', label: 'Personal Growth' },
  { id: 'imagination', label: 'Imagination' },
];

// Map for quick lookup
export const TAG_MAP = TAGS.reduce((acc, t) => {
  acc[t.id] = t.label;
  acc[t.label] = t.id;
  return acc;
}, {});

// Valid tag IDs for validation
export const VALID_TAGS = new Set(TAGS.map(t => t.id));
