/**
 * CLI script to generate daily stories using Groq
 *
 * Usage: node scripts/generate-stories.js --count 5 --language en
 */

const admin = require('firebase-admin');
const path = require('path');
const { generateDailyStories } = require('../functions/story-generator');

// Parse command line arguments
const args = process.argv.slice(2);
const countIndex = args.indexOf('--count');
const langIndex = args.indexOf('--language');

const count = countIndex >= 0 ? parseInt(args[countIndex + 1]) : 5;
const language = langIndex >= 0 ? args[langIndex + 1] : 'en';

async function main() {
  console.log('🚀 Starting story generation...');
  console.log(`Count: ${count}, Language: ${language}`);

  try {
    // Initialize Firebase Admin if not already done
    if (!admin.apps.length) {
      const serviceAccount = require(path.resolve(__dirname, '../firebase-service-account.json'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const stories = await generateDailyStories(today, { count, language });

    console.log(`✅ Generated ${stories.length} stories for ${today}:`);
    stories.forEach((story, i) => {
      console.log(`  ${i + 1}. ${story.title} [${story.genre}] - ${story.duration}s`);
    });
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0));