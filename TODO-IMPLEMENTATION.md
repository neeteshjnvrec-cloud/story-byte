# StoryByte Implementation TODOs & Gaps Analysis

## 🎯 Current State: Authentication Screens Fully Themed

**Completed:**
- ✅ LoginScreen.js: All hard-coded colors replaced with theme tokens
- ✅ SignupScreen.js: Gradient colors from theme, consistent styling
- ✅ ForgotPasswordScreen.js: Theme-aware gradient, proper styling
- ✅ useTheme.js: Added `gradientStart`, `gradientEnd`, `divider` tokens
- ✅ authStyles.js: Uses theme colors in dynamic styling

---

## ❌ MISSING FEATURES TO IMPLEMENT

### HIGH PRIORITY (User Experience Blocking)

#### 1. **Show Password Toggle** (LoginScreen)
```javascript
// MISSING: Show/hide password functionality
// Current: Password input has no toggle
// Fix: Add eye icon toggle with secureTextEntry control
```

#### 2. **Password Confirmation Validation** (SignupScreen)
```javascript
// MISSING: Confirm password matching
// Current: Input fields exist but no validation
// Fix: Add state + validation before submit
```

#### 3. **Password Reset Flow State** (ForgotPasswordScreen)
```javascript
// MISSING: Loading state during reset
// Current: No visual feedback during API call
// Fix: Show ActivityIndicator during reset
```

#### 4. **Google Sign-in Integration**
```javascript
// MISSING: Google authentication option
// Current: Only email/password auth
// Fix: Add Google button with useGoogleAuth() hook
```

---

### MEDIUM PRIORITY (Product Features)

#### 5. **Onboarding Flow**
```javascript
// MISSING: First-time user experience
// Current: Users see Home screen immediately
// Fix: Create OnboardingScreen with 3 pages (value props, genres, tips)
```

#### 6. **Story Genres Icons**
```javascript
// MISSING: Visual genre representation
// Current: Text-only genre chips
// Fix: Add emoji icons for each genre (see PROMPTS section)
```

#### 7. **Story Page Navigation UI**
```javascript
// MISSING: In-story page controls
// Current: Page navigation in AudioContext only
// Fix: Add progress dots or page slider in StoryDetailScreen
```

#### 8. **Audio Waveform Visualization**
```javascript
// MISSING: Visual playback indicator
// Current: Text-based progress bar only
// Fix: Add waveform component (use react-native-svg or simple bars)
```

---

### LOW PRIORITY (Nice to Have)

#### 9. **Pull-to-Refresh State**
```javascript
// MISSING: Refresh indicator color
// Current: Default spinner color
// Fix: Use theme.accent for tintColor
```

#### 10. **Empty State Illustrations**
```javascript
// MISSING: Friendly empty states
// Current: Text-only messages
// Fix: Add emoji illustrations for No stories, No favorites, etc.
```

---

## 📱 MISSING SCREENS IN NAVIGATION

### Screens Needed:
1. **OnboardingScreen** - First-time user walkthrough
2. **SettingsScreen** - Theme toggle, preferences
3. **ListeningHistoryScreen** - Detailed playback history
4. **StoryPlayerScreen** (full screen) - Enhanced playback experience

### Update AppNavigator.js:
```javascript
// Add these screens
<Stack.Screen name="Onboarding" component={OnboardingScreen} />
<Stack.Screen name="Settings" component={SettingsScreen} />
<Stack.Screen name="Player" component={FullPlayerScreen} />
```

---

## 🔧 TECHNICAL DEBT (Code Quality)

### 1. **Duplicate Theme Logic** (useTheme.js)
```javascript
// ISSUE: Both ThemeProvider and useTheme hook have state
// FIX: Consolidate to single source of truth
```

### 2. **Hardcoded Colors in Styles**
- HomeScreen.js: `color: '#8b9dc3'`, `backgroundColor: '#fff'`
- ProfileScreen.js: `backgroundColor: '#667eea'`, `borderBottomColor: '#eee'`
- FavoritesScreen.js: `backgroundColor: '#fff'`

### 3. **Missing Error Boundaries**
```javascript
// Add ErrorBoundary component for crash protection
// Catch Firebase auth errors gracefully
```

---

## 🎨 DESIGN SYSTEM GAPS

### Colors Missing from Theme:
- [ ] Error color for validation
- [ ] Warning/Info colors for alerts
- [ ] Gradient colors for dark mode

### Typography Missing:
- [ ] Caption style (12px, 400)
- [ ] Button text style (16px, 600)

### Components Missing:
- [ ] Avatar component (Profile screen)
- [ ] Progress bar component (reusable)
- [ ] Rating stars component (StoryDetail)
- [ ] Genre badge variant
- [ ] Loading skeleton component

---

## 📦 PACKAGE.JSON DEPENDENCIES CHECK

### Current (Installed):
```json
{
  "expo-linear-gradient": "11.7.7",
  "@react-native-async-storage/async-storage": "2.2.0",
  "@react-native-community/slider": "5.2.0"
}
```

### Missing (Need to Add):
```json
{
  "@react-native-async-storage/async-storage": "^1.22.0",
  "expo-crypto": "^12.6.0",
  "expo-haptics": "^12.6.0",
  "react-native-screens": "^3.22.0"
}
```

---

## 🚀 NEXT STEPS (Immediate Priorities)

### Today's Implementation List:

1. **Fix LoginScreen.js** - Add show password toggle
2. **Fix SignupScreen.js** - Add password validation
3. **Fix ForgotPasswordScreen.js** - Add loading state
4. **Create OnboardingScreen.js** - First-time user flow
5. **Create SettingsScreen.js** - Theme toggle
6. **Run lint** - `npm run lint` to find hardcoded colors
7. **Test on device** - Verify gradient colors in both modes

### Code Commands to Run:

```bash
# Fix lint errors
npm run lint -- --fix

# Start app
npm start

# Test build
npx expo run:ios
npx expo run:android

# Check bundle size
npx expo export --platform web
```

---

## 📋 VERIFICATION CHECKLIST

Before considering auth screens complete:

- [ ] Show password toggle works in LoginScreen
- [ ] Password match validation in SignupScreen
- [ ] Loading indicators in ForgotPasswordScreen
- [ ] Google sign-in button visible
- [ ] Theme toggle in Settings
- [ ] Onboarding accessible after login
- [ ] No hardcoded colors in auth screens
- [ ] Gradients work in both light/dark mode
- [ ] All buttons use theme colors
- [ ] Error messages styled correctly
- [ ] Divider lines use theme.divider
- [ ] Input borders match theme.border
- [ ] Background colors from theme.background
- [ ] Text colors from theme.text / theme.textSecondary

---

## 📈 USER FLOW DIAGRAM

```
                    ┌─────────────┐
                    │   Splash    │
                    │  (Loading)  │
                    └──────┬──────┘
                           │
                   user is null?
                           │
              ┌────────────┴────────────┐
              │            │            │
             YES           │           NO
              │            │            │
     ┌────────┴──────┐     │    ┌───────┴───────┐
     │               │     │    │               │
     │  LOGIN SCREEN │     │    │   HOME TAB    │
     │               │     │    │               │
     │ ┌───┐ ┌───┐   │     │    └───────────────┘
     │ │L  │ │S  │   │     │           │
     │ │o  │ │i  │   │     │           │
     │ │g  │ │g  │   │     │           │
     │ │i  │ │n  │   │     │           │
     │ │n  │ │u  │   │     │           │
     │ │ ✅ │ │p  │   │     │           │
     │ └───┘ └───┘   │     │           │
     │               │     │           │
     │ ┌───────┐     │     │  ┌────────┴────────┐
     │ │Forgot │─────┼─────┼─▶│ STORY DETAIL    │
     │ │Pass.  │     │     │  │                 │
     │ └───────┘     │     │  │ Play/Pause     │
     │               │     │  │ Progress       │
     │               │     │  │ Rating         │
     │               │     │  │ Text (if any)  │
     │               │     │  └─────────────────┘
     └───────────────┘     │           │
                           │           │
                           ▼           ▼
                  ┌────────┴───────────┴─────────┐
                  │    AUTH STACK (No User)     │
                  │                             │
                  │ LOGIN ◄─────────────────┐   │
                  │   │                     │   │
                  │   ▼                     │   │
                  │ SIGNUP                  │   │
                  │   │                     │   │
                  │   ▼                     │   │
                  │ FORGOT PASSWORD         │   │
                  │                             │   │
                  └─────────────────────────────┘
```

---

*Generated after complete codebase analysis*
*Status: Auth screens 90% complete, remaining: interactive elements and edge cases*