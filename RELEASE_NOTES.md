# StoryByte v2.0.0 - Release Notes

**Version:** 2.0.0  
**Build:** 14  
**Release Date:** August 18, 2026

---

## 🎉 What's New

### ✨ New Features

#### 📚 Content Updates
- **7 Genres Available**: Added Motivation and Devotional genres
  - Romance, Mystery, Drama, Adventure, Sleep, **Motivation**, **Devotional**
- **Daily Story Generation**: Exactly 2 random stories generated daily
- **Smart Retry System**: Failed stories automatically retry with different genres
- **Bilingual Support**: Stories available in English and Hindi

#### 🔔 Notifications
- **Real-time Notifications**: Now reads from Firestore for instant updates
- **Notification Badge**: Shows unread count on bell icon
- **Mark All Read**: Fixed button to mark all notifications as read
- **Clear All**: Fixed button to clear all notification history
- **Back Button**: Added navigation back button in Notifications screen

#### 🎵 Audio Player
- **Story Restart**: Click play again after story finishes → restarts from beginning
- **Progress Saving**: Automatically saves your listening position

#### 🔍 Filter & Search
- **Duration Filter**: Filter stories by length (Short <5min, Medium 5-15min, Long 15+min)
- **Genre Filter**: Filter by any of the 7 genres
- **Language Filter**: Filter by English or Hindi
- **Filter Icon**: Added filter button in Home screen header with dot indicator
- **Reset Functionality**: Reset button clears all filters

#### 🎨 UI/UX Improvements
- **Browse Screen Fix**: "All" button now correctly resets to show all stories
- **Notifications Screen**: Added back button for easy navigation
- **Cleaner Interface**: Removed orphaned files and improved performance

---

## 🐛 Bug Fixes

| Issue | Fix |
|-------|-----|
| Duration filter not working | Fixed API to accept and filter by duration parameter |
| Notification permissions error | Updated Firestore rules to allow authenticated users |
| "Mark All Read" failing | Fixed method implementation |
| "Clear All" failing | Fixed method implementation |
| Story doesn't restart after finish | Fixed AudioContext to clear current story state |
| Filter not showing Motivation/Devotional | Updated to import genres from centralized constants |
| Build errors with expo-notifications | Added proper dependency configuration |
| Build errors with react-native-worklets | Downgraded to compatible version 0.10.1 |
| Metadata Error: Missing expo-notifications plugin | Added to app.json plugins array |

---

## 📊 Technical Details

### Dependencies Updated
- `expo-notifications`: ^57.0.4
- `react-native-worklets`: 0.10.1
- `firebase`: ^11.0.0

### Build Information
- **Expo SDK**: 57.0.0
- **React Native**: 0.86.2
- **Android Target SDK**: 36
- **Minimum SDK**: 24

---

## 📱 Requirements

- Android 7.0 (API level 24) or higher
- Internet connection for streaming
- Firebase Authentication for personalized features

---

## 🔗 Links

- **Download APK**: https://expo.dev/artifacts/eas/LXXbN1VamO4hrNorZbg84xpTGJnsi-u9gJ1or18hDDw.aab
- **GitHub Repository**: https://github.com/neeteshjnvrec-cloud/story-byte
- **Live Website**: https://storybyte-76716.web.app

---

## 🙏 Thank You

Thanks for using StoryByte! We hope you enjoy the new features and improvements.

**Happy Listening! 🎧**
