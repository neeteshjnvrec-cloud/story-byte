/**
 * Occasion calendar for daily story generation.
 *
 * Ties one of the day's two daily AI stories to a real festival/observance
 * instead of a purely random genre, so it reads as timely (and shares
 * better on Instagram) around days that already have organic engagement.
 *
 * Dates are for 2026. Most Hindu/Islamic festivals are lunar and shift every
 * year — this list needs a manual refresh once a year (check
 * timeanddate.com/holidays/india or drikpanchang.com for next year's dates
 * and update OCCASIONS below; keep the shape the same).
 */
const OCCASIONS = [
  { date: '2026-01-01', name: 'New Year', genre: 'motivation', visual: 'fireworks at midnight, a fresh sunrise, new beginnings', hashtag: '#NewYear' },
  { date: '2026-01-14', name: 'Makar Sankranti', genre: 'devotional', visual: 'kites filling the sky, sesame-jaggery sweets, a harvest festival', hashtag: '#MakarSankranti' },
  { date: '2026-01-26', name: 'Republic Day', genre: 'motivation', visual: 'the Indian tricolor flag, a patriotic parade', hashtag: '#RepublicDay' },
  { date: '2026-02-15', name: 'Maha Shivratri', genre: 'devotional', visual: 'Lord Shiva, a candlelit temple, a night of prayer', hashtag: '#MahaShivratri' },
  { date: '2026-03-03', name: 'Holi', genre: 'devotional', visual: 'clouds of colored powder, joyful chaos, spring festival', hashtag: '#Holi' },
  { date: '2026-03-20', endDate: '2026-03-22', name: 'Eid al-Fitr', genre: 'devotional', visual: 'a crescent moon, lantern-lit streets, a festive family meal', hashtag: '#EidAlFitr' },
  { date: '2026-03-27', name: 'Ram Navami', genre: 'devotional', visual: 'Lord Ram with bow and arrow, a temple courtyard', hashtag: '#RamNavami' },
  { date: '2026-05-28', name: 'Eid al-Adha', genre: 'devotional', visual: 'a crescent moon, festive gathering, generosity and sacrifice', hashtag: '#EidAlAdha' },
  { date: '2026-08-15', name: 'Independence Day', genre: 'motivation', visual: 'the Indian tricolor flag, the spirit of freedom', hashtag: '#IndependenceDay' },
  { date: '2026-08-26', name: 'Onam', genre: 'devotional', visual: 'a pookalam flower rangoli, a snake-boat race, harvest festival', hashtag: '#Onam' },
  { date: '2026-08-28', name: 'Raksha Bandhan', genre: 'drama', visual: 'a rakhi thread tied on a wrist, sibling warmth', hashtag: '#RakshaBandhan' },
  { date: '2026-09-04', name: 'Krishna Janmashtami', genre: 'devotional', visual: 'baby Krishna, a flute, a moonlit night in Gokul', hashtag: '#Janmashtami' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', genre: 'devotional', visual: 'a Lord Ganesha idol, modak sweets, a festive procession', hashtag: '#GaneshChaturthi' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', genre: 'motivation', visual: 'quiet simplicity, a spinning charkha wheel, peace', hashtag: '#GandhiJayanti' },
  { date: '2026-10-11', endDate: '2026-10-19', name: 'Navratri', genre: 'devotional', visual: 'Goddess Durga, garba dancers, nine nights of worship', hashtag: '#Navratri' },
  { date: '2026-10-20', name: 'Dussehra', genre: 'devotional', visual: 'Lord Ram, the burning of a Ravana effigy, good over evil', hashtag: '#Dussehra' },
  { date: '2026-10-29', name: 'Karva Chauth', genre: 'romance', visual: 'moonrise seen through a sieve, marital devotion, a diya', hashtag: '#KarvaChauth' },
  { date: '2026-11-08', name: 'Diwali', genre: 'devotional', visual: 'rows of diyas, rangoli patterns, fireworks, Goddess Lakshmi', hashtag: '#Diwali' },
  { date: '2026-11-15', name: 'Chhath Puja', genre: 'devotional', visual: 'a riverbank at sunrise, offerings to the sun god', hashtag: '#ChhathPuja' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', genre: 'devotional', visual: 'the Golden Temple, Guru Nanak, a community langar kitchen', hashtag: '#GuruNanakJayanti' },
  { date: '2026-12-25', name: 'Christmas', genre: 'devotional', visual: 'a candlelit Christmas tree, snow, warm nativity imagery', hashtag: '#Christmas' },
];

/** Returns the occasion active on `dateStr` ('YYYY-MM-DD'), or null. */
function getOccasion(dateStr) {
  return OCCASIONS.find((o) => dateStr >= o.date && dateStr <= (o.endDate || o.date)) || null;
}

module.exports = { getOccasion, OCCASIONS };
