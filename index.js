/**
 * Story Byte - Express API Server with Firebase Backend
 *
 * A scalable backend for the audio stories app using Firebase free tier services.
 * Handles story generation, user management, and API endpoints.
 *
 * @author StoryByte Team
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const config = require('./src/constants/config');
const storyService = require('./src/services/story-service');
const { verifyIdToken } = require('./firestore/auth');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for public assets
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '2.0.0'
  });
});

// API Routes
const API_VERSION = '/api/v2';

// Story Routes
app.get(`${API_VERSION}/stories`, async (req, res) => {
  try {
    const {
      language,
      genre,
      search,
      limit = 20,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await storyService.getStories(
      { language, genre },
      { limit: parseInt(limit), skip: parseInt(skip), language, genre, search, sortBy, sortOrder }
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

app.get(`${API_VERSION}/stories/:id`, async (req, res) => {
  try {
    const story = await storyService.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json(story);
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

app.post(`${API_VERSION}/stories/:id/play`, async (req, res) => {
  try {
    await storyService.incrementPlayCount(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing play count:', error);
    res.status(500).json({ error: 'Failed to update play count' });
  }
});

app.post(`${API_VERSION}/stories/:id/rate`, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const userId = req.user?.uid || 'anonymous';

    await storyService.addRating(req.params.id, userId, parseInt(rating), review);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ error: 'Failed to add rating' });
  }
});

app.get(`${API_VERSION}/categories`, async (req, res) => {
  try {
    const categories = await storyService.getCategories();
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// User Routes (Protected by Firebase Auth)
app.get(`${API_VERSION}/user/profile`, verifyFirebaseToken, async (req, res) => {
  try {
    const user = await userService.getUserProfile(req.user.uid);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.put(`${API_VERSION}/user/profile`, verifyFirebaseToken, async (req, res) => {
  try {
    const updatedUser = await userService.updateUserProfile(req.user.uid, req.body);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Favorites Routes
app.get(`${API_VERSION}/favorites`, verifyFirebaseToken, async (req, res) => {
  try {
    const favorites = await userFavoritesService.getUserFavorites(req.user.uid);
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post(`${API_VERSION}/favorites/:storyId`, verifyFirebaseToken, async (req, res) => {
  try {
    await userFavoritesService.addFavorite(req.user.uid, req.params.storyId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

app.delete(`${API_VERSION}/favorites/:storyId`, verifyFirebaseToken, async (req, res) => {
  try {
    await userFavoritesService.removeFavorite(req.user.uid, req.params.storyId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// User Stats Routes
app.get(`${API_VERSION}/user/stats`, verifyFirebaseToken, async (req, res) => {
  try {
    const stats = await userActivityService.getUserStats(req.user.uid);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

app.get(`${API_VERSION}/user/history`, verifyFirebaseToken, async (req, res) => {
  try {
    const history = await userActivityService.getUserHistory(req.user.uid);
    res.json({ history });
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Auth Routes
app.post(`${API_VERSION}/auth/exchange-token`, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'ID token required' });
    }

    const decodedToken = await verifyIdToken(idToken);
    const user = await userService.createOrGetUser(decodedToken);

    res.json({ token: decodedToken.uid, user });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post(`${API_VERSION}/auth/forgot-password`, async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.sendPasswordReset(email);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Story Byte API',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      auth: `${API_VERSION}/auth`,
      stories: `${API_VERSION}/stories`,
      categories: `${API_VERSION}/categories`,
      user: `${API_VERSION}/user`,
      favorites: `${API_VERSION}/favorites`
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}${API_VERSION}`);
});

module.exports = app;