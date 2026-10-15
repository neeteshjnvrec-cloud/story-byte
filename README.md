<a href="https://trendshift.io/repositories/82054?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-82054" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/82054/weekly" alt="morluto%2Frea | Trendshift" width="250" height="55"/></a>

# 📖 StoryByte - Premium Audio Stories App

**Listen. Escape. Repeat.**

A premium audio stories mobile application with daily AI-generated content using Groq LLM, built with React Native (Expo) and Firebase.

---

## 📱 Live Status

| Feature | Status |
|---------|--------|
| Mobile App | ✅ Published (Play Store) |
| Backend API | ✅ Firebase Cloud Functions |
| Daily Story Generation | ✅ Groq LLM + Google TTS |
| Firebase Services | ✅ Free Tier (Spark Plan) |

---

## 🏗️ Architecture

```
story-byte/
├── functions/                    # Firebase Cloud Functions (Serverless)
│   ├── index.js                 # Main Cloud Functions entry
│   ├── story-generator.js       # Groq LLM daily story generator
│   └── package.json
│
├── firestore/                   # Firestore Security Rules
│   ├── firestore.rules.json
│   └── firestore-indexes.json
│
├── src/                         # React Native Frontend
│   ├── screens/                 # Screen Components
│   │   ├── HomeScreen.js       # Main story browsing
│   │   ├── StoryDetailScreen.js # Story detail & audio player
│   │   ├── FavoritesScreen.js   # Saved stories
│   │   └── ProfileScreen.js     # User profile & settings
│   │
│   ├── components/              # Reusable UI Components
│   ├── context/                 # React Context (State Management)
│   │   ├── AppContext.js        # App-wide state
│   │   └── AudioContext.js      # Audio player state
│   │
│   ├── hooks/                   # Custom Hooks
│   │   └── useTheme.js         # Theme (Light/Dark) support
│   │
│   ├── services/                # API & Firebase Services
│   │   ├── api.js              # API service layer
│   │   └── firebase.js         # Firebase configuration
│   │
│   ├── types/                   # TypeScript Types
│   └── constants/               # App Constants
│
├── scripts/                     # Database & Generation Scripts
│   ├── seed-database.js        # Initial data seeding
│   └── generate-stories.js     # Manual story generation CLI
│
├── firebase.json                # Firebase Project Configuration
├── .firebaserc                  # Firebase Project Alias
├── app.json                     # Expo App Configuration
└── .env.example                 # Environment Variables Template
```

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React Native (Expo SDK 52) |
| **Backend** | Firebase Cloud Functions |
| **Database** | Cloud Firestore (Free Tier) |
| **Authentication** | Firebase Auth (Google, Email) |
| **Storage** | Cloud Storage for Firebase |
| **AI Generation** | Groq LLM (Llama 3.3) |
| **Audio** | Google Cloud TTS (Neural2 voices) |
| **Hosting** | Firebase Hosting (Free Tier) |

---

## 🆓 Firebase Free Tier Limits

| Service | Free Limit | Our Usage |
|---------|-----------|-----------|
| Firestore | 1 GiB storage | ~50 MB/day |
| Cloud Functions | 125K invocations/month | ~30K/month |
| Authentication | Unlimited users | Unlimited |
| Cloud Storage | 5 GB | ~2 GB |
| Hosting | 10 GB storage | < 100 MB |

---

## 📖 Daily Story Generation

### How It Works

1. **Trigger**: Firebase Cloud Scheduler runs daily at 6 AM UTC
2. **Genre Selection**: Random genre picked (Romance, Mystery, Drama, Fantasy, Thriller, Comedy)
3. **Story Creation**: Groq LLM generates engaging story content
4. **Audio Generation**: Google Cloud TTS creates narration
5. **Storage**: Story + audio stored in Firestore & Cloud Storage
6. **Publish**: Stories go live immediately for users

### Supported Languages
- 🇺🇸 English (en-IN, en-US)
- 🇮🇳 Hindi (hi-IN)

### Models Used
- **Groq**: `llama-3.3-70b-versatile` (story text)
- **Google TTS**: `en-US-Neural2-F` / `hi-IN-Standard-A`

---

## ⚠️ Play Store Compatibility

This redesign maintains **backward compatibility** with the current Play Store app:

- ✅ API versioned (v1 → v2) for smooth migration
- ✅ Same app package name: `com.storybyte.app`
- ✅ No breaking changes to existing audio URLs
- ✅ Existing user data preserved
- ✅ Graceful degradation if new APIs unavailable

### Migration Path
1. **v1.x** - Current Play Store version (Express.js backend)
2. **v2.x** - New Firebase backend (this version)
3. **v3.x** - Future features (offline support, etc.)

---

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud account (for TTS)
- Groq API key (free at https://console.groq.com)

### Frontend Setup

```bash
# Install dependencies
cd story-byte
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Firebase config

# Start development
npm start
# or
expo start
```

### Backend Setup (Firebase Functions)

```bash
# Install functions dependencies
cd functions
npm install

# Login to Firebase
firebase login

# Deploy functions
firebase deploy --only functions

# Seed initial database
npm run seed
```

### Firebase Setup

1. Create Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Enable Authentication (Google provider)
4. Enable Cloud Storage
5. Create service account key
6. Update `.env` with credentials

---

## 📊 Environment Variables

```env
# Firebase
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# Groq (free tier)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Google Cloud (for TTS)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

---

## 🎯 API Endpoints (Cloud Functions)

### Stories
- `GET /api/stories` - List all stories
- `GET /api/stories/:id` - Get single story
- `POST /api/stories/:id/play` - Record play

### User
- `GET /api/user/profile` - Get user profile
- `POST /api/user/favorites/:storyId` - Add favorite
- `DELETE /api/user/favorites/:storyId` - Remove favorite
- `GET /api/user/favorites` - Get favorites

### Admin
- `POST /generate-stories` - Manual story generation

---

## 🧪 Testing

```bash
# Test story generation locally
cd functions
npm run test

# Generate stories manually
npm run generate-stories -- --count 3 --language en

# Run frontend tests
cd ..
npm test
```

---

## 🚢 Deployment

### Firebase Deployment

```bash
# Deploy all
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

### Play Store Release

```bash
# Build Android AAB
eas build --platform android --profile production

# Build APK (for testing)
eas build --platform android --profile preview
```

---

## 📈 Monitoring & Analytics

- **Firebase Console**: User analytics, crashlytics
- **Firestore**: Document reads/writes, storage
- **Cloud Functions**: Invocation count, errors
- **Groq Console**: API usage and costs

---

## 🔒 Security

- ✅ Firebase Auth with JWT
- ✅ Firestore security rules
- ✅ CORS protection
- ✅ Rate limiting (100 requests/15 min)
- ✅ Input validation (Zod)
- ✅ Environment variables secured

---

## 📚 Additional Documentation

- [Firebase Setup Guide](./docs/firebase-setup.md)
- [Groq Integration Guide](./docs/groq-setup.md)
- [API Reference](./docs/api-reference.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 📧 Support

- Issues: [GitHub Issues](https://github.com/your-repo/story-byte/issues)
- Email: support@storybyte.com

---

**Built with ❤️ using Firebase Free Tier**
