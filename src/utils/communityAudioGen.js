// Community audio generation utilities — GitHub Actions dispatch + audio polling.
// Extracted from AppContext to keep context focused on user state management.

const GITHUB_OWNER = 'neeteshjnvrec-cloud';
const GITHUB_REPO = 'story-byte';
const GITHUB_WORKFLOW = 'community-stories.yml';
const MAX_POLL = 60;       // seconds to wait for audio generation
const POLL_INTERVAL = 1000; // ms between polls

/**
 * Dispatch the daily-stories GitHub Actions workflow to trigger audio generation.
 * @param {string} storyId - The story ID to trigger generation for
 * @returns {Promise<boolean>} true if dispatch succeeded
 */
export async function dispatchAudioWorkflow(storyId) {
  const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
  if (!token) {
    console.warn('[communityAudioGen] EXPO_PUBLIC_GITHUB_TOKEN not set — skipping workflow dispatch');
    return false;
  }
  try {
    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'community-story-published',
          client_payload: { storyId },
        }),
      }
    );
    console.log(`[communityAudioGen] Workflow dispatched for story ${storyId}`);
    return true;
  } catch (e) {
    console.error('[communityAudioGen] Workflow dispatch failed:', e.message);
    return false;
  }
}

/**
 * Poll Firestore until the story has a real hosting audioUrl.
 * @param {string} storyId - The story ID to poll for
 * @param {Object} db - Firebase Firestore db instance
 * @returns {Promise<Object|null>} The updated story data, or null on timeout
 */
export function waitForAudioGeneration(storyId, db) {
  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 1;
      try {
        const { getDoc } = require('firebase/firestore');
        const { doc } = require('firebase/firestore');
        const snapshot = await getDoc(doc(db, 'stories', storyId));
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.audioUrl && data.audioUrl.startsWith('https://storybyte-76716.web.app')) {
            clearInterval(interval);
            resolve(data);
            return;
          }
        }
      } catch (_) {}
      if (elapsed >= MAX_POLL) {
        clearInterval(interval);
        resolve(null);
      }
    }, POLL_INTERVAL);
  });
}
