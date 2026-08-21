// Community audio generation utilities — GitHub Actions dispatch.
// Extracted from AppContext to keep context focused on user state management.

const GITHUB_OWNER = 'neeteshjnvrec-cloud';
const GITHUB_REPO = 'story-byte';

/**
 * Dispatch the community-stories GitHub Actions workflow, which generates the
 * narration and cover art and then flips the story to `published`.
 *
 * A false return is not fatal — the workflow also runs on an hourly cron that
 * sweeps up any `under_review` story — but it does mean publication is delayed,
 * so the caller should log it.
 *
 * @param {string} storyId - The story ID to trigger generation for
 * @returns {Promise<boolean>} true if GitHub accepted the dispatch
 */
export async function dispatchAudioWorkflow(storyId) {
  const token = process.env.EXPO_PUBLIC_GITHUB_TOKEN;
  if (!token) {
    console.warn('[communityAudioGen] EXPO_PUBLIC_GITHUB_TOKEN not set — skipping workflow dispatch');
    return false;
  }
  try {
    const res = await fetch(
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

    // fetch only rejects on network failure — a 401 (bad token) or 404 (repo or
    // permission wrong) resolves normally. Without this check every dispatch
    // reported success and the story silently never got processed.
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `[communityAudioGen] Workflow dispatch rejected: ${res.status} ${res.statusText} ${body.slice(0, 200)}`
      );
      return false;
    }

    console.log(`[communityAudioGen] Workflow dispatched for story ${storyId}`);
    return true;
  } catch (e) {
    console.error('[communityAudioGen] Workflow dispatch failed:', e.message);
    return false;
  }
}
