// Audio Service - Using Google Cloud TTS for story narration
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');

// Initialize Google Cloud Text-to-Speech client
const client = new TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-credentials.json'
});

class AudioService {
  constructor() {
    this.audioCache = new Map();
  }

  async generateStoryAudio(storyId, text, language = 'en', voiceName = 'en-US-Studio-M') {
    try {
      const fileName = `story_${storyId}_${Date.now()}.mp3`;
      const outputPath = path.join(__dirname, '../../public/audio', fileName);

      // Prepare the synthesis input
      const input = {
        text: text
      };

      // Select the language and voice
      const selectVoice = {
        languageCode: language.includes('hi') ? 'hi-IN' : 'en-US',
        name: voiceName,
        ssmlGender: 'FEMALE'
      };

      // Build the synthesis request
      const request = {
        input: input,
        voice: selectVoice,
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0,
          volumeGainDb: 0
        }
      };

      // Use the synthesize speech method
      const [response] = await client.synthesizeSpeech(request);

      // Write the audio content to a file
      const writePromise = fs.promises.writeFile(outputPath, response.audioContent, 'binary');
      await writePromise;

      // Return the audio URL (in production, you'd use CDN)
      const audioUrl = `${process.env.CDN_URL || 'https://storage.googleapis.com'}/${process.env.FIREBASE_STORAGE_BUCKET}/audio/${fileName}`;

      // Cache the mapping
      this.audioCache.set(storyId, {
        url: audioUrl,
        timestamp: Date.now(),
        language,
        voiceName
      });

      return audioUrl;
    } catch (error) {
      console.error('Error generating audio:', error);
      throw error;
    }
  }

  async batchGenerateAudio(stories) {
    const results = [];

    for (const story of stories) {
      try {
        const text = story.text || story.description;
        const audioUrl = await this.generateStoryAudio(story.id, text, story.language);
        results.push({ ...story, audioUrl });
      } catch (error) {
        console.error(`Failed to generate audio for story ${story.id}:`, error);
        results.push({ ...story, audioUrl: null, error: error.message });
      }
    }

    return results;
  }

  getCachedAudio(storyId) {
    const cached = this.audioCache.get(storyId);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.url;
    }
    return null;
  }

  isAudioExpired(storyId) {
    const cached = this.audioCache.get(storyId);
    return !cached || Date.now() - cached.timestamp > 3600000;
  }

  async regenerateAudioIfExpired(storyId, text, language = 'en') {
    if (this.isAudioExpired(storyId)) {
      return await this.generateStoryAudio(storyId, text, language);
    }
    return this.getCachedAudio(storyId);
  }
}

module.exports = new AudioService();