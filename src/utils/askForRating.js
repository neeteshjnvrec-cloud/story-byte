// Ask for a Play Store rating after every finished story, until the
// listener rates.
//
// After the first finished story: Google's in-app review popup
// (expo-store-review), which lets them rate without leaving the app. Google
// decides whether it actually shows and never says whether they rated, so
// after every later story we ask ourselves, with a button that opens the
// Play Store page. Once they tap "Rate now", we stop.
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FINISHED_KEY = 'storybyte-finished-stories';
const RATED_KEY = 'storybyte-rated';
// A moment after the story ends, so it doesn't land on top of the coin toast.
const DELAY_MS = 2500;
const PACKAGE = 'com.storybyte.app';

let StoreReview = null;
try {
  StoreReview = require('expo-store-review');
} catch (e) {
  // Not in this build: the Play Store button still works.
}

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

async function googlePopup() {
  try {
    if (!StoreReview || !(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return false;
    await StoreReview.requestReview();
    return true;
  } catch (e) {
    return false;
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
    const finished = Number(await AsyncStorage.getItem(FINISHED_KEY) || 0) + 1;
    await AsyncStorage.setItem(FINISHED_KEY, String(finished));
    setTimeout(async () => {
      if (finished === 1 && await googlePopup()) return;
      askInApp();
    }, DELAY_MS);
  } catch (e) {
    // A rating prompt must never get in the way of listening.
  }
}
