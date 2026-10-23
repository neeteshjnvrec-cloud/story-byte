/**
 * The firebase-tools version every deploy uses. Pinned: `npx firebase-tools`
 * fetched whatever was newest, and 15.34.1 (published 2026-10-21) failed the
 * next morning's hosting deploy with "403 Permission denied to get service
 * [firebasehosting.googleapis.com]" while 15.34.0 had deployed fine.
 * Upgrade on purpose: bump it here and in the workflows (grep for it).
 */
module.exports = { FIREBASE_TOOLS: 'firebase-tools@15.34.0' };
