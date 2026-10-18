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
 * Dates cover 2026-2027. Most Hindu/Islamic festivals are lunar and shift every
 * year — this list needs a manual refresh once a year (check
 * timeanddate.com/holidays/india or drikpanchang.com for next year's dates
 * and update OCCASIONS below; keep the shape the same).
 */
// Festival days with their own kathas. `eveKatha` is the festival's
// best-known katha, posted the afternoon before (the FESTIVAL_EVE run,
// ~1 PM IST), when people start searching for it ahead of the puja and a
// Short has a day to gather views; `katha` is a second one for the morning
// Short on the day. `deity` is a lib/iconography.js-style hint. `top` marks
// the year's biggest searches, which win the week's Sunday long video over a
// smaller festival (weekly-katha.js). A festival that comes every year is
// defined once here and dated per year in FESTIVAL_DAYS.
const FESTIVALS = {
  dussehra: { top: true, name: 'Dussehra', hindi: 'दशहरा', genre: 'devotional', deity: 'ram',
    visual: 'Lord Ram with his bow drawn, Hanuman and Lakshman beside him, ten-headed Ravana on the Lanka battlefield, divine golden light',
    hashtag: '#Dussehra', hashtags: ['#dussehra', '#vijayadashami', '#jaishreeram', '#ravandahan'],
    eveKatha: 'Ram slays Ravana on Vijayadashami with the arrow of Brahma after Vibhishana reveals the secret of the amrit in his navel — the victory of good over evil',
    katha: 'Before the final battle Ram worships Maa Durga with 108 blue lotuses; when one goes missing he offers his own lotus eye, and the Goddess blesses him with victory' },
  sharadPurnima: { name: 'Sharad Purnima', hindi: 'शरद पूर्णिमा', genre: 'devotional', deity: 'krishna',
    visual: 'a huge silver full moon over the Yamuna, Krishna playing the flute amid dancing gopis in moonlit Vrindavan, a bowl of kheer under the moonlight',
    hashtag: '#SharadPurnima', hashtags: ['#sharadpurnima', '#kojagari', '#radhekrishna', '#maharaas'],
    eveKatha: 'Krishna\'s Maha Raas on Sharad Purnima — he plays his flute and appears beside every gopi at once in the moonlit forest of Vrindavan',
    katha: 'The Sharad Purnima vrat katha of the moneylender\'s two daughters — the elder kept the full fast, and her touch brought her sister\'s lifeless baby back to life' },
  karvaChauth: { top: true, name: 'Karva Chauth', hindi: 'करवा चौथ', genre: 'devotional', deity: 'parvati',
    visual: 'a married Indian woman in a red bridal saree looking at the full moon through a sieve, a decorated clay karva pot and a lit diya, moonlit rooftop',
    hashtag: '#KarvaChauth', hashtags: ['#karwachauth', '#karvachauth', '#karwachauthvratkatha', '#suhag'],
    eveKatha: 'The Karva Chauth vrat katha of Queen Veeravati — her brothers trick her into breaking her fast with a false moon, her husband falls lifeless, and her year of devotion to Maa Parvati brings him back',
    katha: 'Karva, the devoted wife who binds the crocodile that seized her husband with a cotton thread and makes Yamraj return his life' },
  ahoiAshtami: { name: 'Ahoi Ashtami', hindi: 'अहोई अष्टमी', genre: 'devotional', deity: 'devi',
    visual: 'Ahoi Mata with a porcupine and her cubs painted on a wall, mothers praying at dusk beside a pot of water, the first stars in the sky',
    hashtag: '#AhoiAshtami', hashtags: ['#ahoiashtami', '#ahoimata', '#vratkatha', '#maa'],
    eveKatha: 'The Ahoi Ashtami vrat katha — a mother digging soil for her home accidentally kills a porcupine\'s cub, loses her own sons, and wins them back by fasting for Ahoi Mata',
    katha: 'The youngest daughter-in-law who serves the cow Surahi with devotion and is led to the porcupine mother, who blesses her children with long life' },
  dhanteras: { name: 'Dhanteras', hindi: 'धनतेरस', genre: 'devotional', deity: 'vishnu',
    visual: 'rows of glowing diyas at a doorway, gold coins and new brass vessels, Lord Dhanvantari rising from the ocean holding a golden pot of amrit',
    hashtag: '#Dhanteras', hashtags: ['#dhanteras', '#dhantrayodashi', '#lakshmi', '#yamdeepdaan'],
    eveKatha: 'King Hima\'s son is fated to die of a snakebite four days after his wedding; his wife lights lamps and piles gold at the door, and Yamraj, dazzled, turns back — why lamps are lit for Yama on Dhanteras',
    katha: 'Lord Dhanvantari, the physician of the gods, rises from the churning of the ocean holding the pot of amrit on Dhanteras' },
  narakChaturdashi: { name: 'Narak Chaturdashi', hindi: 'नरक चतुर्दशी', genre: 'devotional', deity: 'krishna',
    visual: 'Krishna and Satyabhama on the eagle Garuda battling the demon Narakasura, his fortress city, freed princesses, oil lamps at dawn',
    hashtag: '#ChotiDiwali', hashtags: ['#chotidiwali', '#narakchaturdashi', '#roopchaudas', '#krishna'],
    eveKatha: 'Krishna and Satyabhama defeat the demon Narakasura and free sixteen thousand captive princesses — why Choti Diwali is celebrated',
    katha: 'The Narak Chaturdashi vrat katha of the righteous King Rantidev, whom Yama\'s messengers come to take to hell for one forgotten fault, and how fasting on this day saved him' },
  diwali: { top: true, name: 'Diwali', hindi: 'दिवाली', genre: 'devotional', deity: 'lakshmi',
    visual: 'Ayodhya glowing with thousands of diyas, Lord Ram, Sita and Lakshman returning on the Pushpak Viman, rangoli, Goddess Lakshmi on a lotus',
    hashtag: '#Diwali', hashtags: ['#diwali', '#happydiwali', '#lakshmipuja', '#deepawali'],
    eveKatha: 'Lord Ram, Sita and Lakshman return to Ayodhya after fourteen years of exile and the people light rows of diyas on the darkest night — the first Diwali',
    katha: 'The Diwali Lakshmi Puja katha of the moneylender\'s daughter who watered the peepal tree every day, befriended Goddess Lakshmi and brought prosperity home' },
  govardhanPuja: { name: 'Govardhan Puja', hindi: 'गोवर्धन पूजा', genre: 'devotional', deity: 'krishna',
    visual: 'little Krishna holding Govardhan hill on his little finger like an umbrella, the people and cows of Braj sheltering beneath it, a thunderstorm above',
    hashtag: '#GovardhanPuja', hashtags: ['#govardhanpuja', '#annakut', '#govardhandhari', '#radhekrishna'],
    eveKatha: 'Krishna lifts Govardhan hill on his little finger for seven days to shelter Vrindavan from Indra\'s storm, and Indra bows to him',
    katha: 'The first Annakut — the people of Braj offer a mountain of fifty-six dishes to Govardhan at little Krishna\'s word' },
  bhaiDooj: { name: 'Bhai Dooj', hindi: 'भाई दूज', genre: 'devotional', deity: 'yama',
    visual: 'Yamuna devi lovingly putting a tilak on her brother Yamraj, a festive meal, a riverbank at sunset',
    hashtag: '#BhaiDooj', hashtags: ['#bhaidooj', '#bhaiyadooj', '#yamdwitiya', '#bhaibehen'],
    eveKatha: 'Yamraj visits his sister Yamuna after years apart; she welcomes him with tilak and a feast, and he grants the boon that protects every brother who visits his sister on this day — the story of Bhai Dooj',
    katha: 'Krishna returns after defeating Narakasura and his sister Subhadra welcomes him with a tilak, aarti and sweets' },
  chhathPuja: { top: true, name: 'Chhath Puja', hindi: 'छठ पूजा', genre: 'devotional', deity: 'surya',
    visual: 'devotees standing waist-deep in a river at sunset offering arghya to the setting sun, bamboo baskets of fruit and thekua, diyas on the water',
    hashtag: '#ChhathPuja', hashtags: ['#chhathpuja', '#chhathimaiya', '#suryadev', '#chhath'],
    eveKatha: 'Chhathi Maiya and the childless King Priyavrat — his son is born lifeless, the goddess appears and gives the baby life, and the Chhath vrat begins',
    katha: 'Draupadi keeps the Chhath vrat to Surya on Sage Dhaumya\'s advice, and the Pandavas win back their lost kingdom' },
  devUthaniEkadashi: { name: 'Dev Uthani Ekadashi', hindi: 'देवउठनी एकादशी', genre: 'devotional', deity: 'vishnu',
    visual: 'Lord Vishnu waking on the serpent Shesha in the cosmic ocean, Lakshmi at his feet, a Tulsi plant decorated as a bride with a Shaligram stone',
    hashtag: '#DevUthaniEkadashi', hashtags: ['#devuthaniekadashi', '#tulsivivah', '#prabodhiniekadashi', '#vishnu'],
    eveKatha: 'Tulsi Vivah — the devoted Vrinda, whose faithfulness made her husband Jalandhar invincible, curses Vishnu to become a stone, becomes the Tulsi plant, and is married to Shaligram',
    katha: 'Lord Vishnu wakes from four months of yoga nidra on Dev Uthani Ekadashi and weddings and auspicious work begin again' },
  kartikPurnima: { name: 'Kartik Purnima', hindi: 'कार्तिक पूर्णिमा', genre: 'devotional', deity: 'shiva',
    visual: 'Lord Shiva as Tripurari on a golden chariot shooting one fiery arrow through three flying cities, the ghats of Kashi lit with countless diyas',
    hashtag: '#DevDeepawali', hashtags: ['#kartikpurnima', '#devdeepawali', '#harharmahadev', '#kashi'],
    eveKatha: 'Shiva as Tripurari destroys the three flying cities of Tripurasura with a single arrow and the gods light lamps in Kashi — the first Dev Deepawali',
    katha: 'King Bhagiratha\'s tapasya brings Maa Ganga down from heaven to free his ancestors — why a holy dip in the Ganga on Kartik Purnima is so sacred' },
  makarSankranti: { name: 'Makar Sankranti', hindi: 'मकर संक्रांति', genre: 'devotional', deity: 'surya',
    visual: 'the sun rising over the Ganga, kites filling the sky, sesame-jaggery laddoos, Bhishma on a bed of arrows at Kurukshetra',
    hashtag: '#MakarSankranti', hashtags: ['#makarsankranti', '#uttarayan', '#suryadev', '#khichdi'],
    eveKatha: 'Bhishma Pitamah lies on his bed of arrows at Kurukshetra, waiting for the sun to turn north on Makar Sankranti before he leaves his body by his own wish',
    katha: 'Surya Dev visits his son Shani, long estranged, at his home on Makar Sankranti, and Shani welcomes him with black sesame — why til is offered on this day' },
  basantPanchami: { name: 'Basant Panchami', hindi: 'बसंत पंचमी', genre: 'devotional', deity: 'saraswati',
    visual: 'Goddess Saraswati in white on a lotus playing the veena, a swan beside her, yellow mustard fields in spring bloom',
    hashtag: '#BasantPanchami', hashtags: ['#basantpanchami', '#saraswatipuja', '#maasaraswati', '#vasantpanchami'],
    eveKatha: 'Brahma creates the world but finds it silent and lifeless, until Maa Saraswati appears with her veena and gives every creature a voice — why Basant Panchami is her day',
    katha: 'Kalidasa, mocked as a fool and thrown out by his wife, prays to Maa Saraswati and becomes the greatest poet of India' },
  mahaShivratri: { top: true, name: 'Maha Shivratri', hindi: 'महाशिवरात्रि', genre: 'devotional', deity: 'shiva',
    visual: 'Lord Shiva and Parvati at their divine wedding on Mount Kailash, ghosts, ascetics and gods in the procession, a Shivling with bel leaves and milk',
    hashtag: '#MahaShivratri', hashtags: ['#mahashivratri', '#harharmahadev', '#shivparvati', '#bholenath'],
    eveKatha: 'The wedding of Shiva and Parvati on Maha Shivratri — Shiva arrives as a groom with ghosts, ascetics and snakes, Queen Mena faints, and then he appears as the most beautiful Sundareshwar',
    katha: 'Shiva appears as an endless pillar of fire on the night of Maha Shivratri, and Brahma\'s lie about finding its top is exposed by the Ketaki flower' },
  holikaDahan: { name: 'Holika Dahan', hindi: 'होलिका दहन', genre: 'devotional', deity: 'vishnu',
    visual: 'a huge bonfire at night, little Prahlad sitting calmly in the flames chanting Narayan, the demoness Holika burning, King Hiranyakashipu in rage',
    hashtag: '#HolikaDahan', hashtags: ['#holikadahan', '#holi', '#prahlad', '#narayan'],
    eveKatha: 'Holika, who cannot be burned, sits in the fire with little Prahlad in her lap; Prahlad keeps chanting Narayan, the fire spares him and Holika burns — why Holika Dahan is celebrated',
    katha: 'Kamadeva shoots his flower arrow to break Shiva\'s meditation, is burned to ashes by Shiva\'s third eye, and Rati\'s devotion brings him back' },
  holi: { top: true, name: 'Holi', hindi: 'होली', genre: 'devotional', deity: 'krishna',
    visual: 'Radha and Krishna playing Holi in Vrindavan, clouds of pink, yellow and green colour, gopis with pichkaris, Braj in spring',
    hashtag: '#Holi', hashtags: ['#holi', '#happyholi', '#radhekrishna', '#brajkiholi'],
    eveKatha: 'Little Krishna asks Yashoda why he is dark and Radha is fair; Yashoda laughs and tells him to colour Radha\'s face — the first Holi of Braj',
    katha: 'The Lathmar Holi of Barsana — Krishna and his friends come from Nandgaon to tease Radha\'s sakhis, who chase them away with sticks' },
  ramNavami: { top: true, name: 'Ram Navami', hindi: 'राम नवमी', genre: 'devotional', deity: 'ram',
    visual: 'baby Ram in Queen Kaushalya\'s arms in the palace of Ayodhya, King Dasharatha rejoicing, flowers falling from the sky, the gods watching',
    hashtag: '#RamNavami', hashtags: ['#ramnavami', '#jaishreeram', '#ayodhya', '#ramlala'],
    eveKatha: 'King Dasharatha\'s putrakameshti yagna, the divine kheer, and the birth of Ram to Kaushalya in Ayodhya at noon on Chaitra Navami',
    katha: 'Young Ram goes with Sage Vishwamitra to the forest and frees Ahalya, turned to stone by a curse, with the touch of his feet' },
  hanumanJayanti: { name: 'Hanuman Jayanti', hindi: 'हनुमान जयंती', genre: 'devotional', deity: 'hanuman',
    visual: 'Anjana holding baby Hanuman on a mountain, Vayu Dev\'s winds around them, Kesari beside her, a glowing dawn',
    hashtag: '#HanumanJayanti', hashtags: ['#hanumanjayanti', '#jaihanuman', '#bajrangbali', '#jaishreeram'],
    eveKatha: 'The birth of Hanuman — the apsara Anjana, cursed to be born a vanara, prays to Shiva, and Vayu Dev carries the blessing that gives her a son, Hanuman',
    katha: 'How Hanuman got his name — Indra\'s thunderbolt strikes the child\'s jaw (hanu), Vayu stops the winds of the world, and every god blesses the boy' },
  akshayaTritiya: { name: 'Akshaya Tritiya', hindi: 'अक्षय तृतीया', genre: 'devotional', deity: 'krishna',
    visual: 'Draupadi holding the shining Akshaya Patra in a forest hut, Krishna smiling as he eats one grain of rice, Sage Durvasa and his disciples by a river',
    hashtag: '#AkshayaTritiya', hashtags: ['#akshayatritiya', '#akhateej', '#krishna', '#draupadi'],
    eveKatha: 'The Akshaya Patra — Sage Durvasa and his disciples arrive hungry at the Pandavas\' forest hut after the food is gone; Krishna eats the one grain of rice left in Draupadi\'s vessel and the whole world is fed',
    katha: 'The birth of Lord Parashurama, Vishnu\'s sixth avatar, to Sage Jamadagni and Renuka on Akshaya Tritiya' },
  vatSavitri: { name: 'Vat Savitri', hindi: 'वट सावित्री', genre: 'devotional', deity: 'yama',
    visual: 'Savitri in a red saree following Yamraj on his buffalo through a forest, her husband Satyavan lying under a great banyan tree',
    hashtag: '#VatSavitri', hashtags: ['#vatsavitri', '#savitrisatyavan', '#vatpurnima', '#vratkatha'],
    eveKatha: 'Savitri follows Yamraj as he carries away the soul of her husband Satyavan, and with her wisdom and devotion wins three boons and his life back — the Vat Savitri vrat katha',
    katha: 'Princess Savitri chooses the woodcutter Satyavan as her husband even after Narad Muni warns that he will die within a year' },
  guruPurnima: { name: 'Guru Purnima', hindi: 'गुरु पूर्णिमा', genre: 'devotional', deity: 'vyasa',
    visual: 'Sage Ved Vyasa with a long white beard seated under a tree in an ashram, disciples around him, palm-leaf manuscripts, a full moon',
    hashtag: '#GuruPurnima', hashtags: ['#gurupurnima', '#vyasapurnima', '#guru', '#sanatandharma'],
    eveKatha: 'Ved Vyasa, born on Ashadha Purnima on an island in the Yamuna, divides the one Veda into four so every age can learn it — why Guru Purnima is Vyasa Purnima',
    katha: 'Eklavya, turned away by Dronacharya, learns archery before a clay statue of his guru and gives his right thumb as guru dakshina' },
  hariyaliTeej: { name: 'Hariyali Teej', hindi: 'हरियाली तीज', genre: 'devotional', deity: 'parvati',
    visual: 'Maa Parvati and Shiva on a flower-decked swing in the monsoon, women in green sarees with mehndi, swings on trees, rain clouds',
    hashtag: '#HariyaliTeej', hashtags: ['#hariyaliteej', '#teej', '#shivparvati', '#sawan'],
    eveKatha: 'Shiva reminds Parvati how, through 107 births, she longed for him, and how her tapasya in the rains of Sawan in her 108th birth finally won him — the Hariyali Teej katha',
    katha: 'Radha and Krishna on the flower swing (jhula) in the monsoon in Vrindavan, as the gopis sing and the peacocks dance' },
  nagPanchami: { name: 'Nag Panchami', hindi: 'नाग पंचमी', genre: 'devotional', deity: 'shiva',
    visual: 'a great serpent coiled around a Shivling, women offering milk at an anthill, Sheshnag and the serpent kings, a monsoon village',
    hashtag: '#NagPanchami', hashtags: ['#nagpanchami', '#nagdevta', '#mahadev', '#sawan'],
    eveKatha: 'The young sage Astika stops King Janamejaya\'s great snake sacrifice and saves the Nagas on Shravan Shukla Panchami — why Nag Panchami is celebrated',
    katha: 'The Nag Panchami vrat katha of the farmer\'s daughter who fed milk to the serpent mother whose children were killed, and won her forgiveness and blessing' },
  rakshaBandhan: { top: true, name: 'Raksha Bandhan', hindi: 'रक्षाबंधन', genre: 'devotional', deity: 'krishna',
    visual: 'Draupadi tearing the edge of her sari to bind Krishna\'s bleeding finger in a palace hall, rakhi threads, a sister and brother',
    hashtag: '#RakshaBandhan', hashtags: ['#rakshabandhan', '#rakhi', '#bhaibehen', '#krishna'],
    eveKatha: 'Draupadi tears her sari to bind Krishna\'s finger cut by the Sudarshan Chakra, and Krishna repays that thread of love by protecting her honour in the Kaurava court',
    katha: 'Indrani ties a sacred thread blessed with mantras on Indra\'s wrist before his battle with the demons, and Indra wins — the first raksha sutra' },
  janmashtami: { top: true, name: 'Krishna Janmashtami', hindi: 'जन्माष्टमी', genre: 'devotional', deity: 'krishna',
    visual: 'midnight in Kansa\'s prison, Vasudev carrying baby Krishna in a basket across the stormy Yamuna, Sheshnag spreading his hoods over them',
    hashtag: '#Janmashtami', hashtags: ['#janmashtami', '#krishnajanmashtami', '#jaishreekrishna', '#nandlala'],
    eveKatha: 'Krishna is born at midnight in Kansa\'s prison; the chains fall, the guards sleep, and Vasudev carries him through the stormy Yamuna to Gokul under Sheshnag\'s hoods',
    katha: 'At Devaki\'s wedding a voice from the sky tells Kansa her eighth son will kill him, and he throws his sister and Vasudev into prison' },
  hartalikaTeej: { name: 'Hartalika Teej', hindi: 'हरतालिका तीज', genre: 'devotional', deity: 'parvati',
    visual: 'young Parvati in a forest cave worshipping a Shivling made of sand, her friends keeping watch, a night vigil with diyas',
    hashtag: '#HartalikaTeej', hashtags: ['#hartalikateej', '#teej', '#shivparvati', '#vratkatha'],
    eveKatha: 'The Hartalika Teej vrat katha — Parvati\'s friends carry her away to a forest so her father cannot marry her to Vishnu, and her night-long worship of a sand Shivling wins Shiva',
    katha: 'Parvati gives up even leaves during her tapasya and the gods name her Aparna, until Shiva comes in disguise to test her love' },
  ganeshChaturthi: { top: true, name: 'Ganesh Chaturthi', hindi: 'गणेश चतुर्थी', genre: 'devotional', deity: 'ganesha',
    visual: 'Parvati shaping Ganesha from sandalwood paste, the boy Ganesha guarding her door, a festive Ganesha idol with modaks and flowers',
    hashtag: '#GaneshChaturthi', hashtags: ['#ganeshchaturthi', '#ganpatibappamorya', '#ganesha', '#vinayakachaturthi'],
    eveKatha: 'Parvati creates Ganesha from sandalwood paste to guard her door; he stops even Shiva, loses his head, and is reborn with an elephant\'s head as the first-worshipped god',
    katha: 'The Ganesh Chaturthi vrat katha of the moon who laughed at Ganesha, the curse on anyone who sees the moon this night, and how Krishna himself was falsely accused of stealing the Syamantaka jewel' },
  vivahPanchami: { name: 'Vivah Panchami', hindi: 'विवाह पंचमी', genre: 'devotional', deity: 'ram',
    visual: 'Ram and Sita\'s wedding in Janakpur, Sita placing the varmala on Ram, Shiva\'s great bow broken in two, King Janak\'s court rejoicing',
    hashtag: '#VivahPanchami', hashtags: ['#vivahpanchami', '#siyaram', '#janakpur', '#jaishreeram'],
    eveKatha: 'At Sita\'s swayamvar in Janakpur, no king can lift Shiva\'s bow; Ram lifts it, breaks it, and Sita garlands him — the wedding of Ram and Sita on Vivah Panchami',
    katha: 'Ram and Sita see each other for the first time in King Janak\'s flower garden, and Sita prays to Maa Gauri for Ram as her husband' },
  gitaJayanti: { name: 'Gita Jayanti', hindi: 'गीता जयंती', genre: 'devotional', deity: 'krishna',
    visual: 'Krishna as charioteer on the battlefield of Kurukshetra, Arjuna with his bow lowered, the two armies facing each other, divine light',
    hashtag: '#GitaJayanti', hashtags: ['#gitajayanti', '#bhagavadgita', '#mokshadaekadashi', '#krishna'],
    eveKatha: 'On the battlefield of Kurukshetra, Arjuna lays down his bow before his own family, and Krishna speaks the Bhagavad Gita to him — and shows him his universal form',
    katha: 'The Mokshada Ekadashi vrat katha of King Vaikhanasa, who sees his father suffering in hell in a dream and frees him by keeping this fast' },
};

// When each festival falls. No lead-up window: the days around a festival
// stay with the weekday deity, so every post is a different, specific story.
// Dates: Drik Panchang (its default city), cross-checked with Tirth (New
// Delhi) and AstroSage; a tithi can shift a day by region. Never two on one
// date: getOccasion takes the first match. Guru Nanak Jayanti shares Kartik
// Purnima's date in both years and isn't listed. Add 2028 before January 2028.
const FESTIVAL_DAYS = [
  // 2026
  ['2026-10-20', 'dussehra'],
  ['2026-10-25', 'sharadPurnima'],
  ['2026-10-29', 'karvaChauth'],
  ['2026-11-01', 'ahoiAshtami'],
  ['2026-11-06', 'dhanteras'],
  ['2026-11-07', 'narakChaturdashi'],
  ['2026-11-08', 'diwali'],
  ['2026-11-10', 'govardhanPuja'],
  ['2026-11-11', 'bhaiDooj'],
  ['2026-11-15', 'chhathPuja'],
  ['2026-11-20', 'devUthaniEkadashi'],
  ['2026-11-24', 'kartikPurnima'],
  ['2026-12-14', 'vivahPanchami'],
  ['2026-12-20', 'gitaJayanti'],
  // 2027
  ['2027-01-15', 'makarSankranti'],
  ['2027-02-11', 'basantPanchami'],
  ['2027-03-06', 'mahaShivratri'],
  ['2027-03-21', 'holikaDahan'],
  ['2027-03-22', 'holi'],
  ['2027-04-15', 'ramNavami'],
  ['2027-04-20', 'hanumanJayanti'],
  ['2027-05-09', 'akshayaTritiya'],
  ['2027-06-04', 'vatSavitri'],
  ['2027-07-18', 'guruPurnima'],
  ['2027-08-04', 'hariyaliTeej'],
  ['2027-08-06', 'nagPanchami'],
  ['2027-08-17', 'rakshaBandhan'],
  ['2027-08-25', 'janmashtami'],
  ['2027-09-03', 'hartalikaTeej'],
  ['2027-09-04', 'ganeshChaturthi'],
  ['2027-10-09', 'dussehra'],
  ['2027-10-14', 'sharadPurnima'],
  ['2027-10-18', 'karvaChauth'],
  ['2027-10-22', 'ahoiAshtami'],
  ['2027-10-27', 'dhanteras'],
  ['2027-10-28', 'narakChaturdashi'],
  ['2027-10-29', 'diwali'],
  ['2027-10-30', 'govardhanPuja'],
  ['2027-10-31', 'bhaiDooj'],
  ['2027-11-04', 'chhathPuja'],
  ['2027-11-10', 'devUthaniEkadashi'],
  ['2027-11-14', 'kartikPurnima'],
  ['2027-12-03', 'vivahPanchami'],
  ['2027-12-09', 'gitaJayanti'],
];

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
  ...FESTIVAL_DAYS.map(([date, key]) => ({ date, ...FESTIVALS[key] })),
  // 2027's Navratris: each day is that day's form of Durga
  // (lib/devotional-calendar.js). Chaitra Navratri's ninth day is Ram Navami,
  // which takes the day, so the range stops at the eighth.
  { date: '2027-04-07', endDate: '2027-04-14', name: 'Chaitra Navratri', genre: 'devotional', visual: 'Goddess Durga on her lion, a kalash with sprouting barley, nine days of worship in spring', hashtag: '#ChaitraNavratri', before: 0, after: 0 },
  { date: '2027-09-30', endDate: '2027-10-08', name: 'Navratri', genre: 'devotional', visual: 'Goddess Durga, garba dancers, nine nights of worship', hashtag: '#Navratri', before: 0, after: 0 },

  // -- Islamic --
  { date: '2026-03-20', endDate: '2026-03-22', name: 'Eid al-Fitr', genre: 'devotional', visual: 'a crescent moon, lantern-lit streets, a festive family meal', hashtag: '#EidAlFitr', before: 1, after: 0 },
  { date: '2026-05-28', name: 'Eid al-Adha', genre: 'devotional', visual: 'a crescent moon, festive gathering, generosity and sacrifice', hashtag: '#EidAlAdha', before: 1, after: 0 },
  { date: '2027-03-10', name: 'Eid al-Fitr', genre: 'devotional', visual: 'a crescent moon, lantern-lit streets, a festive family meal', hashtag: '#EidAlFitr', before: 1, after: 0 },
  { date: '2027-05-17', name: 'Eid al-Adha', genre: 'devotional', visual: 'a crescent moon, festive gathering, generosity and sacrifice', hashtag: '#EidAlAdha', before: 1, after: 0 },

  // -- Christian --
  { date: '2026-12-25', name: 'Christmas', genre: 'devotional', visual: 'a candlelit Christmas tree, snow, warm nativity imagery', hashtag: '#Christmas', before: 2, after: 0 },
  { date: '2027-12-25', name: 'Christmas', genre: 'devotional', visual: 'a candlelit Christmas tree, snow, warm nativity imagery', hashtag: '#Christmas', before: 2, after: 0 },

  // -- Secular / national (India) --
  { date: '2026-01-01', name: 'New Year', genre: 'motivation', visual: 'fireworks at midnight, a fresh sunrise, new beginnings', hashtag: '#NewYear', before: 1, after: 0 },
  { date: '2026-01-26', name: 'Republic Day', genre: 'motivation', visual: 'the Indian tricolor flag, a patriotic parade', hashtag: '#RepublicDay', before: 1, after: 0 },
  { date: '2026-08-15', name: 'Independence Day', genre: 'motivation', visual: 'the Indian tricolor flag, the spirit of freedom', hashtag: '#IndependenceDay', before: 1, after: 0 },
  { date: '2026-10-02', name: 'Gandhi Jayanti', genre: 'motivation', visual: 'quiet simplicity, a spinning charkha wheel, peace', hashtag: '#GandhiJayanti', before: 1, after: 0 },
  { date: '2027-01-01', name: 'New Year', genre: 'motivation', visual: 'fireworks at midnight, a fresh sunrise, new beginnings', hashtag: '#NewYear', before: 1, after: 0 },
  { date: '2027-01-26', name: 'Republic Day', genre: 'motivation', visual: 'the Indian tricolor flag, a patriotic parade', hashtag: '#RepublicDay', before: 1, after: 0 },
  { date: '2027-08-15', name: 'Independence Day', genre: 'motivation', visual: 'the Indian tricolor flag, the spirit of freedom', hashtag: '#IndependenceDay', before: 1, after: 0 },
  // Gandhi Jayanti 2027 (2 October) falls inside Navratri, which keeps the day.
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
    if (days === 1) return `tomorrow is ${occasion.name}`;
    return `${occasion.name} is coming up in ${days} days`;
  }
  if (dateStr > peakEnd) {
    const days = daysBetween(peakEnd, dateStr);
    return `it has been ${days} day${days === 1 ? '' : 's'} since ${occasion.name}`;
  }
  return `today is ${occasion.name}`;
}

module.exports = { getOccasion, occasionPhrase, OCCASIONS };
