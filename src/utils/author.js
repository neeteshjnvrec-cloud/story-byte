// Who wrote a story, for the Community feed and the story page.
//
// Community stories carry authorName, saved once when they're published:
// the profile's name, or for an account without one, the first name from its
// email (myAuthorName). Some older stories saved "Anonymous"; your own of
// those show your name. The daily library carries its name under `author`.

/** The name to show for `story`'s author. `me` is { uid, name } of whoever is signed in. */
export function authorOf(story, me) {
  const stored = String(story?.authorName || '').trim();
  if (stored && stored !== 'Anonymous') return stored;
  if (me?.uid && story?.authorId === me.uid && me.name) return me.name;
  const library = String(story?.author || '').trim();
  if (library) return library;
  return story?.isCommunityStory ? 'Anonymous' : 'StoryByte';
}

/** "neetesh.kumar92@gmail.com" → "Neetesh": the first word before the @. */
export function nameFromEmail(email) {
  const first = String(email || '').split('@')[0].split(/[._\-+\d]+/).find(Boolean) || '';
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
}

/** The signed-in listener's name, as published on their stories and
 *  comments: the profile's name, else the first name from their email. */
export function myAuthorName(user, userStats) {
  const saved = String(userStats?.fullName || userStats?.displayName || user?.displayName || '').trim();
  return saved || nameFromEmail(user?.email);
}
