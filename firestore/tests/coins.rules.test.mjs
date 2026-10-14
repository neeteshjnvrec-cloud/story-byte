/**
 * Security-rule tests for coins (firestore/firestore.rules.json): normal use
 * and the ways a client could try to cheat. Runs against the Firestore
 * emulator (needs Java):
 *
 *   cd firestore/tests && npm i --no-save @firebase/rules-unit-testing@4 firebase@11 firebase-tools@14
 *   npx firebase emulators:exec --only firestore --project demo-coins "node --test coins.rules.test.mjs"
 *
 * (emulator on 127.0.0.1:8085, see firebase.json here).
 */
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, writeBatch, serverTimestamp, increment, Timestamp, deleteDoc, collection, addDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-coins',
  firestore: { rules: readFileSync(new URL('../firestore.rules.json', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
});
const today = Math.floor((Date.now() + 19800000) / 86400000);
const db = (uid) => env.authenticatedContext(uid).firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

function walletData(over = {}) {
  return { balance: 10, streak: 0, lastCheckInDay: 0, finishDay: 0, finishCount: 0, inviteCode: 'CODE01',
    invitedBy: null, inviteCount: 0, createdAt: Timestamp.now(), lastUnlock: null, lastFinish: null, ...over };
}
async function seedWallet(uid, over = {}) {
  await seed((f) => setDoc(doc(f, 'wallets', uid), walletData(over)));
}
async function seedStory(id, data) { await seed((f) => setDoc(doc(f, 'stories', id), data)); }

test.beforeEach(async () => { await env.clearFirestore(); });
test.after(async () => { await env.cleanup(); });

test('a new wallet starts with exactly 10 coins and its own invite code', async () => {
  const f = db('alice');
  const make = (balance, code = 'ALICE1', codeUid = 'alice') => {
    const b = writeBatch(f);
    b.set(doc(f, 'inviteCodes', code), { uid: codeUid });
    b.set(doc(f, 'wallets', 'alice'), { ...walletData({ inviteCode: code, balance }), createdAt: serverTimestamp() });
    return b.commit();
  };
  await assertFails(make(1000));
  await assertFails(make(10, 'BOB001', 'bob'));
  await assertSucceeds(make(10));
  await assertFails(deleteDoc(doc(f, 'wallets', 'alice')));
  await assertFails(getDoc(doc(db('bob'), 'wallets', 'alice')));
});

test('daily check-in: once a day, 5 coins, 25 on every 7th streak day', async () => {
  await seedWallet('alice', { balance: 10 });
  const w = doc(db('alice'), 'wallets', 'alice');
  await assertFails(updateDoc(w, { balance: 25, streak: 1, lastCheckInDay: today }));
  await assertSucceeds(updateDoc(w, { balance: 15, streak: 1, lastCheckInDay: today }));
  await assertFails(updateDoc(w, { balance: 20, streak: 2, lastCheckInDay: today }));
  await assertFails(updateDoc(w, { balance: 20, streak: 2, lastCheckInDay: today + 1 }));

  await seedWallet('bob', { balance: 0, streak: 6, lastCheckInDay: today - 1 });
  const wb = doc(db('bob'), 'wallets', 'bob');
  await assertFails(updateDoc(wb, { balance: 5, streak: 7, lastCheckInDay: today }));
  await assertSucceeds(updateDoc(wb, { balance: 25, streak: 7, lastCheckInDay: today }));

  await seedWallet('carol', { balance: 0, streak: 5, lastCheckInDay: today - 2 });
  const wc = doc(db('carol'), 'wallets', 'carol');
  await assertFails(updateDoc(wc, { balance: 5, streak: 6, lastCheckInDay: today }));
  await assertSucceeds(updateDoc(wc, { balance: 5, streak: 1, lastCheckInDay: today }));
});

test('unlocking a long episode costs its server price, once, and opens its audio', async () => {
  await seedStory('ep1', { title: 'Ep', isLongEpisode: true, priceCoins: 10 });
  await seedStory('free1', { title: 'Free' });
  await seedStory('comm1', { title: 'C', isLongEpisode: true, isCommunityStory: true, priceCoins: 10 });
  await seed((f) => setDoc(doc(f, 'premium_audio', 'ep1'), { audioUrl: 'https://x/secret.mp3' }));
  await seedWallet('alice', { balance: 15 });
  const f = db('alice');
  await assertFails(getDoc(doc(f, 'premium_audio', 'ep1')));
  const unlock = (sid, balance, price) => {
    const b = writeBatch(f);
    b.update(doc(f, 'wallets', 'alice'), { balance, lastUnlock: sid });
    b.set(doc(f, 'wallets', 'alice', 'unlocks', sid), { price, at: serverTimestamp() });
    return b.commit();
  };
  await assertFails(unlock('ep1', 14, 1));
  await assertFails(unlock('free1', 15, 0));
  await assertFails(unlock('comm1', 5, 10));
  await assertFails(updateDoc(doc(f, 'wallets', 'alice'), { balance: 5, lastUnlock: 'ep1' }));
  await assertSucceeds(unlock('ep1', 5, 10));
  await assertSucceeds(getDoc(doc(f, 'premium_audio', 'ep1')));
  await assertFails(unlock('ep1', -5, 10));
  await seedStory('ep2', { title: 'Ep2', isLongEpisode: true, priceCoins: 10 });
  await assertFails(unlock('ep2', -5, 10));
});

test('finishing a story pays 2 coins, once per story, up to 5 a day', async () => {
  await seedStory('s1', { title: 'S1' });
  await seedStory('s2', { title: 'S2' });
  await seed((f) => setDoc(doc(f, 'users', 'alice', 'progress', 's1'), { progress: 0.99 }));
  await seed((f) => setDoc(doc(f, 'users', 'alice', 'progress', 's2'), { progress: 0.4 }));
  await seedWallet('alice', { balance: 10 });
  const f = db('alice');
  const finish = (sid, balance, count) => {
    const b = writeBatch(f);
    b.update(doc(f, 'wallets', 'alice'), { balance, finishDay: today, finishCount: count, lastFinish: sid });
    b.set(doc(f, 'wallets', 'alice', 'finished', sid), { at: serverTimestamp() });
    return b.commit();
  };
  await assertFails(finish('s2', 12, 1)); // not actually finished
  await assertFails(finish('s1', 20, 1)); // too many coins
  await assertSucceeds(finish('s1', 12, 1));
  await assertFails(finish('s1', 14, 2)); // same story again
  await seedStory('s3', { title: 'S3' });
  await seed((f2) => setDoc(doc(f2, 'users', 'alice', 'progress', 's3'), { progress: 1 }));
  await seedWallet('alice', { balance: 20, finishDay: today, finishCount: 5 });
  await assertFails(finish('s3', 22, 6)); // daily cap
});

test('invites: invitee +20 and inviter +30, once, within 7 days', async () => {
  await seedWallet('inviter', { balance: 0, inviteCode: 'INVITE' });
  await seedWallet('newbie', { balance: 10 });
  const f = db('newbie');
  const redeem = (inviter, mine = 30, newBalance = 30) => {
    const b = writeBatch(f);
    b.update(doc(f, 'wallets', 'newbie'), { balance: newBalance, invitedBy: inviter });
    b.update(doc(f, 'wallets', inviter), { balance: increment(mine), inviteCount: increment(1) });
    return b.commit();
  };
  await assertFails(redeem('inviter', 100));
  await assertFails(redeem('inviter', 30, 1000));
  await assertFails(updateDoc(doc(f, 'wallets', 'inviter'), { balance: increment(30), inviteCount: increment(1) }));
  await assertSucceeds(redeem('inviter'));
  await assertFails(redeem('inviter', 30, 50));
  let inviter;
  await env.withSecurityRulesDisabled(async (ctx) => { inviter = (await getDoc(doc(ctx.firestore(), 'wallets', 'inviter'))).data(); });
  assert.strictEqual(inviter.balance, 30);
  assert.strictEqual(inviter.inviteCount, 1);

  await seedWallet('self', { balance: 10 });
  const fs = db('self');
  const b = writeBatch(fs);
  b.update(doc(fs, 'wallets', 'self'), { balance: 30, invitedBy: 'self' });
  await assertFails(b.commit());

  await seedWallet('old', { balance: 10, createdAt: Timestamp.fromMillis(Date.now() - 8 * 86400000) });
  const fo = db('old');
  const b2 = writeBatch(fo);
  b2.update(doc(fo, 'wallets', 'old'), { balance: 30, invitedBy: 'inviter' });
  b2.update(doc(fo, 'wallets', 'inviter'), { balance: increment(30), inviteCount: increment(1) });
  await assertFails(b2.commit());
});

test("invites: the friend adds the inviter's +30 history entry, only while redeeming", async () => {
  await seedWallet('inviter', { balance: 0, inviteCode: 'INVITE' });
  await seedWallet('newbie', { balance: 10 });
  await seedWallet('other', { balance: 10 });
  const f = db('newbie');
  const entry = (id = 'invite_newbie', data = {}) => doc(f, 'wallets', 'inviter', 'ledger', id);
  const redeem = (id, data) => {
    const b = writeBatch(f);
    b.update(doc(f, 'wallets', 'newbie'), { balance: 30, invitedBy: 'inviter' });
    b.update(doc(f, 'wallets', 'inviter'), { balance: increment(30), inviteCount: increment(1) });
    b.set(entry(id), { type: 'invite', amount: 30, at: serverTimestamp(), ...data });
    return b.commit();
  };
  // Not on its own, not for more coins, not under another id, not with extra fields.
  await assertFails(setDoc(entry(), { type: 'invite', amount: 30, at: serverTimestamp() }));
  await assertFails(redeem('invite_newbie', { amount: 300 }));
  await assertFails(redeem('invite_someone', {}));
  await assertFails(redeem('invite_newbie', { title: 'x' }));
  await assertSucceeds(redeem('invite_newbie', {}));
  // Once: the friend has now been invited, and the entry can't be rewritten.
  await assertFails(setDoc(entry(), { type: 'invite', amount: 30, at: serverTimestamp() }));
  // Another user can't write into the inviter's history either.
  await assertFails(setDoc(doc(db('other'), 'wallets', 'inviter', 'ledger', 'invite_other'), { type: 'invite', amount: 30, at: serverTimestamp() }));
  // The inviter can read it.
  let got;
  await env.withSecurityRulesDisabled(async (ctx) => { got = (await getDoc(doc(ctx.firestore(), 'wallets', 'inviter', 'ledger', 'invite_newbie'))).data(); });
  assert.strictEqual(got.amount, 30);
});

test('history entries and invite codes', async () => {
  const f = db('alice');
  await assertSucceeds(addDoc(collection(f, 'wallets', 'alice', 'ledger'), { type: 'checkin', amount: 5, at: serverTimestamp() }));
  await assertFails(addDoc(collection(f, 'wallets', 'alice', 'ledger'), { type: 'hack', amount: 5, at: serverTimestamp() }));
  await assertFails(addDoc(collection(f, 'wallets', 'bob', 'ledger'), { type: 'checkin', amount: 5, at: serverTimestamp() }));
  await assertFails(setDoc(doc(f, 'inviteCodes', 'STEAL1'), { uid: 'bob' }));
  await assertSucceeds(setDoc(doc(f, 'inviteCodes', 'ALICE2'), { uid: 'alice' }));
  await assertFails(setDoc(doc(db('bob'), 'inviteCodes', 'ALICE2'), { uid: 'bob' }));
});

test('existing rules still work: progress is owner-only', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice', 'progress', 's1'), { progress: 0.5 }));
  await assertFails(setDoc(doc(db('bob'), 'users', 'alice', 'progress', 's1'), { progress: 0.5 }));
});
