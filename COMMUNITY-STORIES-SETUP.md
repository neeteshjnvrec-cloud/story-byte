# 🚀 StoryByte Community Stories - Quick Setup

## ✅ What's Done

- ✅ Community tab added to bottom navigation
- ✅ Create Story screen with AI generation
- ✅ Groq API integration with key/model rotation
- ✅ Security rules updated for community stories
- ✅ Notification system ready
- ✅ Config created with dummy values

---

## 🔧 Setup (2 Minutes)

### Step 1: ✅ Config Created (Done!)
```bash
node scripts/init-groq-config.js
```
**Result**: Config created with dummy API keys in Firestore.

### Step 2: Add Your Real API Keys
1. Go to **Firebase Console** → **Firestore Database**
2. Open collection: `config`
3. Click document: `groq_settings`
4. Replace the dummy keys with your real ones:

| Field | Current (Dummy) | Action |
|-------|----------------|--------|
| `apiKeys[0]` | `gsk_dummy_key_1...` | Replace with real key |
| `apiKeys[1]` | `gsk_dummy_key_2...` | Replace with real key |
| `apiKeys[2]` | `gsk_dummy_key_3...` | Replace with real key |

**Get free API keys**: https://console.groq.com/keys

### Step 3: Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```

---

## 📊 Config Structure

```javascript
{
  apiKeys: [
    'gsk_your_real_key_1',
    'gsk_your_real_key_2', 
    'gsk_your_real_key_3'
  ],
  models: [
    'llama-3.3-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'qwen/qwen3.6-27b'
  ],
  status: 'active'
}
```

---

## 🔄 How It Works

```
User creates story
    ↓
App fetches config from Firestore
    ↓
Tries Key 1 × Model 1
    ↓ (if rate limited)
Tries Key 1 × Model 2
    ↓ (if fails)
Tries Key 2 × Model 1
    ↓ (continues until success)
    ↓
Story generated & published
    ↓
All users get notification
```

---

## 🎯 Ready to Test

Once you've added your real API keys:
1. Open the app
2. Tap **Create** tab
3. Enter a story prompt
4. Tap **Generate with AI**
5. Edit & Publish
6. Check **Community** tab to see it live!

---

## 🔐 Security

- ✅ API keys stored in Firestore (not in code)
- ✅ Automatic retry with key rotation
- ✅ Rate-limited (safe for free tier)
- ✅ Users can only create their own stories
