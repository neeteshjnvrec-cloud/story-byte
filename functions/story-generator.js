/**
 * Daily Story Generator using Groq LLM
 */

const admin = require('firebase-admin');
const Groq = require('groq-sdk');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

const db = admin.firestore();
const tts = new TextToSpeechClient();

const GENRES = [
  'romance', 'mystery', 'drama', 'fantasy',
  'thriller', 'comedy', 'horror', 'slice-of-life'
];

const GENRE_PROMPTS = {
  romance: 'Write an engaging short romance story with emotional depth and a satisfying ending.',
  mystery: 'Write a compelling mystery story with a clever twist at the end.',
  drama: 'Write a dramatic story about family, love, or personal growth.',
  fantasy: 'Write a fantasy story with a unique magical world and adventure.',
  thriller: 'Write a thrilling story full of suspense and tension.',
  comedy: 'Write a funny, light-hearted story that will make readers smile.',
  horror: 'Write a suspenseful horror story that builds tension gradually.',
  'slice-of-life': 'Write a heartwarming everyday story about real life moments.'
};

/**
 * Generate daily stories
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {Object} options - { count: number, language: string }
 */
async function generateDailyStories(date, options = {}) {
  const { count = 5, language = 'en' } = options;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const groq = new Groq({ apiKey: groqApiKey });
  const generatedStories = [];

  for (let i = 0; i < count; i++) {
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const prompt = GENRE_PROMPTS[genre];

    const langInstruction = language === 'hi'
      ? 'Write the story in Hindi (Devanagari script).'
      : 'Write the story in English.';

    const storyConfig = await generateStoryContent(groq, genre, prompt, langInstruction);
    const audioUrl = await generateAudio(
      `${date}_${genre}_${i + 1}`,
      storyConfig.text,
      language
    );

    const storyData = {
      title: storyConfig.title,
      description: storyConfig.description,
      genre,
      language,
      episode: 1,
      text: storyConfig.text,
      audioUrl,
      duration: storyConfig.duration,
      rating: 0,
      plays: 0,
      isPremium: false,
      status: 'active',
      isDaily: true,
      generatedDate: date,
      author: 'StoryByte AI',
      tags: [genre, 'daily', language],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('stories').add(storyData);
    generatedStories.push({ id: docRef.id, ...storyData });
  }

  return generatedStories;
}

/**
 * Generate story content using Groq
 */
async function generateStoryContent(groq, genre, genrePrompt, langInstruction) {
  const systemPrompt = `You are a professional storyteller. ${genrePrompt} ` +
    `The story should be ${langInstruction} Keep it between 800-1500 words. ` +
    `Structure it with a clear beginning, middle, and end. ` +
    `Use paragraph breaks (blank lines between paragraphs) to separate scenes and ideas.`;

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Write a ${genre} story.` }
      ],
      temperature: 0.8,
      max_tokens: 2048,
      top_p: 0.95
    });

    const text = completion.choices[0].message.content.trim();
    const sentences = text.split(/[.!?]+\s/).filter(s => s.length > 0);
    const duration = sentences.length * 4.5; // ~4.5 seconds per sentence

    // Extract a title from the content
    const firstLine = text.split('\n')[0];
    const title = firstLine.length < 80
      ? firstLine.replace(/[^\w\sऀ-ॿ]/g, '').trim().slice(0, 60)
      : `A ${genre} Story`;

    return {
      title: title || `Daily ${genre} Story`,
      description: `Today's ${genre} story - generated fresh for you`,
      text,
      duration: Math.max(Math.round(duration), 60)
    };
  } catch (error) {
    console.error('Groq API error:', error.message);
    throw error;
  }
}

/**
 * Generate audio using Google Cloud TTS
 */
async function generateAudio(storyId, text, language) {
  try {
    const voiceConfig = language === 'hi' ? {
      languageCode: 'hi-IN',
      name: 'hi-IN-Standard-A',
      ssmlGender: 'FEMALE'
    } : {
      languageCode: 'en-US',
      name: 'en-US-Neural2-F',
      ssmlGender: 'FEMALE'
    };

    const [response] = await tts.synthesizeSpeech({
      input: { text: text.slice(0, 5000) },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0
      }
    });

    // Store audio in Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `audio/${storyId}.mp3`;
    const file = bucket.file(fileName);

    await file.save(response.audioContent, {
      metadata: {
        contentType: 'audio/mpeg'
      }
    });

    // Make public
    await file.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return url;
  } catch (error) {
    console.error('TTS generation error:', error);
    // Return a placeholder URL if TTS fails
    return `https://storage.googleapis.com/storybyte-daily-audio/${storyId}.mp3`;
  }
}

module.exports = { generateDailyStories, generateStoryContent, generateAudio };