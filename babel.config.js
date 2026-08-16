module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo automatically includes the correct Reanimated/Worklets
  // babel plugin when those packages are installed — do NOT add it manually
  // (doing so causes a "Reanimated plugin included twice" build error, and the
  // plugin path differs between Reanimated 3 and 4).
  return {
    presets: ['babel-preset-expo'],
  };
};
