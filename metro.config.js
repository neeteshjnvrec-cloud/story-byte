// Metro config for StoryByte — Expo defaults.
//
// NOTE: do NOT add a resolver blockList like /\/index\.js$/ to hide the backend
// Express server at the repo root. That pattern matches EVERY index.js in
// node_modules (react/index.js, react-native/index.js, …) and makes Metro fail
// with "package specifies a main module field that could not be resolved". The
// root index.js is never imported by the app (AppEntry → ./App.js), so Metro
// never bundles it — no exclusion is needed.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
