// Story Types for Story Byte

// Genre Categories
const GENRES = [
  'romance',
  'mystery',
  'drama',
  'fantasy',
  'thriller',
  'comedy',
  'horror',
  'slice-of-life',
  'sci-fi',
  'historical'
];

// Languages
const LANGUAGES = [
  'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'or', 'ml',
  'en', 'es', 'fr', 'de', 'it', 'pt',
];

// Story Status
const STORY_STATUS = {
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived'
};

// Story Schema
const STORY_SCHEMA = {
  id: { type: 'string', required: true },
  title: { type: 'string', required: true },
  description: { type: 'string', required: true },
  language: { type: 'string', enum: LANGUAGES, required: true },
  genre: { type: 'string', enum: GENRES, required: true },
  episode: { type: 'number', default: 1 },
  audioUrl: { type: 'string', required: true },
  duration: { type: 'number', required: true }, // in seconds
  characterCount: { type: 'number' },
  wordCount: { type: 'number' },
  rating: { type: 'number', min: 0, max: 5 },
  plays: { type: 'number', default: 0 },
  isPremium: { type: 'boolean', default: false },
  status: { type: 'string', enum: Object.values(STORY_STATUS), default: STORY_STATUS.ACTIVE },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
  generatedAt: { type: 'date' },
  author: { type: 'string' },
  tags: { type: 'array' }
};

// Story Summary
const STORY_SUMMARY_SCHEMA = {
  title: { type: 'string', required: true },
  description: { type: 'string', required: true },
  language: { type: 'string', required: true },
  genre: { type: 'string', required: true },
  audioUrl: { type: 'string', required: true },
  duration: { type: 'number', required: true },
  rating: { type: 'number', min: 0, max: 5 },
  plays: { type: 'number', default: 0 }
};

// Daily Story Generation
const DAILY_STORY_SCHEMA = {
  date: { type: 'date', required: true },
  stories: { type: 'array', items: 'STORY_SUMMARY' },
  totalPlays: { type: 'number', default: 0 },
  newUsers: { type: 'number', default: 0 }
};

module.exports = {
  GENRES,
  LANGUAGES,
  STORY_STATUS,
  STORY_SCHEMA,
  STORY_SUMMARY_SCHEMA,
  DAILY_STORY_SCHEMA
};