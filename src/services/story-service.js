/**
 * Story Service - Handles story generation, retrieval, and management
 * Uses Groq LLM for daily story generation
 */

const { db, storiesCollection } = require('../../firestore/firestore-config');
const { GENRES, LANGUAGES } = require('../types/story');
const axios = require('axios');

// Groq API Configuration (for daily story generation)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_ENDPOINT = 'https://api.groq.com/v1/chat/completions';

// Story Generation Prompts
const PROMPTS = {
  romance: `
    Write a short romance story in Hindi/English about two characters who meet in an unexpected place.
    Include emotional depth, dialogue, and a satisfying conclusion.
    Keep it engaging for a mobile app with ~3000-5000 words.
  `,
  mystery: `
    Write a mystery story with a twist ending. Start with a intriguing situation and build suspense.
    Include red herrings and character development.
    Keep it engaging for a mobile app with ~3000-5000 words.
  `,
  drama: `
    Write a drama story about family relationships and life challenges.
    Focus on emotional storytelling and character growth.
    Keep it engaging for a mobile app with ~3000-5000 words.
  `,
  fantasy: `
    Write a fantasy story set in a magical world. Create unique characters and world-building.
    Focus on adventure and wonder.
    Keep it engaging for a mobile app with ~3000-5000 words.
  `,
  thriller: `
    Write a thriller story with high tension and action. Build suspense throughout.
    End with a shocking twist.
    Keep it engaging for a mobile app with ~3000-5000 words.
  `
};

/**
 * Generate daily stories using Groq LLM
 */
const generateDailyStories = async (date, count = 5, language = 'en') => {
  const stories = [];

  try {
    for (let i = 0; i < count; i++) {
      const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
      const prompt = PROMPTS[genre] || PROMPTS.romance;

      const storyId = `story_${date}_${i + 1}`;

      // Generate story content using Groq
      const storyContent = await generateStoryWithGroq(prompt, language, genre);

      // Generate audio using Google Cloud TTS
      const audioUrl = await generateAudio(storyContent.title, storyContent.text, language);

      const story = {
        id: storyId,
        title: storyContent.title,
        description: storyContent.description,
        text: storyContent.text,
        language: language,
        genre: genre,
        episode: 1,
        audioUrl: audioUrl,
        duration: Math.floor(storyContent.duration / 1000),
        characterCount: storyContent.text.length,
        wordCount: storyContent.text.split(' ').length,
        rating: 0,
        plays: 0,
        isPremium: false,
        status: 'active',
        createdAt: db.FieldValue.serverTimestamp(),
        generatedAt: new Date(date),
        author: 'StoryByte AI',
        tags: [genre, 'daily', language]
      };

      stories.push(story);
    }

    // Save stories to Firestore
    const savedStories = [];
    for (const story of stories) {
      const docRef = await storiesCollection.add(story);
      savedStories.push({ id: docRef.id, ...story });
    }

    return savedStories;
  } catch (error) {
    console.error('Error generating daily stories:', error);
    throw error;
  }
};

/**
 * Generate story using Groq LLM
 */
const generateStoryWithGroq = async (prompt, language, genre) => {
  try {
    const response = await axios.post(
      GROQ_ENDPOINT,
      {
        model: 'llama-3.1-70b-specdec-llama-3.1-adapter-8b-hf-64b-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional storyteller. Generate engaging ${language} stories for audio format. Keep language simple and engaging.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8000,
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data.choices[0].message.content;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;

    return {
      title: `Daily ${genre.charAt(0).toUpperCase() + genre.slice(1)} Story #${Math.floor(Math.random() * 100)}`,
      description: `Enjoy today's carefully crafted ${genre} story`,
      text: text,
      duration: sentences * 300, // Average 5 seconds per sentence
      genre: genre
    };
  } catch (error) {
    console.error('Groq generation error:', error);

    // Fallback to template if Groq fails
    return getFallbackStory(genre, language);
  }
};

/**
 * Fallback story generator when Groq is unavailable
 */
const getFallbackStory = (genre, language) => {
  const templates = {
    romance: {
      title: 'Love in the Library',
      description: 'A chance meeting between two book lovers changes everything.',
      text: 'Maya was browsing the shelves when she spotted Arjun. They both reached for the same book... [Continued story text would go here]'
    },
    mystery: {
      title: 'The Missing Key',
      description: 'A detective discovers a secret that changes everything.',
      text: 'The old mansion had been locked for decades. But today, someone found the key... [Continued story text would go here]'
    }
    // Add more templates for other genres
  };

  return templates[genre] || templates.romance;
};

/**
 * Generate audio using Google Cloud TTS
 */
const generateAudio = async (title, text, language = 'en') => {
  try {
    // This would use Google Cloud TTS to generate audio
    // For now, we use a placeholder audio URL

    const audioUrl = `https://storage.googleapis.com/story-byte-audio/${encodeURIComponent(title)}.mp3`;

    // TODO: Implement actual Google Cloud TTS
    // const speech = require('@google-cloud/speech');
    // const client = new speech.SpeechClient();

    return audioUrl;
  } catch (error) {
    console.error('Audio generation error:', error);
    throw error;
  }
};

/**
 * Get stories with filters
 */
const getStories = async (filters = {}, options = {}) => {
  const {
    limit = 20,
    skip = 0,
    language = null,
    genre = null,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search = null
  } = options;

  let query = storiesCollection.where('status', '==', 'active');

  if (language) query = query.where('language', '==', language);
  if (genre) query = query.where('genre', '==', genre);

  const storiesRef = query.orderBy(sortBy, sortOrder).limit(limit).offset(skip);
  const snapshot = await storiesRef.get();

  let stories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (search) {
    stories = stories.filter(s =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    );
  }

  const totalSnapshot = await storiesCollection.where('status', '==', 'active').get();
  const total = totalSnapshot.size;

  return {
    stories,
    total,
    hasMore: skip + stories.length < total
  };
};

/**
 * Get single story by ID
 */
const getStoryById = async (storyId) => {
  const doc = await storiesCollection.doc(storyId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

/**
 * Add rating to story
 */
const addRating = async (storyId, userId, rating, review = null) => {
  const storyRef = storiesCollection.doc(storyId);
  const story = await storyRef.get();

  if (!story.exists) {
    throw new Error('Story not found');
  }

  const storyData = story.data();
  const existingRatings = storyData.ratings || [];

  // Check if user already rated
  const existingIndex = existingRatings.findIndex(r => r.userId === userId);

  let newRatings;
  if (existingIndex >= 0) {
    newRatings = [...existingRatings];
    newRatings[existingIndex] = {
      userId,
      rating,
      review,
      updatedAt: new Date()
    };
  } else {
    newRatings = [
      ...existingRatings,
      { userId, rating, review, createdAt: new Date() }
    ];
  }

  // Recalculate average
  const totalRating = newRatings.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = totalRating / newRatings.length;

  await storyRef.update({
    ratings: newRatings,
    rating: Math.round(avgRating * 10) / 10,
    totalRatings: newRatings.length
  });
};

/**
 * Get story categories
 */
const getCategories = async () => {
  const snapshot = await storiesCollection
    .where('status', '==', 'active')
    .get();

  const categoryMap = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    const category = data.genre || 'other';
    if (!categoryMap[category]) {
      categoryMap[category] = { count: 0, plays: 0 };
    }
    categoryMap[category].count += 1;
    categoryMap[category].plays += data.plays || 0;
  });

  return Object.entries(categoryMap).map(([category, data]) => ({
    name: category,
    count: data.count,
    totalPlays: data.plays
  }));
};

/**
 * Schedule daily story generation
 */
const scheduleDailyGeneration = async () => {
  const cron = require('node-cron');

  // Run at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await generateDailyStories(today, 10, 'en');
      console.log(`Daily stories generated for ${today}`);
    } catch (error) {
      console.error('Failed to generate daily stories:', error);
    }
  });
};

module.exports = {
  generateDailyStories,
  generateStoryWithGroq,
  getFallbackStory,
  generateAudio,
  getStories,
  getStoryById,
  addRating,
  getCategories,
  scheduleDailyGeneration
};