# 📝 UGC AI Co-Creator Studio: Feature Specification & Architecture

## 🎯 Objective
Allow users to submit a short story prompt or concept, have AI (Groq LLM) generate the full story, review and edit it, and publish it to the StoryByte community feed with automatically generated cover art and audio narration.

---

## 🔒 1. Rate Limiting & Abuse Prevention ($0 Budget)
- **Limit per User**: Maximum **2 stories created per user per day**.
- **Enforcement**: 
  - Store a `lastStoryCreatedDate` and `storiesCreatedCount` counter in the user's Firestore profile document.
  - Enforce this limit both on client-side UI and via Firestore Security Rules / Cloud Function checks.
- **Spam Mitigation**:
  - Published community stories start with `status: 'published'` but include a `reportCount` field. If reported 3+ times, it is automatically hidden.

---

## 🔑 2. Multi-Key Groq API Rotation (Failover & Scale)
To ensure uninterrupted generation even if one Groq API key hits rate limits (TPM / RPM):
- Maintain an environment array or Firestore config list of multiple free Groq API keys:
  ```javascript
  const GROQ_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3
  ].filter(Boolean);
  ```
- **Rotation Logic**: If a Groq call throws a rate limit (`429`) or quota error, automatically rotate to the next API key in the array and retry instantly.

---

## 🧠 3. Best Model for Story Generation
- **Primary Model**: `llama-3.3-70b-versatile` (or `deepseek-r1-distill-llama-70b` if available on Groq) — offering exceptional narrative depth, emotional resonance, and precise JSON output formatting.
- **Fallback Model**: `llama-3.1-8b-instant` or `qwen/qwen3.6-27b` for blazing-fast fallback if the 70B model is busy.

---

## 📱 4. User Flow & Screen Design

1. **Create Tab / Button**: Added to the bottom navigation or profile screen (`CreateStoryScreen.js`).
2. **Input Form**:
   - **Title** (optional, AI can generate if left blank)
   - **Genre Selector** (Romance, Mystery, Fantasy, Sci-Fi, Bedtime, Drama)
   - **Your Prompt / Idea**: (e.g., *"A lonely lighthouse keeper hears a voice singing from inside a storm."*)
3. **Draft Generation**:
   - User taps **"Generate with AI"**.
   - App calls backend function / API service, which uses Groq to generate title, description, and 500-word story text.
4. **Preview & Edit Modal**:
   - User reviews the generated story.
   - They can edit the text directly if they want to tweak a paragraph.
5. **Publish**:
   - User taps **"Publish to Community"**.
   - Background job generates cover art (`pollinations.ai`) and audio (`edge-tts`), saves to Firestore, and lists it under the **Community** feed in the app!
   - **Broadcast Notification**: Automatically writes a notification document to the `notifications` collection with `type: 'new_community_story'`, so all app users receive a push/in-app alert about the new story published by the community member.

---

## 🗄️ 5. Firestore Data Schema (`community_stories` or `stories`)

```javascript
{
  storyId: "community_2025_02_26_uid123_lighthouse",
  title: "The Song in the Storm",
  description: "A lonely lighthouse keeper hears a mysterious voice...",
  genre: "mystery",
  language: "en",
  text: "Full generated story text...",
  audioUrl: "https://.../audio/...",
  coverImage: "https://.../covers/...",
  duration: 180,
  authorName: "Neetesh Kumar",
  authorId: "uid123",
  isCommunityStory: true,
  status: "published", // published, flagged, removed
  likesCount: 0,
  playsCount: 0,
  createdAt: serverTimestamp()
}
```

---

## 🔔 6. Broadcast Notification Schema

When a community story is published, a notification is automatically created:

```javascript
{
  id: "notification_12345",
  type: "new_community_story",
  title: "New Story Published!",
  body: "The Song in the Storm by Neetesh Kumar is now available",
  storyId: "community_2025_02_26_uid123_lighthouse",
  authorName: "Neetesh Kumar",
  coverImage: "https://.../covers/...",
  read: false,
  createdAt: serverTimestamp()
}
```

All users in the app will receive this notification via Firebase Cloud Messaging (FCM) push notifications or in-app notification center.
