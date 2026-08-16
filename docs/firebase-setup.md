# Firebase Setup Guide for StoryByte

This guide walks you through setting up Firebase for the StoryByte project using the **Free Tier (Spark Plan)**.

---

## 📋 Prerequisites

1. Google Account
2. Node.js 18+
3. Firebase CLI installed (`npm install -g firebase-tools`)

---

## 🚀 Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Create Project"**
3. Enter project name: `storybyte-app`
4. Disable Google Analytics (optional, can add later)
5. Click **"Create Project"**

---

## 🔐 Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Add your support email
4. Note down your **Web API Key** (from Project Settings)

---

## 🗄️ Step 3: Setup Firestore Database

1. Go to **Firestore Database** → **Create Database**
2. Choose **"Start in production mode"** (we'll add security rules)
3. Select closest region (e.g., `us-central1`)
4. Click **"Enable"**

---

## 📦 Step 4: Setup Cloud Storage

1. Go to **Storage** → **Get Started**
2. Choose **"Start in production mode"**
3. Select same region as Firestore

---

## 🔑 Step 5: Generate Service Account

1. Go to **Project Settings** (gear icon) → **Service Accounts**
2. Click **"Generate new private key"**
3. Save as `functions/firebase-service-account.json`
4. **IMPORTANT**: Never commit this file to git!

---

## 📝 Step 6: Configure Project

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update with your Firebase config from Project Settings:
   ```env
   FIREBASE_API_KEY=AIzaSy...
   FIREBASE_AUTH_DOMAIN=storybyte-app.firebaseapp.com
   FIREBASE_PROJECT_ID=storybyte-app
   FIREBASE_STORAGE_BUCKET=storybyte-app.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=123456789
   FIREBASE_APP_ID=1:123456789:web:abc123
   ```

---

## 🚀 Step 7: Deploy Security Rules

```bash
# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init

# Select:
# - Firestore: firestore.rules
# - Functions: functions/
# - Storage: storage.rules

# Deploy rules
firebase deploy --only firestore:rules,storage
```

---

## 🧪 Step 8: Test Locally

```bash
# Start Firebase emulators
firebase emulators:start

# Emulators run at:
# Auth: http://localhost:9099
# Functions: http://localhost:5001
# Firestore: http://localhost:8080
# Storage: http://localhost:9199
# UI: http://localhost:4000
```

---

## 📊 Free Tier Limits (Spark Plan)

| Service | Limit | Our Usage |
|---------|-------|-----------|
| Firestore Reads | 50K/day | ~5K/day |
| Firestore Writes | 20K/day | ~1K/day |
| Firestore Storage | 1 GiB | ~50 MB |
| Functions Invocations | 125K/month | ~30K/month |
| Functions Execution | 400K GB-sec/month | ~50K GB-sec |
| Authentication | Unlimited | Unlimited |
| Storage | 5 GB | ~2 GB |
| Hosting | 10 GB | ~100 MB |

---

## 🔧 Common Issues

### "Permission Denied" Errors
- Check Firestore security rules
- Ensure user is authenticated

### Functions Timeout
- Upgrade to paid plan (Blaze) if needed
- Optimize function code

### Storage Quota Exceeded
- Implement image/audio compression
- Use CDN caching

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Authentication enabled (Google provider)
- [ ] Firestore database created
- [ ] Cloud Storage enabled
- [ ] Service account downloaded
- [ ] Environment variables configured
- [ ] Security rules deployed
- [ ] Emulators working locally
- [ ] Test deployment successful

---

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules)
- [Cloud Functions](https://firebase.google.com/docs/functions)
- [Firebase CLI](https://firebase.google.com/docs/cli)