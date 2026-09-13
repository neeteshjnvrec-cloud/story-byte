/**
 * Occasion calendar for daily story generation.
 *
 * Ties one of the day's two daily AI stories to a real festival/observance
 * instead of a purely random genre, so it reads as timely (and shares
 * better on Instagram) around days that already have organic engagement.
 * Each occasion is active for a window of days around its peak date — a
 * different story every day, same theme — via `before`/`after` day counts.
 * Hindu festivals (the majority of the app's audience) get the widest
 * windows; other religions/observances still get a smaller one so the
 * calendar isn't Hindu-only, just Hindu-weighted.
 *
 * Dates are for 2026. Most Hindu/Islamic festivals are lunar and shift every
 * year — this list needs a manual refresh once a year (check
 * timeanddate.com/holidays/india or drikpanchang.com for next year's dates
 * and update OCCASIONS below; keep the shape the same).
 */
const OCCASIONS = [
  // -- Hindu (widest windows: a lead-up builds anticipation, engagement
  //    tends to climb in the days before the actual festival) --
  { date: '2026-01-14', name: 'Makar Sankranti', genre: 'devotional', visual: 'kites filling the sky, sesame-jaggery sweets, a harvest festival', hashtag: '#MakarSankranti', before: 2, after: 1 },
  { date: '2026-02-15', name: 'Maha Shivratri', genre: 'devotional', visual: 'Lord Shiva, a candlelit temple, a night of prayer', hashtag: '#MahaShivratri', before: 2, after: 1 },
  { date: '2026-03-03', name: 'Holi', genre: 'devotional', visual: 'clouds of colored powder, joyful chaos, spring festival', hashtag: '#Holi', before: 3, after: 1 },
  { date: '2026-03-27', name: 'Ram Navami', genre: 'devotional', visual: 'Lord Ram with bow and arrow, a temple courtyard', hashtag: '#RamNavami', before: 2, after: 1 },
  { date: '2026-08-26', name: 'Onam', genre: 'devotional', visual: 'a pookalam flower rangoli, a snake-boat race, harvest festival', hashtag: '#Onam', before: 2, after: 1 },
  { date: '2026-08-28', name: 'Raksha Bandhan', genre: 'drama', visual: 'a rakhi thread tied on a wrist, sibling warmth', hashtag: '#RakshaBandhan', before: 2, after: 0 },
  { date: '2026-09-04', name: 'Krishna Janmashtami', genre: 'devotional', visual: 'baby Krishna, a flute, a moonlit night in Gokul', hashtag: '#Janmashtami', before: 3, after: 1 },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', genre: 'devotional', visual: 'a Lord Ganesha idol, modak sweets, a festive procession', hashtag: '#GaneshChaturthi', before: 4, after: 2 },
  { date: '2026-10-11', endDate: '2026-10-19', name: 'Navratri', genre: 'devotional', visual: 'Goddess Durga, garba dancers, nine nights of worship', hashtag: '#Navratri', before: 2, after: 0 },
  { date: '2026-10-20', name: 'Dussehra', genre: 'devotional', visual: 'Lord Ram, the burning of a Ravana effigy, good over evil', hashtag: '#Dussehra', before: 0, after: 1 },
  { date: '2026-10-29', name: 'Karva Chauth', genre: 'romance', visual: 'moonrise seen through a sieve, marital devotion, a diya', hashtag: '#KarvaChauth', before: 2, after: 0 },
  { date: '2026-11-08', name: 'Diwali', genre: 'devotional', visual: 'rows of diyas, rangoli patterns, fireworks, Goddess Lakshmi', hashtag: '#Diwali', before: 4, after: 2 },
  { date: '2026-11-15', name: 'Chhath Puja', genre: 'devotional', visual: 'a riverbank at sunrise, offerings to the sun god', hashtag: '#ChhathPuja', before: 2, after: 1 },

  // -- Sikh --
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', genre: 'devotional', visual: 'the Golden Temple, Guru Nanak, a community langar kitchen', hashtag: '#GuruNanakJayanti', before: 1, after: 1 },

  // -- Islamic --
  { date: '2026-03-20', endDate: '2026-03-22', name: 'Eid al-Fitr', genre: 'devotional', visual: 'a crescent moon, lantern-lit streets, a festive family meal', hashtag: '#EidAlFitr', before: 1, after: 0 },
  { date: '2026-05-28', name: 'Eid al-Adha', genre: 'devotional', visual: 'a crescent moon, festive gathering, generosity and sacrifice', hashtag: '#EidAlAdha', before: 1, after: 0 },

  // -- Christian --
  { date: '2026-12-25', name: 'Christmas', genre: 'devotional', visual: 'a candlelit Christmas tree, snow, warm nativity imagery', hashtag: '#Christmas', before: 2, after: 0 },

  // -- Secular / national (India) --
  { date: '2026-01-01', name: 'New Year', genre: 'motivation', visual: 'fireworks at midnight, a fresh sunrise, new beginnings', hashtag: '#NewYear', before: 1, after: 0 },
  { date: '2026-01-26', name: 'Republic Day', genre: 'motivation', visual: 'the Indian tricolor flag, a patriotic parade', hashtag: '#RepublicDay', before: 1, after: 0 },
  { date: '2026-08-15', name: 'Independence Day', genre: 'motivation', visual: 'the Indian tricolor flag, the spirit of freedom', hashtag: '#IndependenceDay', before: 1, after: 0 },
  { date: '2026-10-02', name: 'Gandhi Jayanti', genre: 'motivation', visual: 'quiet simplicity, a spinning charkha wheel, peace', hashtag: '#GandhiJayanti', before: 1, after: 0 },
];

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Returns the occasion whose window covers `dateStr` ('YYYY-MM-DD'), or null. */
function getOccasion(dateStr) {
  return (
    OCCASIONS.find((o) => {
      const start = addDays(o.date, -(o.before || 0));
      const end = addDays(o.endDate || o.date, o.after || 0);
      return dateStr >= start && dateStr <= end;
    }) || null
  );
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

/** A natural-language description of where `dateStr` sits in `occasion`'s
 *  window, so a lead-up day doesn't get told "today is the festival". */
function occasionPhrase(occasion, dateStr) {
  const peakStart = occasion.date;
  const peakEnd = occasion.endDate || occasion.date;
  if (dateStr < peakStart) {
    const days = daysBetween(dateStr, peakStart);
    return `${occasion.name} is coming up in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (dateStr > peakEnd) {
    const days = daysBetween(peakEnd, dateStr);
    return `it has been ${days} day${days === 1 ? '' : 's'} since ${occasion.name}`;
  }
  return `today is ${occasion.name}`;
}

module.exports = { getOccasion, occasionPhrase, OCCASIONS };
