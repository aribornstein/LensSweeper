const fs = require('fs');
const path = require('path');
const m = require('/Users/aribornstein/.codex/plugins/cache/ls-extensions/ls-clad/local/skills/build-music/tools');

const PROJECT_ASSETS_SFX = '/Users/aribornstein/Documents/Map Pointer/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

const genre = 'ambient';
const bpm = m.suggestTempo(genre);
const { chords, meta } = m.composeChords({ genre, voice: 'pad' });
const chordEvents = m.chordEvents(chords, { voice: 'pad', bars: 8, velocity: 38 });
const arpeggio = m.composeArpeggio({ chords, style: 'up-down', bars: 8, velocity: 26 });
const tracks = [
  m.track('pad', 'pad', chordEvents, { fx: { hpf: 90, lpf: 2600, reverb: 'largeHall', width: 1.1, gain: 0.44 } }),
  m.track('sparkle', 'vibraphone', arpeggio, { fx: { hpf: 300, lpf: 4200, delay: { time: 0.32, feedback: 0.18, wet: 0.16 }, reverb: 'plate', gain: 0.14 } })
];
const out = m.render(tracks, { bpm, duration: 24, master: { normalize: 'peak', glue: true, width: 1.05 } });
m.WavBuilder.write(out, path.join(PROJECT_ASSETS_SFX, 'BackgroundMusic.wav'));
console.log(JSON.stringify({ bpm, meta }));
