/**
 * Per-genre gradient/accent theme (carousel fallback cards) and mood phrase
 * — folded into every generated scene prompt (carousel AND video) so
 * bespoke art stays visually consistent with the story's tone wherever it's
 * used.
 */
const GENRE_THEME = {
  romance: { from: '#5c1a3a', to: '#220b16', accent: '#ff8fab', ink: '#2a0b1c', mood: 'warm, golden, tender, intimate' },
  mystery: { from: '#1c2140', to: '#080a16', accent: '#8fa0ff', ink: '#12163a', mood: 'moody, atmospheric, muted tones, fog' },
  drama: { from: '#3a2417', to: '#180d07', accent: '#ffc98b', ink: '#3a2417', mood: 'warm cinematic, earthy tones' },
  fantasy: { from: '#0f3a34', to: '#051815', accent: '#7fe0c0', ink: '#0c2b26', mood: 'magical, glowing, otherworldly' },
  thriller: { from: '#3a1414', to: '#140505', accent: '#ff6f61', ink: '#3a1414', mood: 'tense, shadowy, high-contrast' },
  comedy: { from: '#4a3a00', to: '#1e1700', accent: '#ffd54f', ink: '#4a3a00', mood: 'bright, playful, whimsical' },
  horror: { from: '#181818', to: '#000000', accent: '#c62828', ink: '#ffffff', mood: 'dark, eerie, unsettling shadows' },
  adventure: { from: '#3a2a00', to: '#161000', accent: '#ffb300', ink: '#3a2a00', mood: 'sweeping, sunlit, epic vistas' },
  sleep: { from: '#101a3a', to: '#040713', accent: '#8fa8ff', ink: '#0e1638', mood: 'calm, dreamy nighttime, soft moonlight' },
  motivation: { from: '#3a2900', to: '#161000', accent: '#ff9f1c', ink: '#3a2900', mood: 'bright, uplifting, golden light' },
  devotional: { from: '#3a2f0f', to: '#171205', accent: '#e0b84b', ink: '#3a2f0f', mood: 'serene, warm, sacred glow' },
  'slice-of-life': { from: '#0f3a1a', to: '#051505', accent: '#8bd17c', ink: '#123a1e', mood: 'cozy, everyday, soft natural light' },
  default: { from: '#241a12', to: '#0e0a06', accent: '#c99a5b', ink: '#241a12', mood: 'warm cinematic storybook' },
};

const theme = (genre) => GENRE_THEME[genre] || GENRE_THEME.default;

module.exports = { GENRE_THEME, theme };
