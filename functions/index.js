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
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// Transporter for sending password reset code emails
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || '',
  },
});

// Generate a 6-digit numeric code (000000–999999)
function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
 * Send a 6-digit password reset code to user's email
 * POST /send-reset-code
 * Body: { email: "user@example.com" }
 */
exports.sendResetCode = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { email } = req.body || {};
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      // Check if user exists in Firebase Auth
      const userRecord = await admin.auth().getUserByEmail(email);
      if (!userRecord) {
        // Don't reveal if user exists for security
        return res.json({ success: true, message: 'If the email exists, a reset code has been sent' });
      }

      // Generate 6-digit code
      const code = generateResetCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Save code to Firestore with expiry
      await db.collection('password_resets').doc(userRecord.uid).set({
        code,
        email,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: 0,
      });

      // Send email
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@storybyte.app',
        to: email,
        subject: 'Your StoryByte password reset code',
        text: `Your 6-digit password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center;">
              <h1 style="color: white; margin: 0;">StoryByte</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #333;">You requested a password reset. Enter this code in the app:</p>
              <div style="background: white; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${code}</span>
              </div>
              <p style="font-size: 14px; color: #666;">This code expires in 15 minutes.</p>
              <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);

      res.json({ success: true, message: 'Reset code sent to your email' });
    } catch (error) {
      console.error('Send reset code error:', error);
      // Don't reveal if user exists
      if (error.code === 'auth/user-not-found') {
        return res.json({ success: true, message: 'If the email exists, a reset code has been sent' });
      }
      res.status(500).json({ error: 'Failed to send reset code' });
    }
  });
});

/**
 * Verify the 6-digit code and allow password reset
 * POST /verify-reset-code
 * Body: { email: "user@example.com", code: "123456", newPassword: "newpassword123" }
 */
exports.verifyResetCode = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { email, code, newPassword } = req.body || {};
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'Email, code, and new password are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Get user by email
      const userRecord = await admin.auth().getUserByEmail(email);
      if (!userRecord) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      // Fetch stored code
      const docRef = db.collection('password_resets').doc(userRecord.uid);
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      const data = doc.data();
      const now = new Date();

      // Check expiry
      if (data.expiresAt && data.expiresAt.toDate() < now) {
        await docRef.delete();
        return res.status(400).json({ error: 'Code has expired. Request a new one.' });
      }

      // Check attempts (max 5)
      if ((data.attempts || 0) >= 5) {
        await docRef.delete();
        return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
      }

      // Verify code
      if (data.code !== code) {
        await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
        return res.status(400).json({ error: 'Invalid code. Please try again.' });
      }

      // Code is valid - update password in Firebase Auth
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });

      // Delete the reset code (single use)
      await docRef.delete();

      res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      console.error('Verify reset code error:', error);
      res.status(500).json({ error: 'Failed to verify code' });
    }
  });
});