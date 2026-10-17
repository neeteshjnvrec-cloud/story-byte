// Native Google Sign-In (@react-native-google-signin) → Firebase credential.
// Uses the native account picker (no browser / custom-scheme redirect), which
// is the reliable path in dev/standalone builds.
//
// IMPORTANT: the library touches the native `RNGoogleSignin` TurboModule the
// moment it's imported. In a binary without that module (Expo Go, or a build
// made before the module was added) that throws — and Metro's dev loader
// reports the throw to the red-box overlay BEFORE any try/catch can swallow it.
// So we must never even `require()` the package unless the native module is
// actually present. `TurboModuleRegistry.get` is the non-throwing probe for
// that (unlike `getEnforcing`, which throws). Present → require + sign in;
// absent → the Google button shows a "needs latest build" message.
import { useState } from 'react';
import { TurboModuleRegistry } from 'react-native';
import { signInWithGoogle } from '../services/googleAuth';

const WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;

function nativeModulePresent() {
  try {
    return !!TurboModuleRegistry.get('RNGoogleSignin');
  } catch (e) {
    return false;
  }
}

// Returns the GoogleSignin module, or null if the native module isn't in this binary.
function loadGoogleSignin() {
  if (!nativeModulePresent()) return null;
  try {
    const GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    if (!configured && WEB) {
      GoogleSignin.configure({ webClientId: WEB, iosClientId: IOS });
      configured = true;
    }
    return GoogleSignin;
  } catch (e) {
    return null;
  }
}

export function useGoogleAuth(onError) {
  const [inProgress, setInProgress] = useState(false);

  const signIn = async () => {
    if (!WEB) {
      onError && onError('Google sign-in isn’t set up yet.');
      return;
    }
    const GoogleSignin = loadGoogleSignin();
    if (!GoogleSignin) {
      onError && onError('Google sign-in needs the latest app build. Please update the app.');
      return;
    }
    try {
      setInProgress(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GoogleSignin.signIn();
      if (res?.type === 'cancelled') return; // user dismissed the picker
      const idToken = res?.data?.idToken || res?.idToken;
      if (idToken) {
        await signInWithGoogle(idToken); // AppContext auth listener switches into the app
      } else {
        onError && onError('Google did not return an ID token.');
      }
    } catch (e) {
      onError && onError(e?.code === 'auth/account-exists-with-different-credential'
        ? 'This email already has a StoryByte account with a password. Sign in with your email and password.'
        : e?.code === 'auth/network-request-failed'
          ? 'Network error. Please check your connection.'
          : 'Google sign-in failed. Please try again.');
    } finally {
      setInProgress(false);
    }
  };

  return { signIn, inProgress, ready: true };
}
