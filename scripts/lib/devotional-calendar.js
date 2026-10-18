/**
 * What the daily story is about: one well-known katha of the deity
 * traditionally worshipped on that weekday (Monday Shiva, Tuesday Hanuman,
 * …). The accounts this posts to were built on devotional content — Bal
 * Krishna reels and murti Shorts pull 1K-41K views while generic romance /
 * mystery / sleep stories drew 1-7 (reports/social, Sept 2026) — so every
 * daily story is now a retelling of a story that audience already loves,
 * not an invented "story with a moral".
 *
 * Each deity has a list of kathas; the week number picks one, so a given
 * weekday cycles through its whole list before repeating (8 kathas = 8
 * weeks). Devotional festivals (occasions.js) take priority over this.
 */

const DEITIES = {
  // Sunday is Surya's day by custom; Krishna leads here instead because the
  // Facebook page and Instagram account are Krishna-branded and Bal Krishna
  // reels were their best posts.
  0: {
    key: 'krishna', name: 'Krishna', hindi: 'श्री कृष्ण',
    visual: 'little Bal Krishna with a peacock feather crown and flute, blue skin, Vrindavan, Gokul',
    hashtags: ['#krishna', '#radhekrishna', '#jaishreekrishna', '#balkrishna'],
    kathas: [
      'Makhan chor — baby Krishna stealing butter and Yashoda catching him',
      'Yashoda sees the whole universe inside little Krishna\'s mouth',
      'Krishna lifts Govardhan hill on his little finger to shelter Vrindavan from Indra\'s storm',
      'Kaliya Daman — Krishna dances on the hood of the serpent Kaliya in the Yamuna',
      'Krishna and his poor friend Sudama — the handful of rice',
      'Yashoda ties Krishna to the grinding mortar (Damodar leela) and the two trees are freed',
      'Krishna protects Draupadi\'s honour with an endless sari',
      'The demoness Putana comes as a nurse and baby Krishna defeats her',
    ],
  },
  1: {
    key: 'shiva', name: 'Shiva', hindi: 'महादेव',
    visual: 'Lord Shiva with blue throat, crescent moon, Ganga in his matted hair, trishul and damru, Mount Kailash',
    hashtags: ['#mahadev', '#harharmahadev', '#shiva', '#bholenath'],
    kathas: [
      'Neelkanth — Shiva drinks the halahala poison during the churning of the ocean',
      'Shiva catches the descending Ganga in his hair to save the earth',
      'Markandeya clings to the Shivling and Shiva defeats Yama to save him',
      'Parvati\'s tapasya to win Shiva as her husband',
      'The hunter who unknowingly worshipped Shiva all night on Maha Shivratri',
      'Shiva appears as an endless pillar of light before Brahma and Vishnu (Jyotirlinga)',
      'Ravana tries to lift Kailash and Shiva presses it down with his toe',
      'Nandi\'s devotion — how Nandi became Shiva\'s vahana and gatekeeper',
    ],
  },
  2: {
    key: 'hanuman', name: 'Hanuman', hindi: 'हनुमान जी',
    visual: 'Lord Hanuman, strong and devoted, saffron, carrying his mace, flying across the sky',
    hashtags: ['#hanuman', '#jaishreeram', '#bajrangbali', '#hanumanji'],
    kathas: [
      'Baby Hanuman leaps to swallow the sun, thinking it is a fruit',
      'Hanuman leaps across the ocean to Lanka to find Sita',
      'Hanuman carries the whole Sanjeevani mountain to save Lakshmana',
      'Hanuman tears open his chest to show Ram and Sita in his heart',
      'Hanuman\'s burning tail sets Lanka ablaze',
      'Hanuman is reminded of his forgotten powers by Jambavan',
      'Hanuman humbles Bhima as an old monkey whose tail Bhima cannot lift',
      'Hanuman meets Ram for the first time in the forest of Kishkindha',
    ],
  },
  3: {
    key: 'ganesh', name: 'Ganesh', hindi: 'गणपति बप्पा',
    visual: 'Lord Ganesha with elephant head, modak, his mouse vahana, golden ornaments',
    hashtags: ['#ganpatibappamorya', '#ganesha', '#ganpati', '#vighnaharta'],
    kathas: [
      'Parvati creates Ganesha and he guards her door against Shiva — how he got the elephant head',
      'Ganesha circles his parents to win the race around the world against Kartikeya',
      'Ganesha writes the Mahabharata as Ved Vyasa dictates, breaking his tusk as a pen',
      'The moon laughs at Ganesha and is cursed — why the moon is not seen on Ganesh Chaturthi',
      'Kubera\'s feast — little Ganesha eats everything and is satisfied by one grain from Shiva',
      'How the mouse Mooshak became Ganesha\'s vahana',
      'Ganesha and the old woman\'s simple devotion',
      'Ganesha humbles the proud river Kaveri and Sage Agastya\'s pot',
    ],
  },
  // Thursday: Vishnu. His avatar Shorts (Matsya, Kalki, Kurma) are among the
  // channel's most-viewed.
  4: {
    key: 'vishnu', name: 'Vishnu', hindi: 'भगवान विष्णु',
    visual: 'Lord Vishnu with four arms holding conch, chakra, mace and lotus, resting on Sheshnaag in the cosmic ocean',
    hashtags: ['#vishnu', '#narayan', '#harinarayan', '#dashavatar'],
    kathas: [
      'Matsya avatar — Vishnu as a giant fish saves Manu and the Vedas from the great flood',
      'Kurma avatar — Vishnu becomes a tortoise to hold Mount Mandara during the ocean churning',
      'Narasimha avatar — Vishnu bursts from a pillar to protect the child devotee Prahlad',
      'Vamana avatar — the dwarf who measured the three worlds in three steps from King Bali',
      'Varaha avatar — Vishnu as a boar lifts Mother Earth from the cosmic ocean',
      'Dhruva\'s tapasya — the little boy who became the Pole Star',
      'Gajendra Moksha — Vishnu saves the elephant king from the crocodile',
      'Kalki avatar — the prophecy of Vishnu\'s final avatar on a white horse',
    ],
  },
  5: {
    key: 'devi', name: 'Maa Durga and Maa Lakshmi', hindi: 'माँ दुर्गा',
    visual: 'Goddess Durga riding a lion with many arms and weapons, or Goddess Lakshmi on a lotus with gold coins',
    hashtags: ['#maadurga', '#jaimatadi', '#maalakshmi', '#navratri'],
    kathas: [
      'Maa Durga is born from the combined light of the gods and slays Mahishasura',
      'Goddess Lakshmi rises from the churning of the ocean',
      'Maa Kali\'s fierce form and the demon Raktabeej',
      'Sati\'s sacrifice and the Shakti Peethas',
      'Maa Lakshmi visits the home of a poor but honest devotee on Diwali night',
      'Shailaputri — Parvati is reborn as the daughter of the Himalaya',
      'Maa Vaishno Devi and Bhairavnath',
      'Why Lakshmi chose Vishnu at the ocean churning',
    ],
  },
  // Saturday: Shani Dev, whose best-known kathas are with Hanuman.
  6: {
    key: 'shani', name: 'Shani Dev', hindi: 'शनि देव',
    visual: 'Shani Dev in dark blue robes riding a crow, solemn and just, with Lord Hanuman',
    hashtags: ['#shanidev', '#jaishanidev', '#hanuman', '#bhakti'],
    kathas: [
      'Hanuman frees Shani Dev from Ravana\'s prison and Shani promises to spare his devotees',
      'King Vikramaditya\'s test by Shani Dev',
      'Why oil is offered to Shani Dev — Hanuman heals his wounds',
      'Shani Dev\'s gaze falls on baby Ganesha',
      'Shani Dev tests the honest woodcutter',
      'Shani Dev\'s birth — son of Surya and Chhaya',
      'Raja Harishchandra\'s trials of truth',
      'Pippalada and Shani Dev — the sage who questioned the planets',
    ],
  },
};

const GENERAL_HASHTAGS = ['#bhakti', '#sanatandharma', '#hindu', '#storybyte'];

/** Weekday in India (IST): the daily job runs in the small hours of the
 *  morning IST, which is still the previous day in UTC. */
function istWeekday(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).getUTCDay();
}

/** `dateStr` (YYYY-MM-DD) plus `n` days. */
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A date's deity and katha. Everything keys off the run's India date
 *  (YYYY-MM-DD), so the katha is stable across retries of the same day and
 *  tomorrow's is simply date + 1. */
function deityOfDay(dateStr) {
  const deity = DEITIES[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
  const week = Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / (7 * 86400000));
  return { ...deity, katha: deity.kathas[week % deity.kathas.length] };
}

/** Today's date in India (YYYY-MM-DD) — see istWeekday. */
function istDate(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

// Navratri: each of the nine days is devoted to one of the nine forms of
// Durga (Navadurga), and that day's form is what devotees search for
// ("मां शैलपुत्री की कथा" tops YouTube's suggestions on day 1). Chaitra
// (spring) and Sharad (autumn) Navratri both follow it.
const NAVADURGA = [
  ['Shailputri', 'माँ शैलपुत्री', 'daughter of the mountain king Himavan, riding the bull Nandi, trident and lotus in her hands', 'how Sati was reborn as Shailputri, daughter of the Himalaya, after her sacrifice at Daksha\'s yagna'],
  ['Brahmacharini', 'माँ ब्रह्मचारिणी', 'barefoot ascetic goddess in white, rosary and water pot, deep in meditation in a forest', 'Parvati\'s thousands of years of tapasya as Brahmacharini to win Shiva'],
  ['Chandraghanta', 'माँ चंद्रघंटा', 'golden goddess riding a tiger, a half-moon shaped like a bell on her forehead, ten arms with weapons', 'how Chandraghanta\'s bell-like roar terrified the demons and calmed Shiva\'s wedding procession'],
  ['Kushmanda', 'माँ कूष्मांडा', 'radiant eight-armed goddess on a lion, glowing like the sun, creating the cosmos with her smile', 'how Kushmanda created the universe with her smile when there was only darkness'],
  ['Skandamata', 'माँ स्कंदमाता', 'mother goddess on a lion holding baby Kartikeya (Skanda) in her lap, lotus flowers', 'Skandamata, mother of Kartikeya, and how her son defeated the demon Tarakasura'],
  ['Katyayani', 'माँ कात्यायनी', 'fierce warrior goddess on a lion, sword raised, born in Sage Katyayan\'s ashram', 'how Katyayani was born to Sage Katyayan and slew Mahishasura'],
  ['Kalaratri', 'माँ कालरात्रि', 'dark fierce goddess riding a donkey, flowing hair, fiery breath, protecting her devotees', 'how Kalaratri destroyed the demon Raktabeej, whose every drop of blood spawned a new demon'],
  ['Mahagauri', 'माँ महागौरी', 'serene goddess in pure white riding a white bull, glowing like the moon', 'how Parvati\'s tapasya-darkened skin was washed in the Ganga by Shiva and she became radiant Mahagauri'],
  ['Siddhidatri', 'माँ सिद्धिदात्री', 'goddess seated on a lotus granting the eight siddhis, devotees and gods bowing before her', 'how Siddhidatri granted Shiva the eight siddhis, making him Ardhanarishvara'],
];

// Each Navratri's first day (Drik Panchang). Refresh yearly alongside
// occasions.js.
const NAVRATRIS = [
  { start: '2026-10-11', name: 'Navratri', hashtag: '#navratri' },
  { start: '2027-04-07', name: 'Chaitra Navratri', hashtag: '#chaitranavratri' },
  { start: '2027-09-30', name: 'Navratri', hashtag: '#navratri' },
];

/** That date's Navadurga form (as a deity-of-the-day) during a Navratri, else null. */
function navratriDeity(dateIst) {
  for (const n of NAVRATRIS) {
    const day = Math.round((Date.parse(`${dateIst}T00:00:00Z`) - Date.parse(`${n.start}T00:00:00Z`)) / 86400000);
    if (day < 0 || day > 8) continue;
    const [name, hindi, visual, katha] = NAVADURGA[day];
    return {
      key: 'devi', name: `Maa ${name} (${n.name} day ${day + 1})`, hindi, visual, katha,
      hashtags: [n.hashtag, '#jaimatadi', `#maa${name.toLowerCase()}`, '#maadurga'],
    };
  }
  return null;
}

/**
 * A festival day's katha (occasions.js) in the shape of a deity-of-the-day,
 * so the writer, cover and video treat it like any other katha. `eve` picks
 * the festival's best-known katha, posted the afternoon before.
 */
function festivalDeity(occasion, eve = false) {
  const katha = eve ? occasion.eveKatha : occasion.katha;
  if (!katha) return null;
  return {
    key: occasion.deity || 'festival', name: occasion.name, hindi: occasion.hindi || occasion.name,
    visual: occasion.visual, katha, hashtags: occasion.hashtags || [occasion.hashtag].filter(Boolean),
  };
}

/**
 * What a day's devotional story is about: a festival with its own katha
 * (occasions.js); else during Navratri that day's form of Durga (plus the
 * Navratri occasion); else any other devotional occasion; else the
 * weekday's deity and that week's katha. `date` is the run's India
 * date (YYYY-MM-DD).
 */
function kathaOfDay(date) {
  const { getOccasion } = require('../occasions');
  const occasion = getOccasion(date);
  const devotional = occasion?.genre === 'devotional' ? occasion : undefined;
  // A festival with its own katha wins even on a Navratri day (Ram Navami
  // is Chaitra Navratri's ninth day): it's what people search for that day.
  const festival = devotional && festivalDeity(devotional);
  if (festival) return { deity: festival, occasion: devotional };
  const navratri = navratriDeity(date);
  if (navratri) return { deity: navratri, occasion: devotional };
  if (devotional) return { occasion: devotional };
  return { deity: deityOfDay(date) };
}

/** Tomorrow's katha, as tomorrow's daily run will choose it. */
function nextKatha(date) {
  return kathaOfDay(addDays(date, 1));
}

/**
 * The katha for the afternoon before `festivalDate`, or null when no
 * festival with an eve katha falls on that date. The festival-eve run
 * (FESTIVAL_EVE) posts it, a day ahead of the people searching for it.
 */
function eveKathaOf(festivalDate) {
  const { OCCASIONS } = require('../occasions');
  const occasion = OCCASIONS.find((o) => o.date === festivalDate && o.genre === 'devotional' && o.eveKatha);
  return occasion ? { deity: festivalDeity(occasion, true), occasion } : null;
}

/**
 * The festival a Sunday long video should tell, from that Sunday and the
 * six days after it (a long video takes days to be found in search): one of
 * the year's biggest if the week has one, else the nearest. Returns
 * { deity, katha } with the festival's best-known katha, or null.
 */
function festivalOfWeek(sundayDate) {
  const week = [0, 1, 2, 3, 4, 5, 6].map((i) => eveKathaOf(addDays(sundayDate, i))).filter(Boolean);
  // One of the year's biggest (`top`) wins the week; else the nearest.
  const eve = week.find((e) => e.occasion.top) || week[0];
  return eve ? { deity: eve.deity, katha: eve.deity.katha } : null;
}

/** One line describing a katha slot, for prompts. */
function describeKatha({ deity, occasion }) {
  if (deity) return `${deity.name} (${deity.hindi}): ${deity.katha}`;
  return occasion ? `the festival ${occasion.name}` : '';
}

module.exports = {
  DEITIES, GENERAL_HASHTAGS, istWeekday, istDate, addDays, deityOfDay, navratriDeity, festivalDeity, kathaOfDay, nextKatha,
  eveKathaOf, festivalOfWeek, describeKatha,
};
