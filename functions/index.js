/**
 * Firebase Cloud Functions for Story Byte
 *
 * - Daily story generation using Groq LLM
 * - Audio generation via Google Cloud TTS
 * - User activity tracking
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { generateDailyStories } = require('./story-generator');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

const ttsClient = new TextToSpeechClient();

/**
 * Daily scheduled story generation
 * Runs every day at 6:00 AM UTC
 */
exports.generateDailyStories = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .pubsub
  .schedule('0 6 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const log = await generateDailyStories(today, { count: 5 });

      await db.collection('generation_logs').add({
        date: today,
        count: log.length,
        status: 'success',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Daily stories generated: ${log.length} stories for ${today}`);
      return null;
    } catch (error) {
      console.error('❌ Daily story generation failed:', error);

      await db.collection('generation_logs').add({
        date: new Date().toISOString().split('T')[0],
        status: 'failed',
        error: error.message,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error;
    }
  });

/**
 * Manual story generation endpoint (for testing)
 * POST /generate-stories
 */
exports.manualGenerateStories = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https
  .onRequest(async (req, res) => {
    cors(req, res, async () => {
      try {
        const { count = 3, language = 'en' } = req.body || {};
        const today = new Date().toISOString().split('T')[0];

        const stories = await generateDailyStories(today, { count, language });

        // Send notifications for new stories
        await sendNotifications(stories);

        res.json({
          success: true,
          count: stories.length,
          stories: stories.map(s => ({ id: s.id, title: s.title, genre: s.genre }))
        });
      } catch (error) {
        console.error('Manual generation error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  });

/**
 * Send push notifications to all users with new stories
 * Triggered after story generation
 */
async function sendNotifications(stories) {
  try {
    const fcmTokens = [];
    
    // Get all active FCM tokens from users
    const tokensSnapshot = await db.collection('fcm_tokens').get();
    tokensSnapshot.forEach(doc => {
      const tokenData = doc.data();
      if (tokenData.token && tokenData.deletedAt === undefined) {
        fcmTokens.push(tokenData.token);
      }
    });

    if (fcmTokens.length === 0) {
      console.log('No FCM tokens found for notifications');
      return;
    }

    console.log(`Sending notifications to ${fcmTokens.length} users`);

    // Send batch notifications (FCM allows up to 500 tokens per request)
    const batchSize = 500;
    for (let i = 0; i < fcmTokens.length; i += batchSize) {
      const batch = fcmTokens.slice(i, i + batchSize);
      
      const newStories = stories.slice(0, 3); // Top 3 stories
      
      const promises = newStories.map(async (story) => {
        const payload = {
          tokens: batch,
          notification: {
            title: `New ${story.genre} Story`,
            body: story.title,
            image: story.coverImage,
          },
          data: {
            storyId: story.id,
            type: 'new_story',
            genre: story.genre,
            language: story.language,
            url: `/stories/${story.id}`
          }
        };

        try {
          await admin.messaging().sendEachForMulticast(payload);
        } catch (error) {
          console.error(`Error sending batch notification:`, error);
        }
      });

      await Promise.all(promises);
    }

    console.log(`Notifications sent for ${stories.length} stories`);
  } catch (error) {
    console.error('Notification error:', error);
  }
}

/**
 * API endpoint - list stories
 * GET /api/stories
 */
exports.getStories = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const {
        language,
        genre,
        limit = 20,
        cursor
      } = req.query;

      let query = db.collection('stories').where('status', '==', 'active');

      if (language) query = query.where('language', '==', language);
      if (genre) query = query.where('genre', '==', genre);

      query = query.orderBy('createdAt', 'desc').limit(parseInt(limit));

      if (cursor) {
        const cursorDoc = await db.collection('stories').doc(cursor).get();
        query = query.startAfter(cursorDoc);
      }

      const snapshot = await query.get();
      const stories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];

      res.json({
        stories,
        nextCursor: lastDoc ? lastDoc.id : null,
        total: stories.length
      });
    } catch (error) {
      console.error('Get stories error:', error);
      res.status(500).json({ error: 'Failed to fetch stories' });
    }
  });
});

/**
 * API endpoint - get single story
 * GET /api/stories/:id
 */
exports.getStory = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { id } = req.params;
      const doc = await db.collection('stories').doc(id).get();

      if (!doc.exists) {
        return res.status(404).json({ error: 'Story not found' });
      }

      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch story' });
    }
  });
});

/**
 * API endpoint - increment play count
 * POST /api/stories/:id/play
 */
exports.recordPlay = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { id } = req.params;
      const userId = req.headers.authorization?.split('Bearer ')[1] || null;

      await db.collection('stories').doc(id).update({
        plays: admin.firestore.FieldValue.increment(1),
        lastPlayedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (userId) {
        // Record user activity
        await db.collection('user_activity').add({
          userId,
          storyId: id,
          type: 'play',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to record play' });
    }
  });
});

/**
 * API endpoint - add favorite
 * POST /api/user/favorites/:storyId
 */
exports.addFavorite = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const userId = req.headers.authorization?.split('Bearer ')[1];
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { storyId } = req.params;
      await db.collection('users').doc(userId).collection('favorites').doc(storyId).set({
        addedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add favorite' });
    }
  });
});

/**
 * API endpoint - remove favorite
 * DELETE /api/user/favorites/:storyId
 */
exports.removeFavorite = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const userId = req.headers.authorization?.split('Bearer ')[1];
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { storyId } = req.params;
      await db.collection('users').doc(userId).collection('favorites').doc(storyId).delete();

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });
});

/**
 * API endpoint - get user favorites
 * GET /api/user/favorites
 */
exports.getFavorites = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const userId = req.headers.authorization?.split('Bearer ')[1];
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const snapshot = await db.collection('users').doc(userId).collection('favorites').get();
      const favorites = snapshot.docs.map(doc => ({
        storyId: doc.id,
        ...doc.data()
      }));

      res.json({ favorites });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });
});

/**
 * Webhook to trigger story generation and send notifications
 * GET /api/trigger-story-generation
 */
exports.triggerStoryGeneration = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https
  .onRequest(async (req, res) => {
    cors(req, res, async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { count = 6 } = req.query;
        
        console.log(`Triggering daily stories for ${today}`);
        
        const stories = await generateDailyStories(today, { count });
        
        // Send notifications
        await sendNotifications(stories);
        
        // Update generation log
        await db.collection('generation_logs').doc(today).set({
          date: today,
          count: stories.length,
          status: 'success',
          triggeredBy: 'webhook',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.json({
          success: true,
          count: stories.length,
          stories: stories.map(s => ({ id: s.id, title: s.title, genre: s.genre }))
        });
      } catch (error) {
        console.error('Webhook trigger error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  });
