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
| पर्व-व्रत कथा | Festival and vrat kathas: the best-known one the afternoon before, a second on the day | Extra Short the day before + the day's Short | Trend and search spikes |
| बाल लीला | Bal Krishna, Bal Hanuman, Bal Ganesh | Within the daily rotation | The channel's best performers |
| रविवार की पूरी कथा | One katha told in full, ~15 minutes | Weekly long video | Search ranking, watch hours |

## Posting rhythm (automated)

| When (IST) | What | Where |
| --- | --- | --- |
| Every morning (~5:30–6:00) | The day's katha Short, ending with tomorrow's teaser; first comment asks a question and repeats the teaser | YouTube, Facebook, Instagram |
| Day before a festival, ~1–5 PM | The festival's best-known katha (e.g. Veeravati's करवा चौथ व्रत कथा), a day ahead of the searches; on the festival morning the daily Short is a second katha of it | YouTube, Facebook, Instagram |
| Sunday ~10:30 | The week's long katha (Weekly Long Katha workflow), titled as people search: "हनुमान जी की कथा: …". A festival that Sunday or in the week after takes it (the biggest one, if two) | YouTube, Facebook |

**Shorts vs. search.** The daily Shorts are for reach: the Shorts feed
pushes them to new viewers. The Sunday long video is for search and watch
hours: it's titled with what people type ("<deity> की कथा"), has chapters and
a thumbnail, and keeps paying off for months. Over 90 days that gives
~90 Shorts that build the audience and 13 long kathas that build authority.
After the first month, look at which deities and kathas did best
(`reports/social/latest.json`) and use **Remake Short** to give the winners
a hand-finished version.

**Festival calendar.** `scripts/occasions.js` defines each festival once
(`FESTIVALS`) with two kathas: `eveKatha` (the best-known, posted the
afternoon before by the 12:53 PM IST run of Daily Stories) and `katha` (the
festival morning), and dates it per year in `FESTIVAL_DAYS`. Navratri days
(`NAVRATRIS` in `scripts/lib/devotional-calendar.js`) tell that day's form of
Durga. October 2026 through December 2027 is covered; add 2028's dates
before January 2028, from a panchang (Drik Panchang), since lunar festivals
move every year. To post a festival-eve katha by hand: Actions → Daily
Stories → Run workflow → tick "Festival-eve run".

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

💬 रोज़ की कथा WhatsApp पर:
https://whatsapp.com/channel/0029VbEOIuxAojZ0Wgg11J2l
```

**Channel links** (Customisation → Basic info → Links): add the app
(`https://play.google.com/store/apps/details?id=com.storybyte.app`) and
the WhatsApp Channel. These show on the channel banner, where they can be
tapped, unlike links in Shorts comments.

**Banner text:** `रोज़ सुबह एक पावन कथा • हर रविवार पूरी कथा`

**Channel keywords** (Settings → Channel → Basic info):
`कथा, भक्ति कथा, पौराणिक कथा, हनुमान जी की कथा, शिव जी की कथा, श्री कृष्ण की कथा, गणेश जी की कथा, शनि देव की कथा, विष्णु भगवान की कथा, नवरात्रि कथा, bhakti, katha, hindi kahani`

**Instagram / Facebook bio:** `🙏 रोज़ सुबह एक पावन कथा | उस दिन के देवता की पूरी कथा | 📱 StoryByte ऐप ↓`

## WhatsApp Channel

For this audience, a WhatsApp Channel works the way an email list does
elsewhere: a direct line to your viewers that no feed algorithm controls.

**The channel:** `रोज़ एक कथा | StoryByte` —
https://whatsapp.com/channel/0029VbEOIuxAojZ0Wgg11J2l

The name carries the app's name, so viewers connect the channel, the Shorts
and the app. Description (as set on the channel):

```
🙏 रोज़ सुबह एक पावन कथा — पूरी, सच्ची, सुंदर।

सोमवार महादेव • मंगलवार हनुमान जी • बुधवार गणपति बप्पा • गुरुवार भगवान विष्णु • शुक्रवार माँ दुर्गा-लक्ष्मी • शनिवार शनि देव • रविवार श्री कृष्ण
पर्व-त्योहार पर उस दिन की विशेष व्रत कथा।

📱 सभी कथाएँ ऑडियो में, मुफ़्त — StoryByte ऐप:
https://play.google.com/store/apps/details?id=com.storybyte.app&referrer=utm_source%3Dwhatsapp%26utm_medium%3Dsocial%26utm_campaign%3Dchannel
```

The tagged Play Store link makes the channel's installs show up as
`whatsapp` in Play Console → Statistics → Store listing acquisition.
Profile picture: the navy-and-gold StoryByte logo; keep it free of
generator watermarks.

**Where the link appears (automatic):**

- Every Short's description, Reel caption, Facebook post and Sunday long
  video ends with "💬 रोज़ नई कथा WhatsApp पर: …" (`scripts/lib/social-extras.js`,
  also used by `scripts/build-landscape-episode.js`).
- The website: a green WhatsApp button on the home page
  (`scripts/lib/site-index.js`) and a link on every Hindi story page
  (`scripts/lib/story-page.js`). Pages written before this change get it
  when `scripts/build-story-pages.js` re-renders them.
- The app: Settings → **Daily katha on WhatsApp** (`src/screens/SettingsScreen.js`).

The link lives in `scripts/lib/social-extras.js` and `src/screens/SettingsScreen.js`.
To move the pipeline to a new channel without a code change, set the
`WHATSAPP_CHANNEL_URL` repository variable (GitHub → Settings → Secrets
and variables → Actions → Variables); the app needs a new release.

**Daily routine (by hand, ~2 minutes).** WhatsApp has no posting API for
Channels, so:

1. **Every morning, ~6 AM:** post the day's katha Short or story link with
   one line, e.g. "आज मंगलवार — हनुमान जी की कथा 🙏". The same time every
   day builds the habit.
2. **Share the post to your WhatsApp Status and family groups.** WhatsApp
   barely recommends Channels, so this is how new followers find it.
3. **About once a week, a poll** ("कल किस देवता की कथा सुनना चाहेंगे?"):
   people who vote keep seeing the channel.
4. **Festivals:** post the vrat katha **a day early** (Karwa Chauth, Diwali,
   Chhath…). Those are the posts that get forwarded most.

Add a second admin (Channel info → Admins) so posting doesn't stop when
you can't.

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
  ("Rate now" opens the Play Store page and stops the prompts; "Later" asks
  again next time). Google never tells the app whether someone rated, so
  tapping "Rate now" is what stops it.

## Google search (the website)

Every story has its own page on `https://storybyte-76716.web.app/s/…`, with
the audio and the full katha text. Before each site deploy,
`scripts/build-site-index.js` rebuilds:

- **the home page**: today's katha, all kathas and a download button;
- **`sitemap.xml`**: every story page, so Google can find them;
- **`robots.txt`**: points crawlers at the sitemap.

One-time setup, free:

1. Open **[Google Search Console](https://search.google.com/search-console)** → **Add property** → **URL prefix** → `https://storybyte-76716.web.app/`.
2. Choose **HTML tag** and copy just the code inside `content="…"`.
   GitHub → this repository → **Settings → Secrets and variables → Actions →
   Variables** → New: `GOOGLE_SITE_VERIFICATION` = that code.
3. After the next daily run (or run **Daily Stories** by hand), press
   **Verify** in Search Console.
4. **Sitemaps** → enter `sitemap.xml` → **Submit**.

Search traffic builds over weeks. Search Console shows which searches bring
people ("हनुमान जी की कथा" and so on).

## Telegram channel

Every day's katha video goes to a Telegram channel with its title, the
teaser and links to the story page and the app. Each Sunday's long katha
goes there as its thumbnail with the YouTube link.

1. Telegram → **New Channel** → name it like the YouTube channel, make it
   **Public**, and pick a link, e.g. `t.me/roz_ek_katha`.
2. Open **@BotFather** → `/newbot` → choose a name and username → copy the
   **token** it gives you.
3. Your channel → **Administrators** → **Add Admin** → search for your bot →
   allow **Post Messages**.
4. GitHub → this repository → **Settings → Secrets and variables → Actions**:
   - **Secrets** → New: `TELEGRAM_BOT_TOKEN` = the token.
   - **Variables** → New: `TELEGRAM_CHANNEL` = `@` plus the channel's link
     name, e.g. `@roz_ek_katha`.

From the next run, posting is automatic. Share the channel link in your
YouTube channel description and WhatsApp to get the first members.
