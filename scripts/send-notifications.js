/**
 * Send FCM notifications to all registered users
 * Uses Firebase Admin SDK (requires service account credentials)
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const SA_PATH = path.join(ROOT, 'functions/firebase-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(SA_PATH))
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

async function sendNotifications(stories) {
  if (stories.length === 0) {
    console.log('No stories to notify about');
    return;
  }

  console.log(`📩 Sending notifications for ${stories.length} stories...`);

  try {
    // Get all FCM tokens from Firestore
    const tokensSnapshot = await db.collection('fcm_tokens').where('deletedAt', '==', admin.firestore.FieldValue.delete()).get();
    
    if (tokensSnapshot.empty) {
      console.log('No FCM tokens found');
      return;
    }

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      const token = doc.data().token;
      if (token) tokens.push(token);
    });

    console.log(`Found ${tokens.length} registered devices`);

    // Take top 3 stories for notification
    const featuredStories = stories.slice(0, 3);
    
    // Send notification for each story
    for (const story of featuredStories) {
      const message = {
        notification: {
          title: `New ${story.genre.charAt(0).toUpperCase() + story.genre.slice(1)} Story`,
          body: story.title,
          image: story.coverImage || undefined
        },
        data: {
          storyId: story.id,
          type: 'new_story',
          genre: story.genre,
          language: story.language,
          title: story.title
        },
        tokens: tokens,
        options: {
          // FCM allows up to 500 tokens per request
          validationMode: 'FIREBASE'
        }
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(`✅ Sent notification for "${story.title}"`);
        console.log(`   Success: ${response.successCount}, Failure: ${response.failureCount}`);
        
        // Clean up invalid tokens
        if (response.responses && response.responses.some(r => !r.success)) {
          const invalidTokens = tokens.filter((_, i) => !response.responses[i]?.success);
          console.log(`   Removing ${invalidTokens.length} invalid tokens`);
        }
      } catch (error) {
        console.error(`❌ Failed to send notification for "${story.title}":`, error.message);
      }
    }

    console.log('🎉 All notifications sent!');
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
}

// Export for use in build-stories.js
module.exports = { sendNotifications };
