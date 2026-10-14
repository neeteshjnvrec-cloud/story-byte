// Ask for a Play Store rating after every finished story, until the
// listener taps "Rate now" (here or in Settings).
//
// Always our own prompt: Google's in-app review popup only appears in apps
// installed from the Play Store, at most a few times, and never says whether
// it showed, so relying on it meant the first finished story often showed
// nothing at all. Google never says whether someone rated either, which is
// why tapping "Rate now" is what stops the prompts.
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATED_KEY = 'storybyte-rated';
// A moment after the story ends, so it doesn't land on top of the coin toast.
const DELAY_MS = 2500;
const PACKAGE = 'com.storybyte.app';

const markRated = () => AsyncStorage.setItem(RATED_KEY, 'true').catch(() => {});

// Also the Settings screen's "Rate StoryByte" row.
export async function openPlayStore() {
  markRated();
  try {
    await Linking.openURL(`market://details?id=${PACKAGE}&showAllReviews=true`);
  } catch (e) {
    Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}&showAllReviews=true`).catch(() => {});
  }
}

function askInApp() {
  Alert.alert(
    '⭐ Rate StoryByte',
    'Your rating helps more people find these stories. It only takes 5 seconds 🙏',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Rate now', onPress: openPlayStore },
    ],
  );
}

export async function noteStoryFinished() {
  try {
    if (await AsyncStorage.getItem(RATED_KEY) === 'true') return;
    setTimeout(askInApp, DELAY_MS);
  } catch (e) {
    // A rating prompt must never get in the way of listening.
  }
}
