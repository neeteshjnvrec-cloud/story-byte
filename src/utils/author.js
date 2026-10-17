// Who wrote a story, for the Community feed and the story page.
//
// Community stories carry authorName (what the app saved when it was
// published); older ones saved "Anonymous" when the profile had no full name
// yet, which the community pipeline now replaces with the author's profile
// name (scripts/generate-community-audio.js). Until it has, your own stories
// show your own name. The daily library carries its name under `author`.

/** The name to show for `story`'s author. `me` is { uid, name } of whoever is signed in. */
export function authorOf(story, me) {
  const stored = String(story?.authorName || '').trim();
  if (stored && stored !== 'Anonymous') return stored;
  if (me?.uid && story?.authorId === me.uid && me.name) return me.name;
  const library = String(story?.author || '').trim();
  if (library) return library;
  return story?.isCommunityStory ? 'Anonymous' : 'StoryByte';
}

/** The signed-in listener's own name, for authorOf. */
export function myAuthorName(user, userStats) {
  return String(userStats?.fullName || userStats?.displayName || user?.displayName || '').trim();
}
