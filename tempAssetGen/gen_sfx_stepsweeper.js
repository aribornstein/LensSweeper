const fs = require('fs');
const path = require('path');
const audio = require('/Users/aribornstein/.codex/plugins/cache/ls-extensions/ls-clad/local/skills/build-sfx/tools');

const PROJECT_ASSETS_SFX = '/Users/aribornstein/Documents/Map Pointer/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function write(name, buffer) {
  audio.fadeOut(buffer, 0.008);
  const mastered = audio.mix_bus.masterChain(buffer, { normalize: 'peak' });
  audio.WavBuilder.write(mastered, path.join(PROJECT_ASSETS_SFX, `${name}.wav`));
}

write('StepReveal', audio.sfx_presets.uiBlip({ pitch: 2 }));
write('FlagToggle', audio.sfx_presets.uiToggle({ on: true, pitch: -1 }));
write('MineHit', audio.sfx_presets.explosion({ size: 0.45, retro: false }));
write('RoomCleared', audio.sfx_presets.uiSuccess({}));
