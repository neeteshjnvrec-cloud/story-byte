/**
 * What India is searching for right now, so the daily katha's title, hook,
 * description and tags use the words viewers are actually typing — the
 * channel's own trend-riding Shorts (a trending audio, Neem Karoli Baba)
 * pull 300-1,200 views while untimely ones sit in single digits.
 *
 * Two free, keyless sources:
 *   - Google Trends' daily trending searches for India (RSS), filtered down
 *     to devotional ones (festivals, deities, temples, saints, vrat, aarti…).
 *   - YouTube's own search autocomplete, seeded with the day's deity and
 *     festival — the phrases people type into YouTube about them.
 *
 * Best-effort: any failure just returns fewer (or no) phrases, and the story
 * is written exactly as it would be without them.
 */
const TIMEOUT_MS = 10000;

// Devotional terms. A trending search whose own title matches is worth
// telling the writer about; everything else (cricket, markets, politics) is
// dropped. English terms match whole words only ("ram" must not match
// "program"); Devanagari ones are long enough to match as substrings.
const LATIN = ['navratri', 'durga', 'garba', 'dussehra', 'dasara', 'diwali', 'deepavali', 'karva chauth', 'chhath',
  'ekadashi', 'purnima', 'amavasya', 'vrat', 'puja', 'pooja', 'aarti', 'katha', 'bhajan', 'chalisa', 'mandir',
  'temple', 'jayanti', 'mahadev', 'shiva', 'krishna', 'radha', 'hanuman', 'ganesh', 'ganpati', 'lakshmi', 'vishnu',
  'shani', 'kali', 'saraswati', 'khatu shyam', 'balaji', 'tirupati', 'kedarnath', 'vrindavan', 'ayodhya', 'mahakal',
  'neem karoli', 'premanand', 'ram navami', 'shri ram', 'ramayan', 'ram mandir'];
const DEVANAGARI = ['नवरात्र', 'दुर्गा', 'गरबा', 'दशहरा', 'दिवाली', 'दीपावली', 'करवा चौथ', 'छठ पूजा', 'एकादशी',
  'पूर्णिमा', 'अमावस्या', 'व्रत', 'पूजा', 'आरती', 'कथा', 'भजन', 'चालीसा', 'मंदिर', 'जयंती', 'महादेव', 'शिवजी',
  'कृष्ण', 'राधा', 'हनुमान', 'गणेश', 'गणपति', 'लक्ष्मी', 'विष्णु', 'शनि देव', 'काली माँ', 'सरस्वती', 'खाटू श्याम',
  'बालाजी', 'तिरुपति', 'केदारनाथ', 'वृंदावन', 'अयोध्या', 'महाकाल', 'नीम करोली', 'प्रेमानंद', 'राम नवमी', 'श्री राम', 'रामायण', 'राम मंदिर'];
const DEVOTIONAL = new RegExp(`\\b(${LATIN.join('|')})\\b|${DEVANAGARI.join('|')}`, 'i');

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept-Language': 'hi-IN,hi;q=0.9,en;q=0.8' } });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Today's devotional trending searches in India (Google Trends RSS). */
async function trendingDevotional() {
  const xml = await get('https://trends.google.com/trending/rss?geo=IN');
  return xml.split('<item>').slice(1)
    .map((item) => decode(item.match(/<title>([^<]*)<\/title>/)?.[1] || '').trim())
    .filter((title) => title && DEVOTIONAL.test(title))
    .slice(0, 8);
}

/** YouTube search autocomplete for `seed` (Hindi, India). */
async function youtubeSuggestions(seed) {
  const body = await get(`https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&hl=hi&gl=IN&q=${encodeURIComponent(seed)}`);
  try {
    const json = JSON.parse(body.slice(body.indexOf('(') + 1, body.lastIndexOf(')')));
    return (json[1] || []).map((row) => String(row[0] || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Searches for music, ringtones and status videos say what people want to
// watch, but a narrated katha can't be one — don't steer the title at them.
// Regional-dialect requests ("… वागडी भाषा में") aren't what a Hindi katha is.
const NOT_A_KATHA = /गाना|गाने|सॉन्ग|song|dj|रिंगटोन|ringtone|status|स्टेटस|mp3|lyrics|लिरिक्स|karaoke|whatsapp|भाषा|bhasha/i;

/**
 * Returns { trending: [...], searches: [...] } — today's devotional trending
 * searches, and what people type into YouTube about `seeds` (deity and
 * festival names, most specific first).
 */
async function devotionalTrends(seeds = []) {
  const [trending, ...lists] = await Promise.all([
    trendingDevotional(),
    ...seeds.filter(Boolean).map((s) => youtubeSuggestions(s)),
  ]);
  // Round-robin across the seeds, so one seed's dozen near-identical
  // completions ("… की कथा सुनाइए / बताइए / सुनाओ") don't crowd out the rest.
  const seen = new Set();
  const searches = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    for (const list of lists) {
      const phrase = list[i];
      if (!phrase) continue;
      const key = phrase.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key) || NOT_A_KATHA.test(phrase)) continue;
      seen.add(key);
      searches.push(phrase);
    }
  }
  return { trending, searches: searches.slice(0, 12) };
}

module.exports = { devotionalTrends, DEVOTIONAL };
