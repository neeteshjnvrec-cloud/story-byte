// Native Google Sign-In (@react-native-google-signin) → Firebase credential.
// Uses the native account picker (no browser / custom-scheme redirect), which
// is the reliable path in dev/standalone builds.
//
// IMPORTANT: the library is loaded LAZILY inside a try/catch. It touches the
// native `RNGoogleSignin` TurboModule the moment it's imported, which throws an
// invariant in any binary that doesn't include it (Expo Go, or a build made
// before the module was added). Loading it lazily keeps the whole app from
// crashing at startup there — only the Google button is unavailable until the
// app is rebuilt. In a real build the require succeeds and sign-in works.
import { useState } from 'react';
import { signInWithGoogle } from '../services/googleAuth';

const WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;

// Returns the GoogleSignin module, or null if the native module isn't present.
function loadGoogleSignin() {
  try {
    const mod = require('@react-native-google-signin/google-signin');
    const GoogleSignin = mod.GoogleSignin;
    if (!configured && WEB) {
      GoogleSignin.configure({ webClientId: WEB, iosClientId: IOS });
      configured = true;
    }
    return GoogleSignin;
  } catch (e) {
    return null; // native module not in this binary
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
      onError && onError('Google sign-in failed. Please try again.');
    } finally {
      setInProgress(false);
    }
  };

  return { signIn, inProgress, ready: true };
}
