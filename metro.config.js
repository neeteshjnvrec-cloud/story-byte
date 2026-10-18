// Metro config for StoryByte — Expo defaults.
//
// NOTE: do NOT add a resolver blockList like /\/index\.js$/: that pattern
// matches EVERY index.js in node_modules (react/index.js, react-native/index.js,
// …) and makes Metro fail with "package specifies a main module field that
// could not be resolved".
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
