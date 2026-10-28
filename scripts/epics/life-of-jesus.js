/**
 * The Life of Jesus as a fixed series of ~15-minute English episodes, told
 * in order from the four Gospels by epic-episode.js (Tue/Thu/Sat,
 * .github/workflows/life-of-jesus.yml), on its own YouTube channel.
 *
 * Not a StoryByte series (`storybyte: false`): no app link, channels or
 * StoryByte mark, not in the app or on the website, no Facebook or Telegram.
 *
 * As in ramayan.js, each episode lists exactly the events it tells, in the
 * cast's English names (which decide who may appear). "Mother Mary", "Mary
 * Magdalene" and "Mary of Bethany", and "John the Baptist" and "Apostle
 * John", are kept apart by name so each is drawn as themselves.
 */
module.exports = {
  key: 'life-of-jesus',
  // The series folder (public/episodes/life-of-jesus) is named from this.
  title: 'Life of Jesus',
  name: 'Life of Jesus',
  seriesName: 'The Life of Jesus',
  language: 'en',
  genre: 'bible story',
  // A deep, calm male narrator (edge-tts); the backup voices follow it.
  voice: 'en-US-ChristopherNeural',
  style: 'realistic',
  artStyle: 'photorealistic cinematic film still from a big-budget biblical epic set in first-century Judea and ' +
    'Galilee, lifelike faces and natural skin texture, period-accurate robes, stone villages and desert hills, warm ' +
    'natural light, shallow depth of field, highly detailed, widescreen 16:9 composition, no text, no words',
  source: 'the four Gospels of the Bible (Matthew, Mark, Luke and John), and the Acts of the Apostles for the last ' +
    'episode. Keep to what the Gospels say and quote Jesus\'s words closely',
  closing: 'God bless you.',
  schedule: 'every Tuesday, Thursday and Saturday',
  playlistTitle: 'The Life of Jesus — The Full Story, Episode by Episode',
  playlistDescription: 'The life of Jesus from the four Gospels, told in order: from the angel\'s message to Mary to ' +
    'the resurrection. A new episode every Tuesday, Thursday and Saturday.',
  storybyte: false,
  words: {
    episode: 'Episode', previous: '⏪ Previous episode', next: '⏩ Next episode', chapters: '⏱️ Chapters',
    subscribe: '🙏 Subscribe to follow the whole life of Jesus, episode by episode',
  },
  videoTitle: (n, title) => `${title} | The Life of Jesus, Episode ${n}`,
  hashtags: ['#Jesus', '#LifeOfJesus', '#BibleStory', '#Gospel', '#JesusChrist'],
  tags: ['life of jesus', 'jesus story', 'story of jesus', 'jesus christ', 'bible story', 'bible stories',
    'gospel story', 'new testament', 'jesus full story', 'bible audio story'],
  setting: 'First-century Judea and Galilee under Roman rule: the village of Nazareth, Bethlehem, the shores and ' +
    'fishing boats of the Sea of Galilee, the Jordan river, the desert wilderness and Jerusalem with its great temple.',

  cast: [
    { name: 'Jesus', role: 'the Son of God, the Messiah',
      look: 'Jesus: a man of about thirty with a gentle, compassionate face, warm olive skin, shoulder-length dark brown hair and a short beard, kind dark eyes, a simple off-white linen robe with a deep red mantle over one shoulder, sandals' },
    { name: 'Mother Mary', role: 'the mother of Jesus',
      look: 'Mother Mary: a young Jewish woman with a gentle, serene face and olive skin, a light blue head covering over a simple cream robe' },
    { name: 'Joseph', role: 'Mary\'s husband, a carpenter of Nazareth',
      look: 'Joseph: a humble, strong carpenter in his thirties with a dark beard, olive skin and a brown woollen robe' },
    { name: 'Gabriel', role: 'the angel of the Lord',
      look: 'the angel Gabriel: a radiant angelic figure in shining white robes with great white wings, surrounded by soft light' },
    { name: 'Elizabeth', role: 'Mary\'s relative, mother of John the Baptist',
      look: 'Elizabeth: an elderly Jewish woman with a kind face in a beige robe and head covering' },
    { name: 'Zechariah', role: 'a priest, father of John the Baptist',
      look: 'Zechariah: an elderly priest with a white beard in white priestly robes' },
    { name: 'John the Baptist', role: 'the prophet who prepares the way',
      look: 'John the Baptist: a lean, intense prophet with long wild dark hair and a beard, a rough camel-hair garment and a leather belt' },
    { name: 'King Herod', role: 'Herod the Great, king of Judea',
      look: 'King Herod: an old, suspicious king with a grey beard, a gold crown and rich purple robes' },
    { name: 'Herod Antipas', role: 'ruler of Galilee, son of Herod the Great',
      look: 'Herod Antipas: a middle-aged ruler with a trimmed beard, a gold circlet and luxurious robes' },
    { name: 'Herodias', role: 'wife of Herod Antipas',
      look: 'Herodias: a proud royal woman in rich crimson robes and gold jewellery' },
    { name: 'Simeon', role: 'the old, devout man in the temple',
      look: 'Simeon: a very old, devout man with a long white beard and a white robe' },
    { name: 'Satan', role: 'the tempter',
      look: 'Satan: a shadowy tempter, a tall cloaked figure in darkness whose face is never seen' },
    { name: 'Peter', role: 'Simon Peter, a fisherman, the leading disciple',
      look: 'Peter: a sturdy fisherman in his thirties with curly greying dark hair, a thick beard and a brown tunic' },
    { name: 'Andrew', role: 'Peter\'s brother, a fisherman and disciple',
      look: 'Andrew: a lean fisherman with dark hair and a short beard in a grey tunic' },
    { name: 'James', role: 'son of Zebedee, a fisherman and disciple',
      look: 'James: a strong young fisherman with dark hair and a beard in a dark blue tunic' },
    { name: 'Apostle John', role: 'son of Zebedee, the youngest disciple, "the disciple Jesus loved"',
      look: 'Apostle John: a young man in his early twenties with wavy dark hair, barely a beard, in a green tunic' },
    { name: 'Philip', role: 'a disciple from Bethsaida',
      look: 'Philip: a thoughtful young man with short dark hair and a short beard in a tan tunic' },
    { name: 'Nathanael', role: 'a disciple',
      look: 'Nathanael: a young man with a neat beard in a light grey robe' },
    { name: 'Matthew', role: 'a tax collector who becomes a disciple',
      look: 'Matthew: a neatly dressed man with a trimmed beard in a fine blue robe' },
    { name: 'Thomas', role: 'a disciple',
      look: 'Thomas: a serious young man with dark hair and a short beard in a brown robe' },
    { name: 'Judas', role: 'Judas Iscariot, the disciple who betrays Jesus',
      look: 'Judas Iscariot: a man with a dark beard, a guarded face and a dark red robe, a money bag at his belt' },
    { name: 'Nicodemus', role: 'a Pharisee and member of the council',
      look: 'Nicodemus: an older Pharisee with a grey beard in fine blue and white robes with a prayer shawl' },
    { name: 'Mary Magdalene', role: 'a devoted follower of Jesus',
      look: 'Mary Magdalene: a woman in her late twenties with long dark hair under a deep red head covering' },
    { name: 'Martha', role: 'sister of Lazarus in Bethany',
      look: 'Martha: a busy, warm woman in her thirties in a brown robe and head covering' },
    { name: 'Mary of Bethany', role: 'sister of Martha and Lazarus',
      look: 'Mary of Bethany: a quiet young woman with long dark hair in a soft green robe' },
    { name: 'Lazarus', role: 'Jesus\'s friend in Bethany',
      look: 'Lazarus: a man in his thirties with a short beard in a plain white robe' },
    { name: 'Jairus', role: 'a synagogue leader',
      look: 'Jairus: a respectable middle-aged man with a beard in a dark robe and prayer shawl' },
    { name: 'Zacchaeus', role: 'a rich, short tax collector of Jericho',
      look: 'Zacchaeus: a short man with a round face and a trimmed beard in an expensive purple robe' },
    { name: 'Bartimaeus', role: 'a blind beggar of Jericho',
      look: 'Bartimaeus: a thin blind beggar in a worn cloak sitting by the roadside' },
    { name: 'Moses', role: 'the great prophet of old',
      look: 'Moses: a radiant old prophet with a long white beard and white robes, glowing with light' },
    { name: 'Elijah', role: 'the prophet of old',
      look: 'Elijah: a radiant old prophet with a long grey beard and a rough mantle, glowing with light' },
    { name: 'Caiaphas', role: 'the high priest',
      look: 'Caiaphas: a stern high priest with a black beard, a tall turban and an ornate breastplate over blue robes' },
    { name: 'Pilate', role: 'Pontius Pilate, the Roman governor',
      look: 'Pontius Pilate: a Roman governor, clean-shaven with short grey hair, a white toga with a purple border' },
    { name: 'Barabbas', role: 'a prisoner',
      look: 'Barabbas: a rough, bearded prisoner in chains and torn clothes' },
    { name: 'Simon of Cyrene', role: 'the man made to carry the cross',
      look: 'Simon of Cyrene: a strong man with dark skin and a short beard in a simple traveller\'s robe' },
    { name: 'Joseph of Arimathea', role: 'a rich council member and secret disciple',
      look: 'Joseph of Arimathea: a dignified older man with a grey beard in rich dark robes' },
  ],

  episodes: [
    // ── Birth and childhood ────────────────────────────────────────────────
    { kand: 'Birth and Childhood', title: 'The Angel\'s Message to Mary',
      events: 'In the temple the angel Gabriel tells the old priest Zechariah that his wife Elizabeth will have a son, ' +
        'John; Zechariah doubts and is struck mute. Six months later Gabriel comes to Mother Mary, a young woman of ' +
        'Nazareth engaged to Joseph, and tells her she will bear the Son of God, named Jesus; Mary answers "I am the ' +
        'Lord\'s servant". Mary visits Elizabeth, whose baby leaps for joy, and sings her song of praise (the ' +
        'Magnificat). John the Baptist is born, and Zechariah speaks again. Ends as Joseph learns that Mary is with child.' },
    { kand: 'Birth and Childhood', title: 'The Birth of Jesus in Bethlehem',
      events: 'Joseph, troubled, plans to quietly end the engagement, but an angel tells him in a dream to take Mary as ' +
        'his wife. Caesar Augustus orders a census, and Joseph and Mother Mary travel from Nazareth to Bethlehem. There ' +
        'is no room at the inn, and Jesus is born and laid in a manger. Ends as an angel appears to shepherds in the ' +
        'fields at night.' },
    { kand: 'Birth and Childhood', title: 'The Shepherds and the Wise Men',
      events: 'The angel announces good news of great joy, a host of angels sings "Glory to God in the highest", and the ' +
        'shepherds find the baby in the manger. Joseph and Mother Mary present Jesus at the temple, where the old Simeon ' +
        'takes him in his arms and praises God. Wise men from the east follow a star to Jerusalem and ask King Herod ' +
        'where the new king is born; Herod, troubled, sends them to Bethlehem. They find Jesus and give gold, ' +
        'frankincense and myrrh, and are warned in a dream not to return to Herod. Ends as an angel warns Joseph in a dream.' },
    { kand: 'Birth and Childhood', title: 'The Escape to Egypt and the Boy in the Temple',
      events: 'Joseph takes Mother Mary and Jesus by night to Egypt. King Herod, furious, orders the killing of the young ' +
        'boys of Bethlehem (told with restraint). After Herod dies, an angel tells Joseph to return, and the family ' +
        'settles in Nazareth. At twelve Jesus goes to Jerusalem for Passover; on the way home his parents find him ' +
        'missing and search for three days, finding him in the temple amazing the teachers: "Didn\'t you know I had to ' +
        'be in my Father\'s house?" Ends with Jesus growing in wisdom and stature as the years pass.' },

    // ── The ministry begins ────────────────────────────────────────────────
    { kand: 'The Ministry Begins', title: 'John the Baptist and the Baptism of Jesus',
      events: 'John the Baptist preaches in the wilderness by the Jordan: "Repent, for the kingdom of heaven is near", ' +
        'baptizing crowds and saying one far greater is coming. Jesus, about thirty, comes to be baptized; John protests ' +
        'but obeys. As Jesus comes up from the water, heaven opens, the Spirit descends like a dove, and a voice says ' +
        '"This is my beloved Son, with whom I am well pleased". Ends as the Spirit leads Jesus into the wilderness.' },
    { kand: 'The Ministry Begins', title: 'Jesus Tempted in the Wilderness',
      events: 'Jesus fasts forty days and nights in the desert. Satan tempts him three times: to turn stones into bread, ' +
        'to throw himself from the top of the temple, and to bow down in exchange for all the kingdoms of the world; ' +
        'each time Jesus answers with scripture, "It is written". Satan leaves and angels attend him. Ends as Jesus ' +
        'returns, and John the Baptist points to him: "Look, the Lamb of God".' },
    { kand: 'The Ministry Begins', title: 'The First Disciples',
      events: 'Andrew and another disciple follow Jesus and spend the day with him; Andrew brings his brother Simon, ' +
        'whom Jesus names Peter. Philip follows, and brings Nathanael, who doubts until Jesus tells him he saw him under ' +
        'the fig tree. By the Sea of Galilee, after a night of catching nothing, Peter lets down his nets at Jesus\'s word ' +
        'and the nets break with fish; Jesus calls Peter, Andrew, James and Apostle John: "Follow me, and I will make you ' +
        'fishers of men", and they leave their boats. Ends with an invitation to a wedding in Cana.' },
    { kand: 'The Ministry Begins', title: 'Jesus Turns Water into Wine',
      events: 'At a wedding in Cana the wine runs out; Mother Mary tells the servants "Do whatever he tells you", and Jesus ' +
        'turns six stone jars of water into the finest wine, his first sign, and his disciples believe. At Passover in ' +
        'Jerusalem he drives the money changers out of the temple: "Do not make my Father\'s house a market". Ends as ' +
        'Nicodemus, a Pharisee, comes to Jesus secretly by night.' },
    { kand: 'The Ministry Begins', title: 'Nicodemus and the Woman at the Well',
      events: 'Jesus tells Nicodemus that no one can see the kingdom of God unless born again, and that "God so loved the ' +
        'world that he gave his only Son". Passing through Samaria, Jesus rests at Jacob\'s well and asks a Samaritan ' +
        'woman for water; he offers her living water, tells her everything she has done and reveals that he is the ' +
        'Messiah. She runs to tell her town, and many believe. Ends as Jesus returns to Galilee, where a royal official ' +
        'begs him to heal his dying son.' },
    { kand: 'The Ministry Begins', title: 'Rejected in Nazareth',
      events: 'Jesus tells the official "Go, your son will live", and the boy is healed at that very hour. In the ' +
        'synagogue of Nazareth Jesus reads from the scroll of Isaiah, "The Spirit of the Lord is upon me", and says it ' +
        'is fulfilled today; his own townspeople are enraged and try to throw him off a cliff, but he walks through ' +
        'them. In Capernaum he heals Peter\'s mother-in-law, and at sunset the whole town brings its sick to the door. ' +
        'Ends as a man with leprosy kneels before him.' },

    // ── Ministry in Galilee ────────────────────────────────────────────────
    { kand: 'Ministry in Galilee', title: 'The Leper and the Man Through the Roof',
      events: 'The leper says "If you are willing, you can make me clean"; Jesus touches him: "I am willing. Be clean", ' +
        'and he is healed. In a packed house in Capernaum, four friends lower a paralysed man through the roof; Jesus ' +
        'says "Your sins are forgiven", the teachers of the law are offended, and Jesus tells the man to take up his mat ' +
        'and walk, and he does. Ends as Jesus sees Matthew sitting at his tax booth.' },
    { kand: 'Ministry in Galilee', title: 'Matthew Called and the Twelve Chosen',
      events: 'Jesus says "Follow me" and Matthew leaves his tax booth and holds a feast with tax collectors and sinners; ' +
        'when the Pharisees object, Jesus says he came to call sinners, not the righteous. On the Sabbath he heals a ' +
        'man\'s withered hand in the synagogue, and the Pharisees begin to plot against him. He prays all night on a ' +
        'mountain and chooses twelve apostles, among them Peter, Andrew, James, Apostle John, Philip, Matthew, Thomas ' +
        'and Judas. Ends as great crowds gather on the mountainside.' },
    { kand: 'Ministry in Galilee', title: 'The Sermon on the Mount',
      events: 'Jesus sits on the mountain and teaches: the Beatitudes ("Blessed are the poor in spirit… blessed are the ' +
        'peacemakers"), "You are the salt of the earth… the light of the world", "Love your enemies and pray for those ' +
        'who persecute you", "Turn the other cheek", and giving and praying in secret. Ends as he teaches them how to pray.' },
    { kand: 'Ministry in Galilee', title: 'The Lord\'s Prayer and the House on the Rock',
      events: 'Jesus teaches the Lord\'s Prayer, "Our Father in heaven". He tells them not to worry: look at the birds of ' +
        'the air and the lilies of the field; seek first the kingdom of God. "Ask and it will be given to you; seek and ' +
        'you will find; knock and the door will be opened." The golden rule, and the wise man who built his house on the ' +
        'rock and the foolish man who built on sand. Ends as a Roman centurion sends word that his servant is dying.' },
    { kand: 'Ministry in Galilee', title: 'The Centurion\'s Faith and the Widow\'s Son',
      events: 'The centurion says "Lord, just say the word, and my servant will be healed", and Jesus marvels at his faith ' +
        'and heals the servant. At the town of Nain Jesus meets the funeral of a widow\'s only son, tells her "Do not ' +
        'weep", touches the coffin, and the young man sits up. John the Baptist, in Herod Antipas\'s prison, sends his ' +
        'disciples to ask "Are you the one who is to come?", and Jesus answers with what they have seen. Ends as Jesus ' +
        'dines at the house of Simon the Pharisee.' },
    { kand: 'Ministry in Galilee', title: 'The Woman Who Anointed His Feet',
      events: 'A sinful woman weeps at Jesus\'s feet, wipes them with her hair and anoints them with perfume; Simon the ' +
        'Pharisee judges her, and Jesus tells the parable of the two debtors: "Her many sins are forgiven, for she loved ' +
        'much". Women follow and support Jesus, among them Mary Magdalene, freed of seven demons. By the lake Jesus ' +
        'teaches from a boat in parables: the sower and the seed, and the mustard seed. Ends at evening as they set out ' +
        'in a boat across the Sea of Galilee.' },
    { kand: 'Ministry in Galilee', title: 'Jesus Calms the Storm',
      events: 'A furious storm sweeps the lake while Jesus sleeps in the boat; the terrified disciples wake him, and he ' +
        'rebukes the wind: "Peace, be still", and there is a great calm. "Who is this? Even the wind and the waves obey ' +
        'him." On the other shore a man possessed by many demons, "Legion", lives among the tombs; Jesus drives them into ' +
        'a herd of pigs, and the man sits clothed and in his right mind. Ends as Jairus, a synagogue leader, falls at ' +
        'Jesus\'s feet.' },
    { kand: 'Ministry in Galilee', title: 'Jairus\'s Daughter',
      events: 'Jairus begs Jesus to come to his dying twelve-year-old daughter. In the crowd a woman who has bled for ' +
        'twelve years touches the edge of his cloak and is healed; Jesus stops: "Daughter, your faith has healed you". ' +
        'Word comes that the girl has died; Jesus says "Don\'t be afraid; just believe", takes her hand: "Little girl, ' +
        'get up", and she rises. Ends as Jesus sends out the twelve disciples two by two.' },
    { kand: 'Ministry in Galilee', title: 'The Death of John the Baptist',
      events: 'The disciples go out preaching and healing. Herod Antipas had imprisoned John the Baptist for condemning his ' +
        'marriage to Herodias. At Herod\'s birthday feast the daughter of Herodias dances, Herod promises her anything, ' +
        'and at her mother\'s urging she asks for John\'s head; Herod, unwilling but bound by his oath, has John ' +
        'executed (told with restraint). John\'s disciples bury him and tell Jesus, who withdraws by boat to a quiet ' +
        'place. Ends as a crowd of thousands follows him on foot.' },
    { kand: 'Ministry in Galilee', title: 'Feeding the Five Thousand',
      events: 'Jesus has compassion on the crowd and teaches and heals them. In the evening the disciples want to send ' +
        'them away; Andrew finds a boy with five loaves and two fish. Jesus gives thanks, breaks the bread, and five ' +
        'thousand men, besides women and children, eat and are satisfied, with twelve baskets left over. The crowd wants ' +
        'to make him king by force, and he withdraws to the mountain alone. Ends as the disciples row across the lake ' +
        'at night against the wind.' },
    { kand: 'Ministry in Galilee', title: 'Jesus Walks on Water',
      events: 'In the night Jesus comes to the disciples walking on the water; they cry out in fear, and he says "Take ' +
        'courage, it is I". Peter steps out of the boat and walks toward him, sees the wind, begins to sink and cries ' +
        '"Lord, save me"; Jesus catches him: "You of little faith, why did you doubt?" Next day Jesus says "I am the ' +
        'bread of life"; many followers leave, and Peter says "Lord, to whom shall we go? You have the words of eternal ' +
        'life". Ends as Jesus asks his disciples "Who do you say I am?"' },
    { kand: 'Ministry in Galilee', title: 'Peter\'s Confession and the Transfiguration',
      events: 'Peter answers "You are the Messiah, the Son of the living God", and Jesus calls him the rock on which he will ' +
        'build his church. Jesus foretells his suffering, death and rising; Peter protests, and Jesus rebukes him. Six ' +
        'days later Jesus takes Peter, James and Apostle John up a high mountain; his face shines like the sun, Moses and ' +
        'Elijah appear talking with him, and a voice from a cloud says "This is my Son, whom I love. Listen to him!" ' +
        'Ends as they come down to a desperate father pleading for his son.' },
    { kand: 'Ministry in Galilee', title: 'Faith Like a Mustard Seed',
      events: 'The father\'s son is tormented by a spirit the disciples could not drive out; the father cries "I believe; ' +
        'help my unbelief!", and Jesus heals the boy, teaching that faith as small as a mustard seed can move mountains. ' +
        'The disciples argue about who is greatest, and Jesus sets a little child among them. Peter asks how often to ' +
        'forgive, and Jesus says seventy times seven and tells the parable of the unforgiving servant. Ends as an expert ' +
        'in the law asks Jesus "Who is my neighbour?"' },

    // ── The road to Jerusalem ──────────────────────────────────────────────
    { kand: 'The Road to Jerusalem', title: 'The Good Samaritan',
      events: 'Jesus tells the parable of the Good Samaritan: a man beaten by robbers, the priest and the Levite who pass ' +
        'by, and the Samaritan who cares for him; "Go and do likewise". At the home of Martha and Mary of Bethany, Martha ' +
        'is busy serving while Mary of Bethany sits at Jesus\'s feet, and Jesus says Mary has chosen what is better. ' +
        'Ends as Jesus sees a man who has been blind from birth.' },
    { kand: 'The Road to Jerusalem', title: 'The Man Born Blind',
      events: 'The disciples ask whose sin caused the blindness, and Jesus says neither, but so the works of God may be ' +
        'shown: "I am the light of the world". He makes mud, puts it on the man\'s eyes and sends him to wash in the ' +
        'pool of Siloam, and he sees. The Pharisees question the man and his parents and throw him out: "One thing I ' +
        'know: I was blind, but now I see". Jesus says "I am the good shepherd; the good shepherd lays down his life for ' +
        'the sheep". Ends as the Pharisees grumble that Jesus welcomes sinners and eats with them.' },
    { kand: 'The Road to Jerusalem', title: 'The Lost Sheep and the Prodigal Son',
      events: 'Jesus answers with three parables: the shepherd who leaves ninety-nine sheep to find the one that is lost, ' +
        'the woman who searches for her lost coin, and the prodigal son, told in full: the younger son who wastes his ' +
        'inheritance, comes to his senses among the pigs and returns home, the father who runs to embrace him and holds ' +
        'a feast, and the angry elder brother. Ends as word comes that Lazarus of Bethany is sick.' },
    { kand: 'The Road to Jerusalem', title: 'Lazarus, Come Out!',
      events: 'Jesus waits two days, then goes to Bethany; Lazarus has been in the tomb four days. Martha meets him, and ' +
        'Jesus says "I am the resurrection and the life"; Mary of Bethany weeps at his feet, and Jesus weeps. At the tomb ' +
        'he has the stone rolled away, prays, and calls "Lazarus, come out!", and Lazarus walks out wrapped in grave ' +
        'clothes. Many believe, and the high priest Caiaphas and the council plot to kill Jesus. Ends as Jesus sets his ' +
        'face toward Jerusalem.' },
    { kand: 'The Road to Jerusalem', title: 'The Children, the Rich Young Man and Zacchaeus',
      events: 'The disciples turn away children, and Jesus says "Let the little children come to me". A rich young man ' +
        'asks how to inherit eternal life and goes away sad when told to sell everything and follow Jesus: "It is easier ' +
        'for a camel to go through the eye of a needle". Near Jericho the blind Bartimaeus shouts "Son of David, have ' +
        'mercy on me!" and receives his sight. In Jericho the short tax collector Zacchaeus climbs a sycamore tree; Jesus ' +
        'stays at his house, and Zacchaeus gives half his wealth to the poor. Ends as Jesus arrives at Bethany six days ' +
        'before Passover.' },

    // ── Passion week ───────────────────────────────────────────────────────
    { kand: 'Passion Week', title: 'Palm Sunday: Jesus Enters Jerusalem',
      events: 'At a dinner in Bethany Mary of Bethany anoints Jesus\'s feet with costly perfume; Judas objects, and Jesus ' +
        'says she has prepared him for burial. Jesus rides into Jerusalem on a donkey, the crowds spread cloaks and palm ' +
        'branches and shout "Hosanna! Blessed is he who comes in the name of the Lord!" He weeps over Jerusalem, and ' +
        'drives the money changers out of the temple again. Ends as the chief priests look for a way to kill him.' },
    { kand: 'Passion Week', title: 'Questions in the Temple',
      events: 'In the temple the leaders try to trap Jesus: asked about paying taxes, he says "Give back to Caesar what is ' +
        'Caesar\'s, and to God what is God\'s"; asked for the greatest commandment, he answers to love God with all your ' +
        'heart and your neighbour as yourself. He praises a poor widow who gives two small coins, all she has. On the ' +
        'Mount of Olives he foretells the temple\'s destruction. Ends as Judas goes to the chief priests and agrees to ' +
        'betray Jesus for thirty pieces of silver.' },
    { kand: 'Passion Week', title: 'The Last Supper',
      events: 'In an upper room Jesus washes his disciples\' feet; Peter protests, then asks to be washed all over. At the ' +
        'Passover meal Jesus says "One of you will betray me", and gives the bread to Judas, who goes out into the night. ' +
        'Jesus breaks the bread, "This is my body", and shares the cup, "This is my blood of the covenant"; he gives a ' +
        'new commandment, "Love one another as I have loved you", and tells Peter he will deny him three times before the ' +
        'rooster crows. Ends as they sing a hymn and go out to the Mount of Olives.' },
    { kand: 'Passion Week', title: 'The Garden of Gethsemane',
      events: 'In Gethsemane Jesus takes Peter, James and Apostle John aside and prays in anguish, "Father, if you are ' +
        'willing, take this cup from me; yet not my will, but yours be done", while the disciples fall asleep. Judas ' +
        'arrives with soldiers and torches and betrays Jesus with a kiss. Peter cuts off the ear of the high priest\'s ' +
        'servant, and Jesus heals it: "Put your sword away". The disciples flee. Ends as Jesus is led bound to the house ' +
        'of Caiaphas.' },
    { kand: 'Passion Week', title: 'The Trial and Peter\'s Denial',
      events: 'Before Caiaphas and the council false witnesses accuse Jesus; asked if he is the Messiah, the Son of God, ' +
        'he answers "I am", and they condemn him. In the courtyard Peter is recognised three times and denies knowing ' +
        'Jesus; the rooster crows, Jesus turns and looks at him, and Peter goes out and weeps bitterly. Judas, filled ' +
        'with remorse, throws the silver into the temple. Ends at dawn as Jesus is taken to the Roman governor Pilate.' },
    { kand: 'Passion Week', title: 'Jesus Before Pilate',
      events: 'Pilate questions Jesus, "Are you the king of the Jews?"; Jesus says his kingdom is not of this world, and ' +
        'Pilate asks "What is truth?" and finds no fault in him. Pilate\'s wife warns him of a dream. Pilate offers to ' +
        'release Jesus or Barabbas, and the crowd shouts for Barabbas and "Crucify him!" Pilate washes his hands before ' +
        'the crowd and hands Jesus over; soldiers flog him, put a crown of thorns on his head and mock him (told with ' +
        'restraint). Ends as Jesus carries his cross out of the city.' },
    { kand: 'Passion Week', title: 'The Crucifixion',
      events: 'Simon of Cyrene is made to carry the cross. At Golgotha Jesus is crucified between two criminals (told with ' +
        'reverence and restraint) and prays "Father, forgive them, for they do not know what they are doing". He promises ' +
        'the repentant criminal "Today you will be with me in paradise", and entrusts Mother Mary to Apostle John. ' +
        'Darkness covers the land; Jesus cries out and says "It is finished" and dies; the temple curtain tears in two, ' +
        'and the centurion says "Surely this was the Son of God". Ends as Joseph of Arimathea asks Pilate for the body.' },
    { kand: 'Passion Week', title: 'The Burial',
      events: 'Joseph of Arimathea and Nicodemus take Jesus\'s body down, wrap it in linen with spices and lay it in a new ' +
        'tomb cut in the rock, and a great stone is rolled across the entrance, while Mary Magdalene and Mother Mary ' +
        'watch. The chief priests have Pilate seal the tomb and post guards. The disciples hide in grief and fear through ' +
        'the Sabbath. Ends before dawn on the first day of the week, as the women set out for the tomb with spices.' },

    // ── Resurrection ───────────────────────────────────────────────────────
    { kand: 'Resurrection', title: 'He Is Risen',
      events: 'The women find the stone rolled away and an angel says "He is not here; he has risen!" Peter and Apostle John ' +
        'run to the tomb and find only the linen. Mary Magdalene weeps in the garden; the risen Jesus speaks her name, ' +
        '"Mary", and she knows him. On the road to Emmaus two disciples walk with a stranger who explains the scriptures, ' +
        'and they recognise Jesus as he breaks the bread. Ends as Jesus stands among the disciples in the locked room.' },
    { kand: 'Resurrection', title: 'Thomas Believes and Breakfast by the Sea',
      events: 'Jesus says "Peace be with you" and shows the disciples his hands and side. Thomas, absent, refuses to ' +
        'believe; a week later Jesus invites him to touch his wounds, and Thomas cries "My Lord and my God!" By the Sea ' +
        'of Galilee the disciples catch nothing all night until Jesus on the shore tells them to cast the net, and it ' +
        'fills; Peter jumps into the water, and Jesus cooks them breakfast. Three times Jesus asks Peter "Do you love ' +
        'me?" and tells him "Feed my sheep". Ends as the disciples gather on the mountain in Galilee.' },
    { kand: 'Resurrection', title: 'The Ascension and Pentecost',
      events: 'Jesus gives the Great Commission, "Go and make disciples of all nations… and surely I am with you always, ' +
        'to the very end of the age". On the Mount of Olives he is taken up into heaven before their eyes, and two angels ' +
        'say he will return. At Pentecost the Holy Spirit comes on the disciples like wind and tongues of fire, Peter ' +
        'preaches to the crowds in Jerusalem, and three thousand are baptized. Ends the series with a blessing for every ' +
        'listener.' },
  ],
};
