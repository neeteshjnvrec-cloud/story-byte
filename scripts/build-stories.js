/**
 * Standalone Story Generator — runs locally on your machine, NOT on Firebase
 * Cloud Functions (which require the Blaze plan).
 *
 * Uses Groq LLM for story content + Google Cloud TTS for audio narration.
 * Writes generated stories directly to Firestore (free Spark tier compatible).
 *
 * Prerequisites:
 *   1. GROQ_API_KEY set in environment (or .env in project root)
 *   2. GOOGLE_APPLICATION_CREDENTIALS pointing to your GCP service account JSON
 *   3. functions/firebase-service-account.json with service account credentials
 *
 * Run:
 *   node scripts/build-stories.js                  # generate 5 English stories
 *   node scripts/build-stories.js --count 10       # generate 10 stories
 *   node scripts/build-stories.js --language hi    # generate Hindi stories
 */
require('dotenv').config();
const { generateDailyStories } = require('../functions/story-generator');

const today = new Date().toISOString().split('T')[0];

async function main() {
  const args = process.argv.slice(2);
  const count = args.includes('--count')
    ? parseInt(args[args.indexOf('--count') + 1]) || 5
    : 5;
  const language = args.includes('--language')
    ? args[args.indexOf('--language') + 1] || 'en'
    : 'en';

  console.log('🎭 StoryByte standalone generator starting...');
  console.log('   Date:', today);
  console.log('   Count:', count);
  console.log('   Language:', language);

  try {
    const stories = await generateDailyStories(today, { count, language });
    console.log('✅ Generated', stories.length, 'stories successfully!');
    stories.forEach((s) => {
      console.log('   -', s.title, '(' + s.genre + ')');
    });
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    process.exit(1);
  }
}

main();
