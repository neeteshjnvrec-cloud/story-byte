// Ask for a Play Store rating once someone has clearly enjoyed the app.
//
// Uses Google's in-app review popup (expo-store-review): the listener rates
// without leaving the app. Google decides whether the popup actually shows
// and limits how often, so asking can never nag; we still only ask at a few
// milestones of finished stories, when the listener is most likely happy.
import AsyncStorage from '@react-native-async-storage/async-storage';

const FINISHED_KEY = 'storybyte-finished-stories';
// Ask after the 3rd finished story; if Google didn't show it or they
// skipped it, try again later.
const ASK_AT = [3, 10, 25];
// A moment after the story ends, so it doesn't land on top of the coin toast.
const DELAY_MS = 2500;

let StoreReview = null;
try {
  StoreReview = require('expo-store-review');
} catch (e) {
  // Not in this build: just never ask.
}

export async function noteStoryFinished() {
  try {
    const finished = Number(await AsyncStorage.getItem(FINISHED_KEY) || 0) + 1;
    await AsyncStorage.setItem(FINISHED_KEY, String(finished));
    if (!ASK_AT.includes(finished) || !StoreReview) return;
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, DELAY_MS);
  } catch (e) {
    // A rating prompt must never get in the way of listening.
  }
}
