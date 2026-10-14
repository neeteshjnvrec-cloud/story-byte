// Coins: the wallet's reads and writes. Every coin movement here is also
// checked by the Firestore security rules (firestore/firestore.rules.json,
// tested in firestore/tests/coins.rules.test.mjs) against the server's
// clock and server-written prices, so these functions only ever ask for
// what the rules allow; the app has no server (Spark plan).
//
//   wallets/{uid}                 balance, streak, check-in day, invite code…
//   wallets/{uid}/unlocks/{id}    long episodes this listener has unlocked
//   wallets/{uid}/finished/{id}   stories that already paid a finish reward
//   wallets/{uid}/ledger/{auto}   coin history shown in the app
//   inviteCodes/{CODE}            invite code -> owner uid
//   premium_audio/{id}            a paid episode's audio, readable once unlocked

import {
  collection, doc, getDoc, getDocs, onSnapshot, runTransaction, writeBatch,
  serverTimestamp, increment, query, orderBy, limit as fbLimit, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export const WELCOME_COINS = 10;
export const CHECKIN_COINS = 5;
export const STREAK_BONUS_COINS = 25; // every 7th day in a row
export const FINISH_COINS = 2;
export const FINISHES_PER_DAY = 5;
export const INVITEE_COINS = 20;
export const INVITER_COINS = 30;
export const INVITE_WINDOW_DAYS = 7;

/** Day number in India time, the same day boundary the rules use. */
export function istDay(now = Date.now()) {
  return Math.floor((now + 19800000) / 86400000);
}

/** Coins today's check-in gives for a streak that reaches `streak`. */
export function checkInReward(streak) {
  return streak % 7 === 0 ? STREAK_BONUS_COINS : CHECKIN_COINS;
}

/** The streak a check-in today would reach. */
export function nextStreak(wallet, today = istDay()) {
  if (!wallet) return 1;
  return wallet.lastCheckInDay === today - 1 ? (wallet.streak || 0) + 1 : 1;
}

export function hasCheckedInToday(wallet, today = istDay()) {
  return !!wallet && wallet.lastCheckInDay === today;
}

export function finishesLeftToday(wallet, today = istDay()) {
  if (!wallet) return FINISHES_PER_DAY;
  return wallet.finishDay === today ? Math.max(0, FINISHES_PER_DAY - (wallet.finishCount || 0)) : FINISHES_PER_DAY;
}

export function canRedeemInvite(wallet) {
  if (!wallet || wallet.invitedBy) return false;
  const created = wallet.createdAt?.toMillis?.();
  return !created || Date.now() - created < INVITE_WINDOW_DAYS * 86400000;
}

/** A paid long episode (priced by the pipeline). */
export function isPaidStory(story) {
  return !!story && story.isLongEpisode === true && Number(story.priceCoins) > 0 && !story.isCommunityStory;
}

const walletRef = (uid) => doc(db, 'wallets', uid);
const ledgerEntry = (uid) => doc(collection(db, 'wallets', uid, 'ledger'));

// Unambiguous characters only (no 0/O, 1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newInviteCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

/** Creates the wallet (10 welcome coins and an invite code) if it doesn't exist yet. */
export async function ensureWallet(uid) {
  const snap = await getDoc(walletRef(uid));
  if (snap.exists()) return snap.data();
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newInviteCode();
    const batch = writeBatch(db);
    batch.set(doc(db, 'inviteCodes', code), { uid });
    batch.set(walletRef(uid), {
      balance: WELCOME_COINS, streak: 0, lastCheckInDay: 0, finishDay: 0, finishCount: 0,
      inviteCode: code, invitedBy: null, inviteCount: 0, createdAt: serverTimestamp(),
      lastUnlock: null, lastFinish: null,
    });
    batch.set(ledgerEntry(uid), { type: 'welcome', amount: WELCOME_COINS, at: serverTimestamp() });
    try {
      await batch.commit();
      return (await getDoc(walletRef(uid))).data();
    } catch (e) {
      lastError = e; // most likely the code was already taken: try another
      const again = await getDoc(walletRef(uid));
      if (again.exists()) return again.data();
    }
  }
  throw lastError;
}

export function subscribeWallet(uid, onChange) {
  return onSnapshot(walletRef(uid), (snap) => onChange(snap.exists() ? snap.data() : null), () => {});
}

/** Ids of the long episodes this listener has unlocked. */
export async function getUnlockedIds(uid) {
  const snap = await getDocs(collection(db, 'wallets', uid, 'unlocks'));
  return new Set(snap.docs.map((d) => d.id));
}

export async function getHistory(uid, max = 30) {
  const snap = await getDocs(query(collection(db, 'wallets', uid, 'ledger'), orderBy('at', 'desc'), fbLimit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Today's check-in. Returns { coins, streak }, or null if already done today. */
export async function checkIn(uid) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(walletRef(uid));
    if (!snap.exists()) throw new Error('no-wallet');
    const w = snap.data();
    const today = istDay();
    if (w.lastCheckInDay === today) return null;
    const streak = nextStreak(w, today);
    const coins = checkInReward(streak);
    tx.update(walletRef(uid), { balance: w.balance + coins, streak, lastCheckInDay: today });
    tx.set(ledgerEntry(uid), { type: 'checkin', amount: coins, at: serverTimestamp() });
    return { coins, streak };
  });
}

/**
 * Unlocks a long episode for its price. Throws an error with code
 * 'not-enough-coins' (and .needed) when the balance is too low.
 */
export async function unlockStory(uid, story) {
  return runTransaction(db, async (tx) => {
    const [walletSnap, storySnap, unlockSnap] = await Promise.all([
      tx.get(walletRef(uid)),
      tx.get(doc(db, 'stories', story.id)),
      tx.get(doc(db, 'wallets', uid, 'unlocks', story.id)),
    ]);
    if (unlockSnap.exists()) return { alreadyUnlocked: true };
    if (!walletSnap.exists() || !storySnap.exists()) throw new Error('not-found');
    const price = Number(storySnap.data().priceCoins) || 0;
    const balance = walletSnap.data().balance || 0;
    if (balance < price) {
      const err = new Error('not-enough-coins');
      err.code = 'not-enough-coins';
      err.needed = price - balance;
      throw err;
    }
    tx.update(walletRef(uid), { balance: balance - price, lastUnlock: story.id });
    tx.set(doc(db, 'wallets', uid, 'unlocks', story.id), { price, at: serverTimestamp() });
    tx.set(ledgerEntry(uid), { type: 'unlock', amount: -price, at: serverTimestamp(), storyId: story.id, title: String(story.title || '').slice(0, 120) });
    return { price };
  });
}

/** The audio URL of an unlocked paid episode, or null if it isn't unlocked. */
export async function getPremiumAudioUrl(storyId) {
  try {
    const snap = await getDoc(doc(db, 'premium_audio', storyId));
    return snap.exists() ? snap.data().audioUrl || null : null;
  } catch {
    return null; // not unlocked: the rules deny the read
  }
}

/**
 * 2 coins for listening to a story to the end: once per story, at most 5 a
 * day. Returns the coins paid (0 when it doesn't qualify).
 */
export async function rewardFinish(uid, story) {
  if (!story?.id) return 0;
  // The rules check the saved position, so record the finish first.
  await setDoc(doc(db, 'users', uid, 'progress', story.id), { progress: 1, lastUpdated: serverTimestamp() }, { merge: true });
  return runTransaction(db, async (tx) => {
    const [walletSnap, finishedSnap] = await Promise.all([
      tx.get(walletRef(uid)),
      tx.get(doc(db, 'wallets', uid, 'finished', story.id)),
    ]);
    if (!walletSnap.exists() || finishedSnap.exists()) return 0;
    const w = walletSnap.data();
    const today = istDay();
    const count = w.finishDay === today ? (w.finishCount || 0) + 1 : 1;
    if (count > FINISHES_PER_DAY) return 0;
    tx.update(walletRef(uid), { balance: w.balance + FINISH_COINS, finishDay: today, finishCount: count, lastFinish: story.id });
    tx.set(doc(db, 'wallets', uid, 'finished', story.id), { at: serverTimestamp() });
    tx.set(ledgerEntry(uid), { type: 'finish', amount: FINISH_COINS, at: serverTimestamp(), storyId: story.id, title: String(story.title || '').slice(0, 120) });
    return FINISH_COINS;
  });
}

/**
 * Redeems a friend's invite code: 20 coins here, 30 for the friend.
 * Throws an Error whose message is a user-facing reason.
 */
export async function redeemInvite(uid, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(code)) throw new Error('That doesn’t look like an invite code.');
  const codeSnap = await getDoc(doc(db, 'inviteCodes', code));
  if (!codeSnap.exists()) throw new Error('No one has that invite code. Check it and try again.');
  const inviter = codeSnap.data().uid;
  if (inviter === uid) throw new Error('That’s your own invite code. Share it with friends instead.');
  const mine = (await getDoc(walletRef(uid))).data();
  if (!mine) throw new Error('Your coin wallet isn’t ready yet. Try again in a moment.');
  if (mine.invitedBy) throw new Error('You’ve already used an invite code.');
  if (!canRedeemInvite(mine)) throw new Error(`Invite codes can only be used in your first ${INVITE_WINDOW_DAYS} days.`);
  const batch = writeBatch(db);
  batch.update(walletRef(uid), { balance: increment(INVITEE_COINS), invitedBy: inviter });
  batch.update(walletRef(inviter), { balance: increment(INVITER_COINS), inviteCount: increment(1) });
  batch.set(ledgerEntry(uid), { type: 'invited', amount: INVITEE_COINS, at: serverTimestamp() });
  try {
    await batch.commit();
  } catch (e) {
    throw new Error('This invite code can’t be used any more (each friend can invite up to 20 people).');
  }
  return INVITEE_COINS;
}
