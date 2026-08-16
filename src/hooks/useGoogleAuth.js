// Native Google Sign-In (@react-native-google-signin) → Firebase credential.
// Uses the native account picker (no browser / custom-scheme redirect), which
// is the reliable path in dev/standalone builds. The Web client ID is used as
// the token audience Firebase expects; the SHA-1-registered Android client
// authorizes the native sign-in. Only works in a real build (not Expo Go).
import { useState, useEffect } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithGoogle } from '../services/googleAuth';

const WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;
function ensureConfigured() {
  if (configured || !WEB) return;
  GoogleSignin.configure({ webClientId: WEB, iosClientId: IOS });
  configured = true;
}

export function useGoogleAuth(onError) {
  const [inProgress, setInProgress] = useState(false);

  useEffect(() => { ensureConfigured(); }, []);

  const signIn = async () => {
    if (!WEB) {
      onError && onError('Google sign-in isn’t set up yet.');
      return;
    }
    try {
      setInProgress(true);
      ensureConfigured();
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
