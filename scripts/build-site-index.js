/**
 * Rebuilds public/index.html, sitemap.xml and robots.txt from the story
 * pages (lib/site-index.js). Runs before every hosting deploy, from
 * firebase.json's hosting.predeploy, so every pipeline that deploys keeps
 * the home page and sitemap current.
 *
 * Never fails: a problem here must not stop a deploy that ships the day's
 * audio. The previous files just stay.
 */
const path = require('path');

try {
  const { writeSiteIndex } = require('./lib/site-index');
  const { pages } = writeSiteIndex(path.resolve(__dirname, '..', 'public'));
  console.log(`🗺️  Home page + sitemap: ${pages} story pages`);
} catch (e) {
  console.warn(`⚠️  Home page / sitemap not rebuilt: ${e.message}`);
}
