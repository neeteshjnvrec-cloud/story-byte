/**
 * Configuration constants for Story Byte application
 */

// API base URL - uses Firebase Functions
const BASE_URL = process.env.REACT_APP_API_URL || 'https://us-central1-storybyte-app.cloudfunctions.net';

// API version - v2 for new Firebase backend
const API_VERSION = 'v2';

// Endpoints
export const API_ENDPOINTS = {
  // Stories
  STORIES: `/api/${API_VERSION}/stories`,
  STORY_DETAIL: (id) => `/api/${API_VERSION}/stories/${id}`,
  STORY_PLAY: (id) => `/api/${API_VERSION}/stories/${id}/play`,
  STORY_RATE: (id) => `/api/${API_VERSION}/stories/${id}/rate`,

  // Categories
  CATEGORIES: `/api/${API_VERSION}/categories`,

  // User
  USER_PROFILE: `/api/${API_VERSION}/user/profile`,
  USER_FAVORITES: `/api/${API_VERSION}/user/favorites`,
  USER_FAVORITE_ADD: (storyId) => `/api/${API_VERSION}/user/favorites/${storyId}`,
  USER_FAVORITE_REMOVE: (storyId) => `/api/${API_VERSION}/user/favorites/${storyId}`,
  USER_FAVORITE_CHECK: (storyId) => `/api/${API_VERSION}/user/favorites/${storyId}/check`,

  // Authentication
  AUTH_SIGNIN: `/api/${API_VERSION}/auth/signin`,
  AUTH_SIGNOUT: `/api/${API_VERSION}/auth/signout`,
  AUTH_REFRESH: `/api/${API_VERSION}/auth/refresh`,

  // Admin
  GENERATE_STORIES: `/generate-stories`,
};

// Request timeout (in milliseconds)
export const API_TIMEOUT = 30000;

// Maximum retry attempts
export const MAX_RETRIES = 3;

// Pagination settings
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
};

// Cache settings (in milliseconds)
export const CACHE_TTL = {
  STORIES: 5 * 60 * 1000, // 5 minutes
  STORY_DETAIL: 10 * 60 * 1000, // 10 minutes
  CATEGORIES: 1 * 60 * 60 * 1000, // 1 hour
};

// API version for headers
export const API_VERSION_HEADER = `StoryByte/${API_VERSION}`;

// Content type
export const CONTENT_TYPE_JSON = 'application/json';

export default {
  BASE_URL,
  API_VERSION,
  ...API_ENDPOINTS,
};
