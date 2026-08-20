/**
 * Community Story Audio Generator — standalone script for GitHub Actions.
 *
 * Processes all community stories with status='under_review' and ttsEngine='edge-tts',
 * generates a cover image + audio narration, deploys to Firebase Hosting, then
 * flips status to 'published' and sends two notifications:
 *   1. To the publisher (authorId) — "Your story is live!"
 *   2. Broadcast to all users — "New story by [author]: [title]"
 *
 * Env vars:
 *   GROQ_API_KEY        — optional, used only if story needs text regeneration
 *   FIREBASE_SERVICE_ACCOUNT — JSON string or path to service account
 *   FIREBASE_PROJECT_ID — default: storybyte-76716
 *   STORIES_FILTER      — if set, process only this single story ID
 */
const admin = require('firebase-admin');
const { execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'storybyte-76716';
const SITE = `https://${PROJECT}.web.app`;

// --- credentials -------------------------------------------------------------
function serviceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const p = path.join(os.tmpdir(), 'sb-sa.json');
    fs.writeFileSync(p, process.env.FIREBASE_SERVICE_ACCOUNT);
    return p;
  }
  const local = path.join(ROOT, 'functions/firebase-service-account.json');
  if (fs.existsSync(local)) return local;
  throw new Error('No Firebase credentials — set FIREBASE_SERVICE_ACCOUNT env var');
}

const SA_PATH = serviceAccountPath();
admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
const db = admin.firestore();
const messaging = admin.messaging();

// --- helpers -----------------------------------------------------------------
const slug = (s) =>
  (s || 'story').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

const hashSeed = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function coverPrompt(story) {
  const mood = story.genre === 'sleep' ? 'calm dreamy nighttime, soft moonlight'
    : story.genre === 'romance' ? 'warm golden tender'
    : story.genre === 'mystery' ? 'moody atmospheric, muted tones'
    : 'warm cinematic storybook';
  const desc = story.description || story.title || '';
  return `${desc}. Storybook cover illustration, ${mood}, painterly, cozy, high detail, no text`;
}

function fetchImage(url, out) {
  return new Promise((resolve, reject) => {
    const f = fs.createWriteStream(out);
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(f);
      f.on('finish', () => f.close(() => resolve()));
    }).on('error', reject).on('timeout', () => this.destroy(new Error('timeout')));
  });
}

const EDGE = [
  ['edge-tts', []],
  ['python3', ['-m', 'edge_tts']],
  ['uvx', ['edge-tts']],
];

function synth(text, voice, out) {
  const txt = path.join(os.tmpdir(), `sb-${Date.now()}.txt`);
  fs.writeFileSync(txt, text, 'utf8');
  const args = ['--voice', voice, '--file', txt, '--write-media', out];
  let ok = false, err;
  for (const [cmd, pre] of EDGE) {
    try {
      if (fs.existsSync(out)) fs.unlinkSync(out);
      execFileSync(cmd, [...pre, ...args], { stdio: 'pipe' });
      if (fs.existsSync(out) && fs.statSync(out).size > 1024) { ok = true; break; }
    } catch (e) { err = e; }
  }
  try { fs.unlinkSync(txt); } catch (e) {}
  if (!ok) throw new Error('edge-tts failed: ' + (err?.message ?? 'unknown'));
}

function durationSec(file) {
  try {
    return Math.round(
      parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
        .toString().trim())
    ) || 0;
  } catch { return 0; }
}

// --- notifications -----------------------------------------------------------

async function sendPublisherNotification(story) {
  // Find the publisher's FCM tokens from their push_tokens subcollection
  const authorId = story.authorId;
  if (!authorId) return;

  try {
    const tokensSnap = await db.collection('users').doc(authorId).collection('push_tokens').get();
    const tokens = tokensSnap.docs
      .map(d => d.data().token)
      .filter(Boolean);

    if (tokens.length === 0) {
      console.log(`  🔔 No push tokens for publisher ${authorId} — writing Firestore notification instead`);
    }

    // Always write a Firestore notification for the publisher
    await db.collection('notifications').add({
      type: 'story_published',
      title: 'Your story is live! 🎉',
      body: `"${story.title}" has been published and is now available to all listeners.`,
      storyId: story.storyId,
      authorId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Also try FCM push if tokens exist
    if (tokens.length > 0) {
      try {
        await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: 'Your story is live! 🎉',
            body: `"${story.title}" is now available.`,
            image: story.coverImage || undefined,
          },
          data: { storyId: story.storyId, type: 'story_published', navigateTo: 'StoryDetail' },
        });
        console.log(`  🔔 FCM push sent to ${tokens.length} device(s) for publisher`);
      } catch (e) {
        console.warn('  ⚠️  FCM push to publisher failed:', e.message);
      }
    }
  } catch (e) {
    console.warn('  ⚠️  Publisher notification failed:', e.message);
  }
}

async function sendBroadcastNotification(story) {
  try {
    // Write a broadcast notification to Firestore — all users can see it
    await db.collection('notifications').add({
      type: 'new_community_story',
      title: `New: "${story.title}"`,
      body: `by ${story.authorName} · ${story.genre} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      storyId: story.storyId,
      authorName: story.authorName,
      authorId: story.authorId,
      genre: story.genre,
      coverImage: story.coverImage,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  📢 Broadcast notification written to Firestore`);

    // Also try FCM push to all registered devices
    try {
      const tokensSnap = await db.collection('push_tokens').where('deletedAt', '==', admin.firestore.FieldValue.delete()).get();
      const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
      if (tokens.length > 0) {
        await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: `New: "${story.title}"`,
            body: `by ${story.authorName} · ${story.genre}`,
            image: story.coverImage || undefined,
          },
          data: { storyId: story.storyId, type: 'new_community_story' },
        });
        console.log(`  📢 FCM broadcast sent to ${tokens.length} device(s)`);
      }
    } catch (e) {
      console.warn('  ⚠️  FCM broadcast failed:', e.message);
    }
  } catch (e) {
    console.warn('  ⚠️  Broadcast notification failed:', e.message);
  }
}

// --- main --------------------------------------------------------------------
async function main() {
  fs.mkdirSync(path.join(PUB, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(PUB, 'covers'), { recursive: true });

  // Determine which stories to process
  let query = db.collection('stories')
    .where('isCommunityStory', '==', true)
    .where('status', '==', 'under_review')
    .where('ttsEngine', '==', 'edge-tts');

  const filterId = (process.env.STORIES_FILTER || '').trim();
  if (filterId) {
    query = query.where('storyId', '==', filterId);
  }

  const snap = await query.get();
  if (snap.empty) {
    console.log('✅ No pending community stories to process.');
    process.exit(0);
  }

  console.log(`\n🎯 Found ${snap.size} pending community story(ies)\n`);

  const processed = [];

  for (const docSnap of snap.docs) {
    const story = docSnap.data();
    const storyId = docSnap.id;
    console.log(`  → ${story.title || 'untitled'} (${storyId})`);

    const coverPath = path.join(PUB, 'covers', `${storyId}.jpg`);
    const audioPath = path.join(PUB, 'audio', `${storyId}.mp3`);

    try {
      // 1. Generate cover image
      await fetchImage(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt(story))}?width=768&height=768&nologo=true&seed=${hashSeed(storyId)}&model=flux`,
        coverPath
      );
      console.log(`    ✅ Cover: ${Math.round(fs.statSync(coverPath).size / 1024)}KB`);

      // 2. Generate audio
      const voice = story.language === 'hi' ? 'hi-IN-SwaraNeural' : 'en-US-AriaNeural';
      synth(story.text, voice, audioPath);
      const dur = durationSec(audioPath) || Math.max(30, Math.round((story.text || '').split(/\s+/).length / 2.5));
      console.log(`    ✅ Audio: ${Math.round(fs.statSync(audioPath).size / 1024)}KB, ${dur}s`);

      // 3. Deploy to Firebase Hosting
      // (deployed after all stories are processed)

      processed.push({ id: storyId, title: story.title, authorName: story.authorName, authorId: story.authorId, genre: story.genre, duration: dur });
    } catch (e) {
      console.error(`    ❌ Failed: ${e.message}`);
      // Mark as failed so it can be retried later
      await db.collection('stories').doc(storyId).update({
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  if (processed.length === 0) {
    console.log('\n❌ No stories processed successfully.');
    process.exit(1);
  }

  // Deploy all generated files
  console.log(`\n🚀 Deploying ${processed.length} story asset(s) to Firebase Hosting...`);
  try {
    execFileSync('npx', ['--yes', 'firebase-tools', 'deploy', '--only', 'hosting', '--project', PROJECT, '--non-interactive'],
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_PATH } });
    console.log('✅ Hosting deployed.');
  } catch (e) {
    console.warn('⚠️  Hosting deploy failed:', e.message);
  }

  // Update Firestore: flip status → published, add audioUrl + coverImage
  for (const item of processed) {
    const audioUrl = `${SITE}/audio/${item.id}.mp3`;
    const coverUrl = `${SITE}/covers/${item.id}.jpg`;

    await db.collection('stories').doc(item.id).update({
      audioUrl,
      coverImage: coverUrl,
      duration: item.duration,
      status: 'published',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✓ ${item.title} → published`);

    // Send two notifications
    await sendPublisherNotification({ ...item, coverImage: coverUrl, storyId: item.id });
    await sendBroadcastNotification({ ...item, coverImage: coverUrl, storyId: item.id });
  }

  console.log(`\n✅ Done. Published ${processed.length} community story(ies).`);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
