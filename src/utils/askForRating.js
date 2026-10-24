// Ask for a Play Store rating after a few finished stories.
//
// The second finished story opens Google's in-app review popup: listeners
// rate in two taps without leaving the app. Google decides whether it
// actually shows (only in Play Store installs, a few times per user) and
// never says, so every fifth finished story after that asks with our own
// prompt, which opens the Play Store page. Tapping "Rate now" there or in
// Settings stops the prompts; Google never says whether someone rated.
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATED_KEY = 'storybyte-rated';
const FINISHED_KEY = 'storybyte-finished-count';
const NATIVE_AT = 2;
const ASK_EVERY = 5;
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
    '⭐ StoryByte को रेट करें',
    'आपकी रेटिंग से और लोग ये कथाएँ और कहानियाँ ढूँढ पाते हैं। बस 5 सेकंड 🙏\n\nYour rating helps more people find these stories.',
    [
      { text: 'बाद में', style: 'cancel' },
      { text: 'अभी रेट करें', onPress: openPlayStore },
    ],
  );
}

// Google's popup. Loaded lazily so a build without the native module
// falls back to our prompt instead of crashing.
async function askNative() {
  try {
    const StoreReview = require('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return false;
    await StoreReview.requestReview();
    return true;
  } catch (e) {
    return false;
  }
}

export async function noteStoryFinished() {
  try {
    if (await AsyncStorage.getItem(RATED_KEY) === 'true') return;
    const count = (parseInt(await AsyncStorage.getItem(FINISHED_KEY), 10) || 0) + 1;
    await AsyncStorage.setItem(FINISHED_KEY, String(count));
    if (count === NATIVE_AT) {
      setTimeout(async () => { if (!(await askNative())) askInApp(); }, DELAY_MS);
    } else if (count > NATIVE_AT && count % ASK_EVERY === 0) {
      setTimeout(askInApp, DELAY_MS);
    }
  } catch (e) {
    // A rating prompt must never get in the way of listening.
  }
}
