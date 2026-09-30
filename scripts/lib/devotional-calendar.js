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

/** Today's deity and katha. `dateStr` (YYYY-MM-DD) keeps the katha stable
 *  across retries of the same day. */
function deityOfDay(dateStr, now = new Date()) {
  const deity = DEITIES[istWeekday(now)];
  const week = Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / (7 * 86400000));
  return { ...deity, katha: deity.kathas[week % deity.kathas.length] };
}

module.exports = { DEITIES, GENERAL_HASHTAGS, istWeekday, deityOfDay };
