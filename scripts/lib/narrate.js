/**
 * edge-tts narration, shared by build-stories.js and remake-short.js.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = [['edge-tts', []], ['python3', ['-m', 'edge_tts']], ['uvx', ['edge-tts']]];
// `subsOut`, when given, asks edge-tts for a word-timed .srt alongside the
// mp3 (drives narration-synced captions/scene timing in the video — see
// lib/video-scenes.js and lib/subtitles.js). Best-effort only: if a
// --write-subtitles attempt fails on every EDGE candidate (e.g. an older
// build without the flag), we retry without it rather than let an
// enhancement break audio synthesis, which every story needs regardless.
function synth(text, slot, out, subsOut) {
  const txt = path.join(os.tmpdir(), `sb-${Date.now()}.txt`);
  fs.writeFileSync(txt, text, 'utf8');
  const baseArgs = ['--voice', slot.voice, '--file', txt, '--write-media', out];
  if (slot.rate) baseArgs.push(`--rate=${slot.rate}`);

  let err;
  const attempt = (args) => {
    for (const [cmd, pre] of EDGE) {
      try { try { fs.existsSync(out) && fs.unlinkSync(out); } catch (e) {}
        execFileSync(cmd, [...pre, ...args], { stdio: 'pipe' });
        if (fs.existsSync(out) && fs.statSync(out).size > 1024) return true;
      } catch (e) { err = e; }
    }
    return false;
  };

  const ok = (subsOut && attempt([...baseArgs, '--write-subtitles', subsOut])) || attempt(baseArgs);

  try { fs.unlinkSync(txt); } catch (e) {}
  if (!ok) throw new Error('edge-tts failed: ' + (err && err.message));
  return { subtitlesPath: subsOut && fs.existsSync(subsOut) ? subsOut : null };
}

module.exports = { synth };
