/**
 * Traditional iconography for the deities and figures of the daily kathas.
 *
 * An image model given only a name ("Hanuman flying across the sky")
 * invents the rest — the 2026-10-06 Hanuman Short drew him as a bearded
 * man with wings and a trident. Every scene prompt that mentions one of
 * these figures now carries their standard appearance (as in temple murtis,
 * calendar art and the TV epics viewers know), so the model draws the
 * Hanuman, Ganesha or Shani Dev devotees recognise.
 *
 * Descriptions are positive and concrete — what to draw — since naming a
 * wrong feature ("no wings") tends to put it in the picture.
 */

const FIGURES = [
  // --- Krishna and Vrindavan ---
  { key: 'balkrishna', names: /\b(bal ?krishna|baby krishna|little krishna|child krishna|bala krishna|makhan ?chor|gopal|kanha)\b/i,
    look: 'Bal Krishna: a chubby toddler with smooth deep blue skin, curly black hair, a small peacock feather in a little gold crown, gold armlets, anklets and waist chain, a yellow silk cloth, often holding a pot of white butter' },
  { key: 'krishna', names: /\b(krishna|krishn|govind|murari|keshav|vasudev|shyam)\b/i,
    look: 'Lord Krishna: a youthful man with smooth deep blue skin, a gold crown with a single peacock feather, a yellow silk dhoti (pitambar), a long garland of forest flowers, gold ornaments, a vertical tilak, holding a bamboo flute, a gentle smile' },
  { key: 'radha', names: /\bradha\b/i,
    look: 'Radha: a graceful young woman with fair skin, a red and gold lehenga with a sheer odhni over her head, gold jewellery, beside Krishna' },
  { key: 'yashoda', names: /\byashoda\b/i,
    look: 'Mother Yashoda: a warm village mother of Gokul in a simple bright cotton saree with the end over her head, glass bangles' },
  { key: 'sudama', names: /\bsudama\b/i,
    look: 'Sudama: a thin, poor Brahmin in a torn white dhoti and shawl, a small cloth bundle of rice' },
  { key: 'draupadi', names: /\bdraupadi\b/i,
    look: 'Draupadi: a dignified queen with dark skin and long black hair, in a red silk saree' },
  { key: 'kaliya', names: /\bkaliya\b/i,
    look: 'Kaliya: a giant many-hooded black serpent rising from the dark Yamuna river' },

  // --- Shiva's family ---
  { key: 'shiva', names: /\b(shiva|shiv|mahadev|bholenath|shankar|neelkanth|rudra|mahakal)\b/i,
    look: 'Lord Shiva: a serene ascetic with ash-smeared pale blue-grey skin, long matted locks piled high with a crescent moon and the river Ganga springing from them, a third eye on his forehead, a blue throat, a cobra coiled round his neck, rudraksha beads, a tiger-skin garment, holding a trident (trishul) with a small damaru drum tied to it' },
  { key: 'parvati', names: /\b(parvati|gauri|uma)\b/i,
    look: 'Goddess Parvati: a radiant woman with fair golden skin, a red silk saree with gold border, gold crown and jewellery, sindoor in her hair parting, a gentle motherly face' },
  { key: 'ganesha', names: /\b(ganesha|ganesh|ganpati|ganapati|vinayak|vighnaharta|gajanan)\b/i,
    look: 'Lord Ganesha: an elephant head with large ears, one tusk broken (the right one), a curving trunk, a round pot belly, four arms holding a modak sweet, an axe, a noose and one raised in blessing, a gold crown, a red or yellow silk dhoti, his small mouse (Mooshak) at his feet' },
  { key: 'kartikeya', names: /\b(kartikeya|kartik|skanda|murugan|subramanya)\b/i,
    look: 'Kartikeya: a handsome young warrior god holding a spear (vel), a gold crown, riding a peacock' },
  { key: 'nandi', names: /\bnandi\b/i,
    look: 'Nandi: a large white humped bull with a gold-trimmed red cloth and bells' },
  { key: 'ganga', names: /\b(ganga devi|goddess ganga|maa ganga|ganga maa)\b/i,
    look: 'Goddess Ganga: a fair woman in white and pale blue, rising from flowing water, standing on a makara (crocodile)' },
  { key: 'markandeya', names: /\bmarkandeya\b/i,
    look: 'Markandeya: a young sage boy in saffron, clinging to a Shivling' },
  { key: 'yama', names: /\b(yama|yamraj|yamaraj)\b/i,
    look: 'Yama: the dark-skinned god of death with a crown, holding a noose (pasha) and a mace, riding a black buffalo' },

  // --- Ram and Hanuman ---
  { key: 'hanuman', names: /\b(hanuman|bajrangbali|bajrang|anjaneya|pawanputra|maruti|kesari nandan)\b/i,
    look: 'Lord Hanuman: a mighty monkey god with a monkey face and vermilion-orange skin, a short reddish muzzle, a golden crown and earrings, a broad muscular chest with a sacred thread, a red loincloth, a long curling tail, holding a golden mace (gada); when he flies he leaps through the sky by his own power, arms outstretched, with no wings' },
  { key: 'ram', names: /\b(shri ram|lord ram|ram|rama|ram ji|raghav|raghunath)\b/i,
    look: 'Lord Ram: a calm prince with smooth deep blue-green (shyam) skin, a gold crown, a yellow silk dhoti, a long bow (Kodanda) in hand and a quiver of arrows on his back' },
  { key: 'sita', names: /\b(sita|janaki|vaidehi)\b/i,
    look: 'Mother Sita: a fair, gentle woman in a red or yellow silk saree with gold jewellery, head modestly covered' },
  { key: 'lakshman', names: /\b(lakshman|lakshmana)\b/i,
    look: 'Lakshman: a fair-skinned young prince with a gold crown, yellow dhoti and a bow, always beside Ram' },
  { key: 'ravana', names: /\b(ravana|ravan)\b/i,
    look: 'Ravana: the demon king of Lanka with ten crowned heads in a row and many arms, golden armour and weapons' },
  { key: 'jambavan', names: /\b(jambavan|jambavant)\b/i,
    look: 'Jambavan: an old, wise bear king with white fur and a crown' },
  { key: 'bhima', names: /\bbhima\b/i,
    look: 'Bhima: a huge, powerfully built Pandava warrior with a mace' },

  // --- Vishnu and avatars ---
  { key: 'matsya', names: /\bmatsya\b/i,
    look: 'Matsya avatar: an enormous shining golden fish with a single horn on its head, a boat tied to the horn, on a vast stormy ocean (or Vishnu with four arms above and a fish tail below)' },
  { key: 'kurma', names: /\bkurma\b/i,
    look: 'Kurma avatar: a gigantic tortoise bearing Mount Mandara on its shell in the ocean of milk, gods and demons pulling the serpent Vasuki' },
  { key: 'narasimha', names: /\b(narasimha|narsingh|narsimha)\b/i,
    look: 'Narasimha avatar: a fierce man-lion with a lion\'s head and mane, a powerful human body with many arms and gold ornaments, at a palace threshold at dusk' },
  { key: 'prahlad', names: /\bprahlad\b/i,
    look: 'Prahlad: a small boy devotee in yellow, hands folded in prayer, calm and fearless' },
  { key: 'vamana', names: /\bvamana\b/i,
    look: 'Vamana avatar: a small Brahmin boy in a dhoti with a sacred thread, an umbrella and a water pot, who grows into a giant striding across the worlds' },
  { key: 'bali', names: /\b(king bali|mahabali|raja bali)\b/i,
    look: 'King Bali: a generous asura king with a gold crown and royal robes' },
  { key: 'varaha', names: /\bvaraha\b/i,
    look: 'Varaha avatar: a mighty boar-headed god with a human body, lifting the Earth goddess on his tusks out of the ocean' },
  { key: 'kalki', names: /\bkalki\b/i,
    look: 'Kalki avatar: a divine warrior on a white horse with a raised shining sword' },
  { key: 'dhruva', names: /\bdhruva\b/i,
    look: 'Dhruva: a small prince boy in deep meditation in a forest, later shining as the Pole Star' },
  { key: 'gajendra', names: /\bgajendra\b/i,
    look: 'Gajendra: a great elephant king in a lotus lake, a crocodile gripping his leg, raising a lotus to the sky' },
  { key: 'vishnu', names: /\b(vishnu|narayan|narayana|hari|shri hari)\b/i,
    look: 'Lord Vishnu: smooth deep blue skin, four arms holding a conch (shankha), the spinning Sudarshan chakra, a mace (gada) and a lotus, a tall gold crown, a yellow silk pitambar, the Kaustubha jewel on his chest, often resting on the many-hooded serpent Sheshnaag on the ocean of milk' },
  { key: 'manu', names: /\b(manu|satyavrata)\b/i,
    look: 'King Manu: a royal sage with a white beard in simple robes' },

  // --- Devi ---
  { key: 'lakshmi', names: /\b(lakshmi|laxmi|mahalakshmi)\b/i,
    look: 'Goddess Lakshmi: a radiant woman with golden skin in a red silk saree with gold border, four arms — two holding pink lotuses, one showering gold coins, one in blessing — standing on a large pink lotus, white elephants beside her' },
  { key: 'durga', names: /\b(durga|ambe|jagdamba|sherawali|navadurga)\b/i,
    look: 'Goddess Durga: a powerful, radiant goddess with ten arms holding a trident, chakra, sword, bow, conch, lotus and mace, a red silk saree, a tall gold crown, a third eye, riding a lion' },
  { key: 'mahishasura', names: /\bmahishasura\b/i,
    look: 'Mahishasura: a huge demon with a water-buffalo head and a muscular body' },
  { key: 'kalaratri', names: /\b(kalaratri|kaalratri|kalratri)\b/i,
    look: 'Maa Kalaratri: a fierce goddess with dark skin, dishevelled flowing hair, three blazing eyes and fiery breath, riding a donkey, holding a sword and an iron hook, her other hands raised in blessing and protection' },
  { key: 'kali', names: /\bkali\b/i,
    look: 'Goddess Kali: dark blue-black skin, wild flowing black hair, three blazing eyes, a fierce face, many arms holding a sword' },
  { key: 'saraswati', names: /\b(saraswati|sarasvati)\b/i,
    look: 'Goddess Saraswati: a serene woman in a pure white saree playing a veena, seated on a white lotus with a white swan' },
  { key: 'shailputri', names: /\bshailputri\b/i,
    look: 'Maa Shailputri: a goddess with a crescent moon on her forehead, a trident in her right hand and a lotus in her left, riding the white bull Nandi' },
  { key: 'brahmacharini', names: /\bbrahmacharini\b/i,
    look: 'Maa Brahmacharini: a barefoot ascetic goddess in a white saree, a rudraksha rosary in her right hand and a water pot (kamandalu) in her left' },
  { key: 'chandraghanta', names: /\bchandraghanta\b/i,
    look: 'Maa Chandraghanta: a golden goddess with a bell-shaped half moon on her forehead, ten arms with weapons, riding a tiger' },
  { key: 'kushmanda', names: /\bkushmanda\b/i,
    look: 'Maa Kushmanda: a radiant eight-armed goddess on a lion, holding a lotus, a pot of nectar, a bow and arrow, a chakra and a mace, glowing like the sun' },
  { key: 'skandamata', names: /\bskandamata\b/i,
    look: 'Maa Skandamata: a four-armed goddess on a lion with baby Kartikeya (Skanda) on her lap, holding lotuses' },
  { key: 'katyayani', names: /\bkatyayani\b/i,
    look: 'Maa Katyayani: a fierce four-armed warrior goddess on a lion, holding a sword and a lotus' },
  { key: 'mahagauri', names: /\bmahagauri\b/i,
    look: 'Maa Mahagauri: a serene goddess in pure white riding a white bull, holding a trident and a damaru' },
  { key: 'siddhidatri', names: /\bsiddhidatri\b/i,
    look: 'Maa Siddhidatri: a four-armed goddess seated on a lotus, holding a chakra, conch, mace and lotus' },

  // --- Shani and others ---
  { key: 'shani', names: /\b(shani|shanidev|shani dev|shanidev)\b/i,
    look: 'Shani Dev: a solemn god with dark blue-black skin, dark blue robes, a gold crown, holding a sword and a bow with arrows, riding a large black crow' },
  { key: 'surya', names: /\b(surya|suryadev|sun god)\b/i,
    look: 'Surya Dev: a radiant golden god with a halo of sunrays, holding lotuses, in a chariot drawn by seven horses' },
  { key: 'vikramaditya', names: /\bvikramaditya\b/i,
    look: 'King Vikramaditya: a noble Indian king with a gold crown, a moustache and royal silk robes' },
  { key: 'harishchandra', names: /\bharishchandra\b/i,
    look: 'King Harishchandra: a righteous king, later in a plain white cloth' },
  { key: 'brahma', names: /\bbrahma\b/i,
    look: 'Lord Brahma: four bearded faces looking four ways, four arms holding the Vedas, a water pot and a rosary, seated on a lotus' },
  { key: 'indra', names: /\bindra\b/i,
    look: 'Indra: the king of the gods with a gold crown, holding the thunderbolt (vajra), riding the white elephant Airavata' },
  { key: 'garuda', names: /\bgaruda\b/i,
    look: 'Garuda: a mighty eagle-man with golden wings, a beak and a human body' },
  { key: 'narada', names: /\bnarad|narada\b/i,
    look: 'Narada Muni: a sage with a topknot, holding a veena (tanpura) and chanting "Narayan Narayan"' },
];

/**
 * The traditional appearance of every known figure named in `text`, most
 * specific first, capped at `max`. `context` (e.g. the story's katha) breaks
 * the one real ambiguity: in a Bal Krishna story, "Krishna" is the child.
 */
function iconographyFor(text, { context = '', max = 3 } = {}) {
  // Krishna's childhood leelas in Gokul and Vrindavan (Govardhan, Kaliya,
  // Putana, Damodar, the butter stories) are all Bal Krishna.
  const childKrishna = FIGURES[0].names.test(String(context)) ||
    /yashoda|govardhan|kaliya|putana|damodar|gokul|butter|makhan/i.test(String(context));
  const found = [];
  const seen = new Set();
  for (const figure of FIGURES) {
    if (found.length >= max) break;
    if (!figure.names.test(String(text || ''))) continue;
    let pick = figure;
    if (figure.key === 'krishna') {
      if (seen.has('balkrishna')) continue;
      if (childKrishna) pick = FIGURES[0];
    }
    if (seen.has(pick.key)) continue;
    seen.add(pick.key);
    found.push(pick);
  }
  return found;
}

module.exports = { FIGURES, iconographyFor };
