# Channel identity, plan and growth

What the devotional channel stands for, the posting rhythm the pipeline
follows, and the text to paste into YouTube Studio, the Facebook Page and
the Instagram bio. Based on the channel's own analytics (`reports/social`):
devotional kathas, especially Bal Krishna and Hanuman, get 10–100× the views
of other stories, and Shorts under 3 minutes far outperform longer uploads.

## Identity

**Slogan**

> रोज़ सुबह एक पावन कथा — पूरी, सच्ची, सुंदर।

(Every morning, one sacred story: complete, faithful, beautiful.)

**Name.** Keep your current channel name. Renaming loses the recognition
you've built, and YouTube search already knows it. If you ever start fresh,
these fit the identity (check that nobody else uses them first):
`रोज़ एक कथा` · `कथा सागर` · `पावन कथाएँ` · `भक्ति कथा रोज़` · `वार कथा`.

**Audience.** Hindi-speaking devotional viewers in India. Most likely they're
families who keep a daily puja and watch in the morning, plus parents who
play Bal Krishna and Hanuman stories for their children. Check this against
**YouTube Studio → Analytics → Audience** (age, gender, when your viewers are
on YouTube) and adjust.

**What makes the channel different.** Most devotional channels post
clips, bhajans or long pravachans. Here, every day:

1. **That day's deity**: Monday Shiva, Tuesday Hanuman, Wednesday Ganesh,
   Thursday Vishnu, Friday Maa Durga and Lakshmi, Saturday Shani Dev, Sunday
   Krishna. Festivals and the nine days of Navratri take priority.
2. **One complete katha in under 3 minutes**, with a real ending and its lesson,
   never a cut-off clip.
3. **The deities drawn as tradition shows them**, with the right iconography
   and the same look every time.
4. **Tomorrow's katha announced at the end**, so watching becomes a daily
   ritual.

## Four content pillars

| Pillar | What | Format | Goal |
| --- | --- | --- | --- |
| वार की कथा | The weekday deity's katha | Daily Short | Views, subscribers, habit |
| पर्व-व्रत कथा | Festival and vrat kathas on the day | Daily Short (takes priority) | Trend and search spikes |
| बाल लीला | Bal Krishna, Bal Hanuman, Bal Ganesh | Within the daily rotation | The channel's best performers |
| रविवार की पूरी कथा | One katha told in full, ~15 minutes | Weekly long video | Search ranking, watch hours |

## Posting rhythm (automated)

| When (IST) | What | Where |
| --- | --- | --- |
| Every morning (~5:30–6:00) | The day's katha Short, ending with tomorrow's teaser; first comment asks a question and repeats the teaser | YouTube, Facebook, Instagram |
| Sunday ~10:30 | The week's long katha (Weekly Long Katha workflow), titled as people search: "हनुमान जी की कथा: …" | YouTube, Facebook |

**Shorts vs. search.** The daily Shorts are for reach: the Shorts feed
pushes them to new viewers. The Sunday long video is for search and watch
hours: it's titled with what people type ("<deity> की कथा"), has chapters and
a thumbnail, and keeps paying off for months. Over 90 days that gives
~90 Shorts that build the audience and 13 long kathas that build authority.
After the first month, look at which deities and kathas did best
(`reports/social/latest.json`) and use **Remake Short** to give the winners
a hand-finished version.

## Paste into YouTube Studio

**Customisation → Basic info → Description:**

```
🙏 रोज़ सुबह एक पावन कथा — पूरी, सच्ची, सुंदर।

हर दिन उस दिन के देवता की एक पूरी कथा, 3 मिनट से कम में:
सोमवार महादेव • मंगलवार हनुमान जी • बुधवार गणपति बप्पा • गुरुवार भगवान विष्णु
शुक्रवार माँ दुर्गा और माँ लक्ष्मी • शनिवार शनि देव • रविवार श्री कृष्ण
पर्व-त्योहार और नवरात्रि पर उस दिन की विशेष कथा।

📿 हर रविवार — एक कथा पूरी विस्तार से।
🔔 सब्सक्राइब करें और रोज़ सुबह की कथा न चूकें।

📱 सभी कथाएँ ऑडियो में, मुफ़्त — StoryByte ऐप:
https://play.google.com/store/apps/details?id=com.storybyte.app
```

**Banner text:** `रोज़ सुबह एक पावन कथा • हर रविवार पूरी कथा`

**Channel keywords** (Settings → Channel → Basic info):
`कथा, भक्ति कथा, पौराणिक कथा, हनुमान जी की कथा, शिव जी की कथा, श्री कृष्ण की कथा, गणेश जी की कथा, शनि देव की कथा, विष्णु भगवान की कथा, नवरात्रि कथा, bhakti, katha, hindi kahani`

**Instagram / Facebook bio:** `🙏 रोज़ सुबह एक पावन कथा | उस दिन के देवता की पूरी कथा | 📱 StoryByte ऐप ↓`

## WhatsApp Channel

For this audience, a WhatsApp Channel works the way an email list does
elsewhere: a direct line to your viewers that no feed algorithm controls.

1. WhatsApp → **Updates** → **+** → **New channel**. Name it like the channel, and use the slogan as its description.
2. Channel info → **Share** → copy the link (`https://whatsapp.com/channel/…`).
3. GitHub → this repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**: name `WHATSAPP_CHANNEL_URL`, value the link.

From the next run, every Short's description, Reel caption, Facebook post
and Sunday long video carries "💬 रोज़ नई कथा WhatsApp पर: …". Post each
day's Short to the Channel too, by hand: WhatsApp has no posting API for
Channels.

## Monetization

- **YouTube Partner Program.** Check the current requirements in YouTube
  Studio → Earn. Lately they've been, roughly: 1,000 subscribers plus 4,000
  long-video watch hours in a year, or 10 million Shorts views in 90 days.
  The Sunday long kathas exist to earn those watch hours.
- **Keep it authentic.** YouTube's policy on "inauthentic" (mass-produced,
  repetitive) content is the main risk for an automated channel. Ways to stay
  safe: give the best Shorts a human touch with **Remake Short**, vary the
  formats (daily, weekly long, festival specials), and reply to comments.
  Every upload is already marked as AI-generated where YouTube asks.
- **Beyond ads.** The StoryByte app (every description links to it); Super
  Thanks once eligible; the WhatsApp Channel as your own audience; later,
  festival-season sponsorships from puja-samagri and devotional brands. Pitch
  them with your monthly views and audience profile from Analytics.

## Getting viewers into the app

- **Every Short ends by naming the app.** After tomorrow's teaser, the
  narrator says "ऐसी सारी कथाएँ ऑडियो में, मुफ़्त — Play Store पर खोजें
  StoryByte", captioned like the rest. If that would make the Short too long,
  only the teaser is said.
- **Every app link is tagged with where it was posted** (`scripts/lib/app-link.js`):
  YouTube, Facebook and Instagram Shorts, the long videos, the story pages,
  and shares and invites from inside the app. See which ones bring installs
  in Play Console → **Statistics → Store listing acquisition**, filtered to
  UTM source / campaign.
- **The app asks for a rating after every finished story** until the
  listener rates: Google's in-app popup after the first, then a short prompt
  ("⭐ रेटिंग दें" opens the Play Store page, "दे दी है ✓" or rating stops
  it, "बाद में" asks again next time). Google never tells the app whether
  someone rated in its popup, which is why the "already rated" button exists.
