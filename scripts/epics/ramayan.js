/**
 * The Ramayan as a fixed series of ~15-minute episodes, told in order by
 * epic-episode.js (Mon/Wed/Fri, .github/workflows/ramayan.yml).
 *
 * Each episode lists exactly the events it tells, so the writer can't
 * invent or skip any: two unplanned test episodes put Sita at Tataka's
 * killing (she meets Ram later, in Janakpur) and added a magic talisman
 * and a glowing cavern. `events` uses the cast's English names, which also
 * decides who may appear in the episode (epicCast in
 * build-landscape-episode.js).
 *
 * Cast without a `look` take theirs from lib/iconography.js, and Ram, Sita,
 * Lakshman, Hanuman and Ravana are drawn from their portraits in
 * assets/deities/, the same as in the daily Shorts.
 *
 * Uttar Kand (Sita's second exile, Luv-Kush) isn't planned yet: the series
 * ends with Ram's coronation.
 */
module.exports = {
  key: 'ramayan',
  // The series folder (public/episodes/ramayan) is named from this.
  title: 'Ramayan',
  name: 'Ramayan',
  seriesName: 'रामायण',
  language: 'hi',
  genre: 'devotional mythology',
  source: 'Valmiki Ramayana and Goswami Tulsidas\'s Ramcharitmanas (where they differ, the version Hindi-speaking ' +
    'families know from the Ramcharitmanas)',
  closing: 'जय श्री राम',
  schedule: 'हर सोमवार, बुधवार और शुक्रवार सुबह 10 बजे',
  playlistTitle: 'रामायण — सम्पूर्ण कथा | Ramayan All Episodes in Hindi',
  playlistDescription: 'रामायण की सम्पूर्ण कथा, क्रम से — हर सोमवार, बुधवार और शुक्रवार सुबह 10 बजे नया एपिसोड। StoryByte',
  // A StoryByte series: app link and channels in the description, and the
  // episodes in the app and on the website.
  storybyte: true,
  words: {
    episode: 'एपिसोड', previous: '⏪ पिछला एपिसोड', next: '⏩ अगला एपिसोड', chapters: '⏱️ अध्याय',
    subscribe: '🙏 पूरी रामायण क्रम से देखने के लिए चैनल सब्सक्राइब करें',
  },
  videoTitle: (n, title) => `रामायण एपिसोड ${n}: ${title} | Ramayan Episode ${n}`,
  hashtags: ['#Ramayan', '#रामायण', '#JaiShriRam', '#RamKatha', '#SanatanDharma'],
  tags: ['रामायण', 'Ramayan', 'ramayan in hindi', 'ramayan katha', 'ram katha', 'रामायण कथा', 'jai shri ram',
    'ramayan full story', 'valmiki ramayan', 'ramcharitmanas'],
  setting: 'Ancient India in the Treta Yuga: the golden city of Ayodhya on the Saryu river, the dense forests of the ' +
    'south, the vanara kingdom of Kishkindha and the golden island city of Lanka.',

  cast: [
    { name: 'Ram', nativeName: 'राम', role: 'prince of Ayodhya, eldest son of Dasharath, Lord Vishnu\'s avatar' },
    { name: 'Sita', nativeName: 'सीता', role: 'princess of Mithila, daughter of Janak, Ram\'s wife' },
    { name: 'Lakshman', nativeName: 'लक्ष्मण', role: 'Ram\'s devoted younger brother, son of Sumitra' },
    { name: 'Hanuman', nativeName: 'हनुमान', role: 'Ram\'s greatest devotee, minister of Sugriv, son of Vayu' },
    { name: 'Ravana', nativeName: 'रावण', role: 'the ten-headed rakshasa king of Lanka' },
    { name: 'Jambavan', nativeName: 'जाम्बवान', role: 'the wise old bear king in Sugriv\'s army' },
    { name: 'Indra', nativeName: 'इंद्र', role: 'king of the gods' },
    { name: 'Garuda', nativeName: 'गरुड़', role: 'Lord Vishnu\'s divine eagle' },
    { name: 'Vishnu', nativeName: 'विष्णु', role: 'the Supreme Lord, who is born as Ram' },
    { name: 'Dasharath', nativeName: 'दशरथ', role: 'king of Ayodhya, father of Ram',
      look: 'King Dasharath: an elderly, dignified king with a white beard and moustache, a tall gold crown, rich maroon and gold silk robes and gold jewellery' },
    { name: 'Kaushalya', nativeName: 'कौशल्या', role: 'Ram\'s mother, Dasharath\'s eldest queen',
      look: 'Queen Kaushalya: a gentle, graceful middle-aged queen in a cream and gold silk saree, a small gold crown, her head covered with the end of the saree' },
    { name: 'Kaikeyi', nativeName: 'कैकेयी', role: 'Bharat\'s mother, Dasharath\'s favourite queen',
      look: 'Queen Kaikeyi: a beautiful, proud queen in a deep green and gold silk saree, rich gold jewellery and a gold crown' },
    { name: 'Sumitra', nativeName: 'सुमित्रा', role: 'mother of Lakshman and Shatrughna',
      look: 'Queen Sumitra: a calm, kind middle-aged queen in a light blue and gold silk saree with a small gold crown' },
    { name: 'Bharat', nativeName: 'भरत', role: 'Ram\'s devoted younger brother, son of Kaikeyi',
      look: 'Bharat: a young prince with dusky dark skin, a gentle devoted face, a gold crown, a saffron dhoti and angavastram; after Ram\'s exile, plain ascetic bark clothes and matted hair' },
    { name: 'Shatrughna', nativeName: 'शत्रुघ्न', role: 'youngest brother, always with Bharat',
      look: 'Shatrughna: a fair young prince with a gold crown, a red dhoti and angavastram and a bow' },
    { name: 'Urmila', nativeName: 'उर्मिला', role: 'Sita\'s sister, Lakshman\'s wife',
      look: 'Urmila: a young princess in a pink and gold silk saree with gold jewellery' },
    { name: 'Vasishtha', nativeName: 'वशिष्ठ', role: 'royal guru of Ayodhya',
      look: 'Guru Vasishtha: an old, serene sage with a long white beard and a topknot, saffron robes and rudraksha beads' },
    { name: 'Vishwamitra', nativeName: 'विश्वामित्र', role: 'the great sage who takes Ram and Lakshman to guard his yagya',
      look: 'Sage Vishwamitra: a tall, stern sage with a long grey beard and matted hair, a fiery gaze, saffron robes and a wooden staff' },
    { name: 'Shringi', nativeName: 'ऋष्यशृंग', role: 'the sage who performs Dasharath\'s putrakameshti yagya',
      look: 'Sage Rishyashringa: a young sage with matted hair, a calm face and simple saffron robes' },
    { name: 'Agni', nativeName: 'अग्नि देव', role: 'the god of fire',
      look: 'Agni Dev: the fire god with glowing red-gold skin, flames rising around him, a gold crown and red robes' },
    { name: 'Janak', nativeName: 'जनक', role: 'king of Mithila, Sita\'s father',
      look: 'King Janak: a wise, gentle king with a grey beard, a gold crown and white and gold silk robes' },
    { name: 'Gautam', nativeName: 'गौतम ऋषि', role: 'the sage, Ahalya\'s husband',
      look: 'Sage Gautam: an old sage with a long white beard, matted hair and white robes' },
    { name: 'Ahalya', nativeName: 'अहल्या', role: 'Gautam\'s wife, freed from his curse by Ram',
      look: 'Ahalya: a serene woman sage in a simple white saree, her hands folded' },
    { name: 'Tataka', nativeName: 'ताड़का', role: 'the demoness of the forest',
      look: 'Tataka: a huge, fearsome demoness with dark skin, wild hair, fangs and blazing eyes' },
    { name: 'Mareech', nativeName: 'मारीच', role: 'Tataka\'s son, later the golden deer',
      look: 'Mareech: a rakshasa with a dark face, fangs and dark armour; disguised, a shining golden deer with silver spots' },
    { name: 'Subahu', nativeName: 'सुबाहु', role: 'Tataka\'s son',
      look: 'Subahu: a huge rakshasa with fangs, wild hair and dark armour' },
    { name: 'Parshuram', nativeName: 'परशुराम', role: 'the fierce warrior-sage, an avatar of Vishnu',
      look: 'Parshuram: a fierce, muscular warrior-sage with matted hair and a beard, a saffron dhoti, an axe (parshu) on his shoulder and a great bow' },
    { name: 'Manthara', nativeName: 'मंथरा', role: 'Kaikeyi\'s old maid',
      look: 'Manthara: an old hunchbacked maid with grey hair, a cunning face and a plain brown saree' },
    { name: 'Sumantra', nativeName: 'सुमंत्र', role: 'Dasharath\'s minister and charioteer',
      look: 'Sumantra: an elderly minister and charioteer with a white moustache, a white turban and simple robes' },
    { name: 'Shravan', nativeName: 'श्रवण कुमार', role: 'the devoted son Dasharath killed by mistake long ago',
      look: 'Shravan Kumar: a young devoted son carrying his blind old parents in two baskets hung from a pole on his shoulder' },
    { name: 'Guh', nativeName: 'निषादराज गुह', role: 'chief of the Nishad boatmen, Ram\'s friend',
      look: 'Nishadraj Guh: a strong tribal chief with dark skin and a beard, a simple dhoti and a headband' },
    { name: 'Kevat', nativeName: 'केवट', role: 'the boatman who ferries Ram across the Ganga',
      look: 'Kevat: a humble, cheerful thin boatman in a simple white dhoti, barefoot, beside his wooden boat' },
    { name: 'Bharadwaj', nativeName: 'भरद्वाज मुनि', role: 'the sage of Prayag',
      look: 'Sage Bharadwaj: an old sage with a long white beard and saffron robes in a forest ashram' },
    { name: 'Valmiki', nativeName: 'वाल्मीकि', role: 'the sage-poet of the Ramayan',
      look: 'Sage Valmiki: an old sage with a long white beard, matted hair and white robes' },
    { name: 'Jayant', nativeName: 'जयंत', role: 'Indra\'s son, who comes as a crow',
      look: 'Jayant: a crow with glossy black feathers' },
    { name: 'Atri', nativeName: 'अत्रि मुनि', role: 'the ancient sage',
      look: 'Sage Atri: a very old sage with a long white beard and saffron robes' },
    { name: 'Anasuya', nativeName: 'अनसूया', role: 'Atri\'s wife, the great pativrata',
      look: 'Mother Anasuya: an old, radiant woman sage with white hair in a simple white saree' },
    { name: 'Viradh', nativeName: 'विराध', role: 'a rakshasa of the Dandak forest',
      look: 'Viradh: a giant rakshasa with a hideous face, wild hair and a spear' },
    { name: 'Agastya', nativeName: 'अगस्त्य मुनि', role: 'the great sage of the south',
      look: 'Sage Agastya: a short, radiant old sage with a long white beard, saffron robes and a water pot' },
    { name: 'Jatayu', nativeName: 'जटायु', role: 'the old vulture king, Dasharath\'s friend',
      look: 'Jatayu: an aged, giant vulture with grey-white feathers, a hooked beak and a gold ornament on his head' },
    { name: 'Shurpanakha', nativeName: 'शूर्पणखा', role: 'Ravana\'s sister',
      look: 'Shurpanakha: a rakshasi with long nails, wild hair, dark robes and heavy jewellery; disguised, a beautiful woman' },
    { name: 'Khar', nativeName: 'खर', role: 'Ravana\'s brother, ruler of Janasthan',
      look: 'Khar: a huge rakshasa general in dark armour with a crown and a mace' },
    { name: 'Dushan', nativeName: 'दूषण', role: 'Khar\'s commander',
      look: 'Dushan: a huge rakshasa commander in dark armour with a sword' },
    { name: 'Kabandh', nativeName: 'कबंध', role: 'a cursed headless demon',
      look: 'Kabandh: a monstrous headless demon with a huge mouth in his belly and very long arms' },
    { name: 'Shabari', nativeName: 'शबरी', role: 'the old tribal devotee waiting for Ram',
      look: 'Shabari: a very old, frail tribal woman with white hair in a simple white saree, holding a basket of wild berries' },
    { name: 'Sugriv', nativeName: 'सुग्रीव', role: 'the exiled vanara king',
      look: 'Sugriv: a vanara king with a monkey face, golden-brown fur, a gold crown and a red dhoti' },
    { name: 'Vali', nativeName: 'बालि', role: 'Sugriv\'s mighty elder brother, king of Kishkindha',
      look: 'Vali: a mighty vanara king, bigger than Sugriv, with a monkey face, golden fur, a gold crown and a gold necklace' },
    { name: 'Tara', nativeName: 'तारा', role: 'Vali\'s wise queen',
      look: 'Tara: a wise vanara queen with a gentle monkey face, a gold crown and a red silk saree' },
    { name: 'Angad', nativeName: 'अंगद', role: 'Vali\'s son, the young vanara prince',
      look: 'Angad: a young, strong vanara prince with a monkey face, golden-brown fur, a gold crown and armlets' },
    { name: 'Sampati', nativeName: 'सम्पाति', role: 'Jatayu\'s elder brother',
      look: 'Sampati: an old giant vulture with burnt, featherless wings, sitting on a cliff by the sea' },
    { name: 'Surasa', nativeName: 'सुरसा', role: 'mother of serpents, who tests Hanuman',
      look: 'Surasa: a gigantic serpent-woman rising from the sea with her mouth wide open' },
    { name: 'Lankini', nativeName: 'लंकिनी', role: 'guardian of Lanka',
      look: 'Lankini: a fierce rakshasi guarding the gate of Lanka' },
    { name: 'Vibhishan', nativeName: 'विभीषण', role: 'Ravana\'s righteous younger brother',
      look: 'Vibhishan: a calm, gentle rakshasa prince with a kind face, a tilak, a gold crown and white and gold robes' },
    { name: 'Trijata', nativeName: 'त्रिजटा', role: 'the kind rakshasi who guards Sita',
      look: 'Trijata: an old, kind rakshasi with grey hair and a simple dark saree' },
    { name: 'Mandodari', nativeName: 'मंदोदरी', role: 'Ravana\'s queen',
      look: 'Mandodari: Ravana\'s beautiful, dignified queen in a deep purple and gold silk saree with a gold crown' },
    { name: 'Akshay', nativeName: 'अक्षय कुमार', role: 'Ravana\'s young son',
      look: 'Akshay Kumar: a young rakshasa prince in gold armour with a sword' },
    { name: 'Meghnad', nativeName: 'मेघनाद', role: 'Ravana\'s eldest son, Indrajit',
      look: 'Meghnad (Indrajit): a handsome, fierce young rakshasa prince in dark gold armour with a gold crown and a bow' },
    { name: 'Kumbhakarna', nativeName: 'कुम्भकर्ण', role: 'Ravana\'s gigantic brother',
      look: 'Kumbhakarna: a mountain-sized rakshasa with a huge belly, a crown, dark armour and a giant spear' },
    { name: 'Nal', nativeName: 'नल', role: 'vanara engineer of the setu',
      look: 'Nal: a vanara builder with a monkey face and brown fur in a simple loincloth' },
    { name: 'Neel', nativeName: 'नील', role: 'vanara commander and engineer of the setu',
      look: 'Neel: a strong vanara commander with a monkey face and dark brown fur in a simple loincloth' },
    { name: 'Samudra', nativeName: 'समुद्र देव', role: 'the god of the ocean',
      look: 'Samudra Dev: the ocean god rising from the waves, with sea-blue skin, a pearl crown and folded hands' },
    { name: 'Sushen', nativeName: 'सुषेण वैद्य', role: 'the physician',
      look: 'Sushen: an old physician with a white beard and a bag of herbs' },
    { name: 'Kalanemi', nativeName: 'कालनेमि', role: 'a rakshasa sent to stop Hanuman',
      look: 'Kalanemi: a rakshasa disguised as a sage with a long beard and saffron robes' },
    { name: 'Matali', nativeName: 'मातलि', role: 'Indra\'s charioteer',
      look: 'Matali: a divine charioteer in white and gold, driving a shining golden chariot' },
  ],

  episodes: [
    // ── बालकाण्ड ────────────────────────────────────────────────────────────
    { kand: 'बालकाण्ड', title: 'राम जन्म',
      events: 'Ravana\'s tyranny troubles the earth; the gods pray to Vishnu, who promises to be born as a man in Ayodhya. ' +
        'King Dasharath of Ayodhya grieves that he has no son; on Guru Vasishtha\'s advice the sage Shringi performs the ' +
        'putrakameshti yagya, and Agni rises from the fire with divine kheer. Dasharath shares it among Kaushalya, Kaikeyi ' +
        'and Sumitra. On Chaitra Navami, Ram is born to Kaushalya, Bharat to Kaikeyi, and Lakshman and Shatrughna to ' +
        'Sumitra; Ayodhya celebrates, and Vasishtha names the four princes. Ends with the joy of Ayodhya.' },
    { kand: 'बालकाण्ड', title: 'चारों भाइयों का बचपन',
      events: 'The childhood of the four princes: Ram\'s divine leelas with Kaushalya, Lakshman always at Ram\'s side, ' +
        'Bharat and Shatrughna inseparable. They study at Guru Vasishtha\'s gurukul: the Vedas, dharma and archery, and ' +
        'Ram\'s humility and kindness win every heart. They return as young princes and Dasharath dreams of their ' +
        'weddings. Ends as the sage Vishwamitra arrives at Dasharath\'s court.' },
    { kand: 'बालकाण्ड', title: 'विश्वामित्र और ताड़का वध',
      events: 'Vishwamitra asks Dasharath for Ram to protect his yagya from rakshasas; Dasharath is heartbroken and offers ' +
        'his army instead, until Vasishtha persuades him. Only Ram and Lakshman leave with Vishwamitra. On the bank of the ' +
        'Saryu, Vishwamitra teaches them the Bala and Atibala mantras. In a terrifying forest he tells them about the ' +
        'demoness Tataka; Ram hesitates to kill a woman, Vishwamitra explains it is dharma to protect the sages, and Ram ' +
        'kills Tataka with one arrow. Ends as the pleased Vishwamitra prepares to give Ram the divine weapons.' },
    { kand: 'बालकाण्ड', title: 'दिव्यास्त्र और यज्ञ की रक्षा',
      events: 'Vishwamitra gives Ram the divine astras. At Siddhashram the sages begin a six-day yagya, and Ram and ' +
        'Lakshman guard it day and night. On the last day Mareech and Subahu attack with their rakshasa army: Ram\'s ' +
        'Manav astra throws Mareech a hundred yojanas into the ocean, his Agneyastra kills Subahu, and Lakshman destroys ' +
        'the rest. The yagya is completed. Ends as Vishwamitra tells them of King Janak\'s bow ceremony in Mithila.' },
    { kand: 'बालकाण्ड', title: 'अहल्या उद्धार',
      events: 'On the way to Mithila, Vishwamitra tells Ram and Lakshman how Bhagirath brought the Ganga down to earth. ' +
        'They reach the empty ashram of the sage Gautam, where Vishwamitra tells how Indra deceived Ahalya and Gautam ' +
        'cursed her to lie there as a stone. The touch of Ram\'s feet frees Ahalya; she bows to Ram and goes to her husband ' +
        'Gautam. Ends as Ram and Lakshman see the city of Janakpur for the first time.' },
    { kand: 'बालकाण्ड', title: 'पुष्प वाटिका: राम-सीता का प्रथम दर्शन',
      events: 'King Janak welcomes Vishwamitra, Ram and Lakshman to Mithila and is moved by the two princes. Ram and ' +
        'Lakshman see the city. In the royal flower garden, picking flowers for their guru, Ram and Sita see each other ' +
        'for the first time; Sita prays to Mother Gauri for Ram as her husband and the goddess blesses her. Janak worries ' +
        'that no king can lift the great bow Pinaka. Ends on the morning of the bow ceremony.' },
    { kand: 'बालकाण्ड', title: 'शिव धनुष भंग',
      events: 'Kings from every land gather for Sita\'s swayamvar; one by one they fail even to move the great bow Pinaka, ' +
        'and Janak despairs that the earth has no hero left; Lakshman rises in anger and ' +
        'Ram calms him. At Vishwamitra\'s word Ram bows to his guru, lifts the bow, and as he strings it the bow breaks ' +
        'with a thunderous crash. Sita garlands Ram. Ends as the thunder of the breaking bow brings the furious Parshuram.' },
    { kand: 'बालकाण्ड', title: 'परशुराम-लक्ष्मण संवाद',
      events: 'Parshuram storms into the hall, enraged that the bow was broken; Lakshman answers him with fearless, sharp ' +
        'words and Parshuram grows angrier, while Ram answers with humility. Parshuram gives Ram his own divine bow; Ram ' +
        'strings it effortlessly, and Parshuram recognises him as the Supreme Lord, bows, and leaves for the mountains. Janak sends ' +
        'messengers to Ayodhya. Ends as King Dasharath sets out for Mithila with the wedding procession.' },
    { kand: 'बालकाण्ड', title: 'सीता-राम विवाह',
      events: 'Dasharath\'s wedding procession reaches Mithila with Bharat and Shatrughna. Four weddings take place: Ram ' +
        'with Sita, Lakshman with Urmila, Bharat with Mandavi and Shatrughna with Shrutakirti. Janak\'s tearful farewell to ' +
        'his daughters, and the return to Ayodhya, where Kaushalya, Kaikeyi and Sumitra welcome the brides. Ends with years ' +
        'of happiness in Ayodhya, as Bharat and Shatrughna leave to visit their grandfather in Kekaya.' },

    // ── अयोध्याकाण्ड ────────────────────────────────────────────────────────
    { kand: 'अयोध्याकाण्ड', title: 'राम राज्याभिषेक की घोषणा',
      events: 'Ageing Dasharath decides to crown Ram as yuvraj; the court and the people rejoice, and Vasishtha fixes the ' +
        'next morning. Ayodhya is decorated all night, Ram and Sita fast and pray, and Kaushalya rejoices. The gods worry ' +
        'that Ram\'s purpose of destroying Ravana will be lost, and the goddess Saraswati turns the mind of Manthara. Ends ' +
        'as Manthara, seeing the celebrations, goes to Kaikeyi.' },
    { kand: 'अयोध्याकाण्ड', title: 'मंथरा और कैकेयी',
      events: 'Kaikeyi, who loves Ram, rewards Manthara for the happy news, but Manthara poisons her mind: Bharat will ' +
        'become Ram\'s servant and Kaikeyi Kaushalya\'s maid. Slowly Kaikeyi turns; Manthara reminds her of the two boons ' +
        'Dasharath once promised her in the war of the gods and asuras. Kaikeyi throws off her jewels and lies in the ' +
        'kop bhavan. Ends as Dasharath, full of joy, comes looking for her.' },
    { kand: 'अयोध्याकाण्ड', title: 'कैकेयी के दो वरदान',
      events: 'Dasharath finds Kaikeyi on the floor of the kop bhavan and swears by Ram to grant whatever she wants. She ' +
        'asks for her two boons: Bharat\'s coronation, and fourteen years of exile in the forest for Ram. Dasharath ' +
        'collapses, begs and pleads through the night, but Kaikeyi will not move. Ends at dawn, as Sumantra is sent to ' +
        'bring Ram.' },
    { kand: 'अयोध्याकाण्ड', title: 'राम का वनवास',
      events: 'Ram hears his father\'s promise from Kaikeyi and calmly accepts the exile with a smile, glad that Bharat ' +
        'will be king. He tells Kaushalya, who is shattered. Lakshman is furious, and Ram calms him with dharma; Lakshman ' +
        'insists on coming. Sita refuses to stay behind: a wife\'s place is with her husband. Lakshman takes Sumitra\'s ' +
        'blessing. Ends as Ram, Sita and Lakshman put on bark clothes and take leave of the grieving Dasharath.' },
    { kand: 'अयोध्याकाण्ड', title: 'अयोध्या से विदाई',
      events: 'All Ayodhya weeps and follows Ram\'s chariot, driven by Sumantra. On the bank of the Tamsa, Ram leaves ' +
        'quietly at night so the people will go home. At Shringverpur, Ram\'s friend Guh, chief of the Nishads, welcomes ' +
        'them; Ram and Sita sleep on the ground while Lakshman and Guh keep watch. Ram sends Sumantra back to Ayodhya. ' +
        'Ends at the bank of the Ganga, where the boatman Kevat waits.' },
    { kand: 'अयोध्याकाण्ड', title: 'केवट प्रसंग',
      events: 'Kevat refuses to take Ram in his boat until he washes Ram\'s feet, afraid the dust that turned a stone into ' +
        'Ahalya will turn his boat into a woman; he washes them with love and ferries them across the Ganga, and refuses ' +
        'any payment. They visit the sage Bharadwaj at Prayag and the sage Valmiki, and settle in a hut at Chitrakoot. ' +
        'Ends as Sumantra\'s empty chariot reaches Ayodhya.' },
    { kand: 'अयोध्याकाण्ड', title: 'दशरथ का देहांत',
      events: 'Sumantra returns without Ram, and Dasharath is broken. At night he tells Kaushalya the secret of his youth: ' +
        'hunting by sound, he shot Shravan as he filled water for his blind parents, and the parents cursed him to die ' +
        'grieving for his own son. Calling "Ram, Ram", Dasharath dies. Ends as Vasishtha sends riders to bring Bharat ' +
        'from Kekaya.' },
    { kand: 'अयोध्याकाण्ड', title: 'भरत का आगमन',
      events: 'Bharat and Shatrughna return to a silent Ayodhya. Bharat learns from Kaikeyi what she has done, rejects her ' +
        'with anguish and refuses the throne; Shatrughna punishes Manthara and Bharat stops him. Bharat comforts ' +
        'Kaushalya and performs Dasharath\'s last rites. Ends as Bharat sets out with the queens, Vasishtha and the people ' +
        'to bring Ram back.' },
    { kand: 'अयोध्याकाण्ड', title: 'भरत मिलाप',
      events: 'Guh first suspects Bharat\'s army, then embraces him on seeing his devotion; the sage Bharadwaj welcomes ' +
        'them. At Chitrakoot, Lakshman sees the army and fears an attack, until Ram stops him. Bharat falls at Ram\'s feet ' +
        'in tears; Ram learns of Dasharath\'s death, grieves and offers water to his father. Ends as Bharat begs Ram to ' +
        'return and rule Ayodhya.' },
    { kand: 'अयोध्याकाण्ड', title: 'चरण पादुका',
      events: 'Bharat, the queens and Vasishtha plead with Ram, and King Janak arrives too; Ram will not break his ' +
        'father\'s word. Bharat asks for Ram\'s padukas, carries them on his head to Ayodhya, places them on the throne, ' +
        'and rules from Nandigram as Ram\'s servant, in bark clothes. Ends as Ram decides to leave Chitrakoot for the ' +
        'deep forest.' },

    // ── अरण्यकाण्ड ──────────────────────────────────────────────────────────
    { kand: 'अरण्यकाण्ड', title: 'जयंत, अत्रि-अनसूया और विराध',
      events: 'At Chitrakoot, Indra\'s son Jayant comes as a crow and pecks Sita\'s foot; Ram\'s blade of grass chases him ' +
        'through the three worlds until he surrenders and loses one eye. Ram, Sita and Lakshman visit the sage Atri, and ' +
        'Mother Anasuya teaches Sita the dharma of a wife and gives her divine clothes and jewellery. In the Dandak forest ' +
        'the rakshasa Viradh seizes Sita, and Ram and Lakshman kill him. Ends as the sages show Ram the bones of sages ' +
        'killed by rakshasas, and Ram vows to free the earth of them.' },
    { kand: 'अरण्यकाण्ड', title: 'अगस्त्य मुनि और पंचवटी',
      events: 'Ram, Sita and Lakshman spend years among the sages\' ashrams. The great sage Agastya welcomes them, gives ' +
        'Ram divine weapons and sends them to Panchavati on the Godavari. On the way they meet the old vulture Jatayu, ' +
        'Dasharath\'s friend, who promises to guard Sita. Lakshman builds a hut at Panchavati and they live there in ' +
        'peace. Ends as Ravana\'s sister Shurpanakha sees Ram.' },
    { kand: 'अरण्यकाण्ड', title: 'शूर्पणखा',
      events: 'Shurpanakha takes the form of a beautiful woman and asks Ram to marry her; Ram says he has a wife and sends ' +
        'her to Lakshman, who sends her back. Enraged, she shows her true form and rushes at Sita, and Lakshman cuts off ' +
        'her nose and ears. Ends as she runs screaming to her brothers Khar and Dushan.' },
    { kand: 'अरण्यकाण्ड', title: 'खर-दूषण वध',
      events: 'Khar sends fourteen rakshasas, and Ram kills them. Khar and Dushan march with fourteen thousand rakshasas; ' +
        'Ram sends Lakshman to guard Sita in a cave and fights alone, and his arrows destroy the whole army, then Dushan ' +
        'and Khar. The sages shower blessings. Ends as Shurpanakha flies to Lanka, to Ravana.' },
    { kand: 'अरण्यकाण्ड', title: 'रावण और मारीच',
      events: 'Shurpanakha shames Ravana in his court for letting Khar and Dushan die, and describes Sita\'s beauty. Ravana ' +
        'goes to Mareech, now living as an ascetic, and orders him to become a golden deer. Mareech, who still fears Ram\'s ' +
        'arrow from Vishwamitra\'s yagya, warns Ravana, but agrees when Ravana threatens to kill him, thinking death at ' +
        'Ram\'s hand is better. Ends as a golden deer appears near the hut at Panchavati.' },
    { kand: 'अरण्यकाण्ड', title: 'स्वर्ण मृग',
      events: 'Sita sees the shining golden deer and asks Ram for it; Lakshman warns that it is a rakshasa\'s trick. Ram ' +
        'leaves Lakshman to guard Sita and chases the deer deep into the forest; his arrow strikes Mareech, who cries out ' +
        '"Ha Sita! Ha Lakshman!" in Ram\'s voice as he dies. Sita, terrified, forces Lakshman with harsh words to go to ' +
        'Ram; Lakshman draws a protective line around the hut and leaves. Ends as an ascetic appears at the door asking ' +
        'for alms.' },
    { kand: 'अरण्यकाण्ड', title: 'सीता हरण',
      events: 'The ascetic is Ravana in disguise; Sita steps out to give alms and Ravana shows his true form, seizes her ' +
        'and carries her off in the Pushpak chariot. Sita cries out to Ram and Lakshman. The old Jatayu attacks Ravana, ' +
        'breaks his chariot and fights bravely, but Ravana cuts off his wings. Over a mountain where vanaras sit, Sita ' +
        'drops her ornaments wrapped in her scarf. Ravana keeps Sita in the Ashok Vatika of Lanka. Ends as Ram, returning, ' +
        'meets Lakshman and fears the worst.' },
    { kand: 'अरण्यकाण्ड', title: 'राम का विलाप और जटायु',
      events: 'Ram finds the hut empty and wanders the forest in grief, asking the trees, birds and deer where Sita has ' +
        'gone, while Lakshman consoles him. They find the dying Jatayu, who tells them that Ravana carried Sita away to ' +
        'the south, and dies in Ram\'s lap. Ram performs Jatayu\'s last rites as for his own father. Ends as the headless ' +
        'demon Kabandh seizes Ram and Lakshman in his long arms.' },
    { kand: 'अरण्यकाण्ड', title: 'कबंध और शबरी',
      events: 'Ram and Lakshman cut off Kabandh\'s arms; freed from his curse, he tells them to seek the vanara Sugriv. At ' +
        'the ashram of the sage Matang, the old Shabari, who has waited years for Ram, welcomes him with berries she has ' +
        'tasted to choose the sweetest, and Ram eats them with love and teaches her the nine kinds of devotion. Shabari ' +
        'shows the way to Sugriv and leaves her body. Ends at Pampa lake, below Rishyamukh mountain.' },

    // ── किष्किन्धाकाण्ड ─────────────────────────────────────────────────────
    { kand: 'किष्किन्धाकाण्ड', title: 'राम-हनुमान मिलन',
      events: 'On Rishyamukh mountain the frightened Sugriv sees two armed warriors and sends Hanuman, disguised as a ' +
        'Brahmin, to find out who they are. Hanuman speaks with Ram, recognises his Lord, shows his true form and falls ' +
        'at his feet; Ram embraces him. Hanuman carries Ram and Lakshman on his shoulders to Sugriv. Ends as Sugriv ' +
        'begins to tell his story.' },
    { kand: 'किष्किन्धाकाण्ड', title: 'राम-सुग्रीव मित्रता',
      events: 'Ram and Sugriv swear friendship with Agni as witness. Sugriv shows Sita\'s ornaments, and Ram weeps; ' +
        'Lakshman recognises only her anklets, as he only ever looked at her feet. Sugriv tells how his brother Vali, after ' +
        'the fight with the demon Mayavi in the cave, believed Sugriv betrayed him, drove him out and took his wife. To ' +
        'prove his strength, Ram kicks away the skeleton of the demon Dundubhi and pierces seven sal trees with one arrow. ' +
        'Ends as Sugriv goes to challenge Vali.' },
    { kand: 'किष्किन्धाकाण्ड', title: 'बालि वध',
      events: 'Sugriv fights Vali, but Ram cannot tell the brothers apart and Sugriv flees, beaten. With a garland on ' +
        'Sugriv\'s neck he challenges again; Tara warns Vali, who will not listen. Ram\'s arrow strikes Vali. The dying ' +
        'Vali asks why Ram struck from hiding, and Ram explains Vali\'s sin against his brother; Vali repents, entrusts his ' +
        'son Angad to Ram and dies. Tara mourns. Ends as Sugriv is crowned king and Angad yuvraj.' },
    { kand: 'किष्किन्धाकाण्ड', title: 'वर्षा ऋतु और लक्ष्मण का क्रोध',
      events: 'Ram and Lakshman spend the four months of the monsoon on Pravarshan mountain, Ram longing for Sita. When the ' +
        'rains end, Sugriv, lost in royal comforts, forgets his promise. Lakshman storms into Kishkindha in anger; Tara ' +
        'calms him and Sugriv begs forgiveness, while Hanuman has already gathered vanara armies from every land. Ends as ' +
        'search parties are sent in four directions and Ram gives Hanuman his ring for Sita.' },
    { kand: 'किष्किन्धाकाण्ड', title: 'सीता की खोज',
      events: 'The southern party, Angad, Hanuman and Jambavan with their vanaras, searches forests and mountains. Lost and ' +
        'thirsty, they enter the cave of the ascetic Swayamprabha, who brings them out to the seashore. The month given by ' +
        'Sugriv has passed; Angad despairs, and they resolve to fast until death on the shore, lamenting the death of ' +
        'Jatayu. Ends as the old vulture Sampati hears his brother Jatayu\'s name.' },
    { kand: 'किष्किन्धाकाण्ड', title: 'जाम्बवान ने जगाई हनुमान की शक्ति',
      events: 'Sampati, Jatayu\'s elder brother, tells how his wings were burnt by the sun when he shielded Jatayu, and with ' +
        'his far sight he sees Sita in Lanka, a hundred yojanas across the ocean. Each vanara says how far he can leap; ' +
        'none can reach Lanka and return. Jambavan reminds Hanuman of his forgotten powers: his childhood leap at the sun ' +
        'and the sages\' curse that made him forget his strength. Hanuman grows huge, roaring "Jai Shri Ram". Ends as ' +
        'Hanuman stands on Mahendra mountain, ready to leap.' },

    // ── सुन्दरकाण्ड ─────────────────────────────────────────────────────────
    { kand: 'सुन्दरकाण्ड', title: 'हनुमान की छलांग',
      events: 'Hanuman leaps across the ocean. The mountain Mainak rises to offer him rest, and Hanuman touches it and flies ' +
        'on. Surasa, mother of serpents, tests him by opening her mouth wide; Hanuman grows, then becomes tiny, enters and ' +
        'leaves her mouth, and she blesses him. The shadow-catching demoness Simhika seizes him and he kills her. He lands ' +
        'on Lanka\'s mountain at dusk, takes a tiny form and defeats Lankini, the guardian of the city, with one blow. ' +
        'Ends as Hanuman enters Lanka at night.' },
    { kand: 'सुन्दरकाण्ड', title: 'लंका में सीता की खोज',
      events: 'Hanuman searches Lanka\'s golden palaces by moonlight; in Ravana\'s palace he sees Mandodari asleep and for a ' +
        'moment mistakes her for Sita, then knows Sita would never be there. He finds a house marked with Ram\'s name and ' +
        'tulsi, and meets Vibhishan, who tells him Sita is in the Ashok Vatika. Ends as Hanuman, hidden in an ashoka tree, ' +
        'sees Sita, thin and grieving, below.' },
    { kand: 'सुन्दरकाण्ड', title: 'अशोक वाटिका',
      events: 'Ravana comes to the Ashok Vatika with his queens and threatens and tempts Sita; she answers him holding up a ' +
        'blade of grass and warns him of Ram\'s wrath. Ravana gives her a deadline and Mandodari calms him. The rakshasi ' +
        'guards torment Sita, until Trijata tells them her dream of Lanka\'s destruction. Alone, Sita despairs. Ends as ' +
        'Hanuman drops Ram\'s ring before her.' },
    { kand: 'सुन्दरकाण्ड', title: 'हनुमान-सीता भेंट',
      events: 'Hanuman sings Ram\'s story softly from the tree and comes down; Sita fears a rakshasa trick until she holds ' +
        'Ram\'s ring and weeps. Hanuman gives Ram\'s message, offers to carry her back, and shows his giant form; Sita says ' +
        'Ram himself must come. She gives her chudamani and reminds him of the crow incident as a sign for Ram. Ends as ' +
        'Hanuman, hungry, asks to eat the fruits of the garden.' },
    { kand: 'सुन्दरकाण्ड', title: 'अक्षय कुमार वध और मेघनाद',
      events: 'Hanuman eats the fruits and uproots the Ashok Vatika; the guards attack and he destroys them. Ravana sends his ' +
        'young son Akshay, and Hanuman kills him. Then Meghnad comes and, after a great fight, uses the Brahmastra; ' +
        'Hanuman lets himself be bound out of respect for the weapon. Ends as Hanuman is dragged into Ravana\'s court.' },
    { kand: 'सुन्दरकाण्ड', title: 'लंका दहन',
      events: 'In Ravana\'s court Hanuman tells Ravana to return Sita and seek Ram\'s mercy; Ravana orders his death, and ' +
        'Vibhishan reminds him that an envoy must not be killed. Ravana orders Hanuman\'s tail set on fire; Hanuman grows, ' +
        'escapes and leaps from roof to roof setting Lanka ablaze, sparing Vibhishan\'s house. He cools his tail in the ' +
        'ocean and goes to Sita to make sure she is safe. Ends as Hanuman leaps back across the ocean.' },
    { kand: 'सुन्दरकाण्ड', title: 'हनुमान की वापसी और समुद्र तट',
      events: 'Hanuman lands among the waiting vanaras, who celebrate and feast in Sugriv\'s Madhuvan garden. Hanuman tells ' +
        'Ram everything and gives him Sita\'s chudamani; Ram embraces Hanuman and says he can never repay him. The vanara ' +
        'army marches south. Ends at the shore of the vast ocean, while in Lanka Vibhishan begs Ravana to return Sita.' },

    // ── लंकाकाण्ड ───────────────────────────────────────────────────────────
    { kand: 'लंकाकाण्ड', title: 'विभीषण शरणागति',
      events: 'In Ravana\'s court Vibhishan advises returning Sita; Ravana insults and kicks him. Vibhishan crosses the ' +
        'ocean to Ram; Sugriv suspects a spy, but Ram says he will protect anyone who comes to him for refuge, and anoints ' +
        'Vibhishan king of Lanka with seawater. Ends as Ram asks how the army will cross the ocean.' },
    { kand: 'लंकाकाण्ड', title: 'राम सेतु',
      events: 'Ram prays to the ocean for three days without an answer, then angrily raises his bow. Samudra rises with ' +
        'folded hands and tells him that Nal and Neel can build a bridge. Ram installs a Shivling at Rameshwaram and ' +
        'worships Lord Shiva. The vanaras carry rocks and trees, Nal and Neel lay them, and stones marked with Ram\'s name ' +
        'float. Ends as the army crosses the setu and camps on Suvel mountain, facing Lanka.' },
    { kand: 'लंकाकाण्ड', title: 'अंगद का पैर',
      events: 'Ram sends Angad as his envoy to give Ravana one last chance. In Ravana\'s court Angad warns Ravana and, mocked, ' +
        'plants his foot and challenges anyone to move it; none of Ravana\'s warriors can. When Ravana himself bends to ' +
        'lift it, Angad pulls back his foot and tells Ravana to fall at Ram\'s feet instead. Ends as Angad returns and war ' +
        'is declared.' },
    { kand: 'लंकाकाण्ड', title: 'युद्ध का आरंभ और नागपाश',
      events: 'The vanara army attacks the four gates of Lanka and great duels begin. Meghnad fights invisibly from the ' +
        'clouds and binds Ram and Lakshman with the serpent noose, the nagpash; the vanaras despair and Ravana tells Sita ' +
        'that Ram is dead, but Trijata comforts her. Garuda arrives and the serpents flee, freeing Ram and Lakshman. Ends ' +
        'as Ravana himself rides out to battle.' },
    { kand: 'लंकाकाण्ड', title: 'राम-रावण पहला युद्ध',
      events: 'Ravana\'s generals fall one by one. Ravana enters the battle, wounds the vanaras, and Hanuman strikes him with ' +
        'his fist. Ram faces Ravana, destroys his chariot, bow and crown, and, seeing him unarmed, tells him to go home, ' +
        'rest, and return to fight tomorrow. Ends as the humiliated Ravana orders Kumbhakarna woken from his long sleep.' },
    { kand: 'लंकाकाण्ड', title: 'कुम्भकर्ण',
      events: 'The rakshasas wake the giant Kumbhakarna with drums, elephants and mountains of food. Kumbhakarna tells Ravana ' +
        'that taking Sita was wrong, but goes to fight for his brother. Vibhishan meets him on the battlefield and they ' +
        'part with respect. Kumbhakarna crushes the vanaras and carries off Sugriv, who escapes; Ram cuts off his arms and ' +
        'legs and kills him with an arrow. Ends with Ravana\'s grief, and Meghnad\'s vow of revenge.' },
    { kand: 'लंकाकाण्ड', title: 'लक्ष्मण मूर्छा',
      events: 'Meghnad fights Lakshman and strikes him with the shakti weapon; Lakshman falls unconscious. Ram weeps over ' +
        'his brother, saying he can find another Sita but never another Lakshman. Hanuman brings the physician Sushen from ' +
        'Lanka, who says only the Sanjeevani herb from the Himalaya can save Lakshman, before sunrise. Ends as Hanuman ' +
        'leaps north into the night.' },
    { kand: 'लंकाकाण्ड', title: 'संजीवनी बूटी',
      events: 'Ravana sends Kalanemi, disguised as a sage, to delay Hanuman; Hanuman sees through the trick and kills him. ' +
        'Unable to tell the herb apart, Hanuman lifts the whole mountain. Flying over Ayodhya, Bharat shoots him down ' +
        'thinking him a demon; learning the truth, Bharat grieves and helps him on his way. Hanuman reaches Lanka before ' +
        'dawn, Sushen gives Lakshman the herb and Lakshman wakes. Ends as Ram embraces Hanuman.' },
    { kand: 'लंकाकाण्ड', title: 'मेघनाद वध',
      events: 'Meghnad begins a secret yagya at Nikumbhila to become invincible; Vibhishan tells Ram, and Lakshman goes with ' +
        'Vibhishan and Hanuman to stop it. Lakshman breaks the yagya, and after a fierce duel of divine weapons he kills ' +
        'Meghnad. Ends with Ravana\'s grief and his rage, as he decides to fight Ram himself.' },
    { kand: 'लंकाकाण्ड', title: 'राम-रावण महायुद्ध',
      events: 'Ravana rides into battle for the last time. Indra sends his chariot with the charioteer Matali for Ram. The ' +
        'two fight a terrible battle of divine weapons; every time Ram cuts off Ravana\'s heads they grow back. Ends as ' +
        'Vibhishan tells Ram the secret: the nectar of immortality in Ravana\'s navel.' },
    { kand: 'लंकाकाण्ड', title: 'रावण वध',
      events: 'Ram\'s arrows dry the nectar in Ravana\'s navel and strike off his heads and arms, and Ravana falls. The gods ' +
        'shower flowers. Mandodari mourns her husband. Vibhishan hesitates, and Ram tells him to give Ravana a royal ' +
        'funeral, because enmity ends with death. Ends as Vibhishan is crowned king of Lanka.' },
    { kand: 'लंकाकाण्ड', title: 'सीता की अग्नि परीक्षा',
      events: 'Hanuman brings Sita the news of victory. Sita comes before Ram; to prove her purity before the world she enters ' +
        'a fire that Lakshman lights, and Agni himself rises with her unharmed and gives her back to Ram. The gods and ' +
        'Dasharath appear from heaven and bless Ram. Ends as Ram, Sita, Lakshman and their friends board the Pushpak ' +
        'chariot for Ayodhya.' },
    { kand: 'लंकाकाण्ड', title: 'अयोध्या वापसी',
      events: 'From the Pushpak Ram shows Sita the places of their story: the setu, Kishkindha, Panchavati, Chitrakoot. They ' +
        'stop at the ashram of the sage Bharadwaj, and Hanuman flies ahead to Bharat, who was about to enter fire as the ' +
        'fourteen years ended. Bharat runs to meet Ram, and the brothers embrace; Ram meets his mothers. Ayodhya lights ' +
        'rows of lamps to welcome Ram home. Ends as the city prepares for the coronation.' },
    { kand: 'लंकाकाण्ड', title: 'राम राज्याभिषेक',
      events: 'Vasishtha crowns Ram king of Ayodhya with Sita beside him. Ram gives gifts to all who helped him; Sita gives ' +
        'her pearl necklace to Hanuman, who asks only to serve Ram for ever. Sugriv, Vibhishan and the vanaras return home, ' +
        'and Ram Rajya begins: no sorrow, no fear, and justice for all. Ends the series with blessings for every listener.' },
  ],
};
