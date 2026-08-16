// Google sign-in via expo-auth-session → Firebase credential.
// Client IDs come from EXPO_PUBLIC_GOOGLE_* env vars, so the app ships safely
// even before they're configured (the button reports "not configured" then).
import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle } from '../services/googleAuth';

WebBrowser.maybeCompleteAuthSession();

const WEB = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export function useGoogleAuth(onError) {
  const [inProgress, setInProgress] = useState(false);
  const configured = !!(WEB || IOS || ANDROID);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: WEB,
    iosClientId: IOS,
    androidClientId: ANDROID,
  });

  useEffect(() => {
    if (!response) return;
    (async () => {
      if (response.type === 'success') {
        try {
          const idToken = response.params?.id_token || response.authentication?.idToken;
          if (idToken) {
            await signInWithGoogle(idToken); // AppContext's auth listener switches to the app
          } else {
            onError && onError('Google did not return an ID token.');
          }
        } catch (e) {
          onError && onError('Google sign-in failed. Please try again.');
        } finally {
          setInProgress(false);
        }
      } else if (response.type !== 'locked') {
        setInProgress(false); // dismiss / cancel / error
      }
    })();
  }, [response]);

  const signIn = async () => {
    if (!configured) {
      onError && onError('Google sign-in isn’t set up yet.');
      return;
    }
    setInProgress(true);
    try {
      await promptAsync();
    } catch (e) {
      setInProgress(false);
      onError && onError('Could not open Google sign-in.');
    }
  };

  return { signIn, inProgress, ready: !!request };
}
