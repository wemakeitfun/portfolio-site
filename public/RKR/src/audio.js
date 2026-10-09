// Web Audio replacement for CocosDenshion's SimpleAudioEngine + the game's BGMusicPlayer.

const SFX_DIR = 'assets/sfx/';
const MUSIC_DIR = 'assets/music/';

let ctx = null;
let sfxGain = null;
const buffers = {};
const loading = {};
let music = null;
let musicName = null;

export const settings = { sfx: true, music: true };
try {
  const saved = JSON.parse(localStorage.getItem('rkr.audio') || 'null');
  if (saved) Object.assign(settings, saved);
} catch { /* storage unavailable */ }

export function saveSettings() {
  try { localStorage.setItem('rkr.audio', JSON.stringify(settings)); } catch { /* ignore */ }
}

// Must be called from a user gesture.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  flushPending();
}

const stem = name => name.replace(/\.(caf|m4a|mp3|wav)$/, '');

export function preload(names) {
  return Promise.all(names.map(load));
}

function load(name) {
  const key = stem(name);
  if (buffers[key]) return Promise.resolve(buffers[key]);
  if (loading[key]) return loading[key];
  loading[key] = fetch(SFX_DIR + key + '.m4a')
    .then(r => r.arrayBuffer())
    .then(data => new Promise((res, rej) => {
      const go = () => ctx.decodeAudioData(data, res, rej);
      if (ctx) go(); else pendingDecodes.push(go);
    }))
    .then(buf => (buffers[key] = buf))
    .catch(() => null);
  return loading[key];
}
const pendingDecodes = [];
export function flushPending() { while (ctx && pendingDecodes.length) pendingDecodes.shift()(); }

// Returns a handle with stop(); safe to call with sound disabled.
// adjustable: the volume can be changed while playing with handle.setVolume(v)
export function playEffect(name, { loop = false, volume = 1, rate = 1, adjustable = false } = {}) {
  const handle = {
    playing: false, stop() {}, source: null, volume, gainNode: null,
    setVolume(v) { this.volume = v; if (this.gainNode) this.gainNode.gain.value = v; },
  };
  if (!settings.sfx || !ctx) return handle;
  const key = stem(name);
  const start = buf => {
    if (!buf || handle.cancelled) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    if (rate !== 1) src.playbackRate.value = rate;
    let node = src;
    if (volume !== 1 || adjustable) {
      const g = ctx.createGain(); g.gain.value = handle.volume; src.connect(g); node = g;
      handle.gainNode = g;
    }
    node.connect(sfxGain);
    src.start();
    handle.source = src;
    handle.playing = true;
    src.onended = () => { handle.playing = false; };
  };
  handle.stop = () => {
    handle.cancelled = true;
    if (handle.source) { try { handle.source.stop(); } catch { /* already stopped */ } }
    handle.playing = false;
  };
  if (buffers[key]) start(buffers[key]); else load(name).then(start);
  return handle;
}

// A reusable looping sound source (CDSoundSource equivalent)
export class SoundSource {
  constructor(name, loop = true) { this.name = name; this.loop = loop; this.handle = null; load(name); }
  get isPlaying() { return !!(this.handle && (this.handle.playing || !this.handle.source) && !this.handle.cancelled); }
  play() { this.stop(); this.handle = playEffect(this.name, { loop: this.loop }); }
  stop() { if (this.handle) this.handle.stop(); this.handle = null; }
}

// Picks a random effect from a list (RandomAudioFXStore)
const lists = {};
export function addEffectsList(key, names) { lists[key] = names; names.forEach(load); }
export function playRandomEffect(key) {
  const l = lists[key];
  if (l && l.length) return playEffect(l[Math.floor(Math.random() * l.length)]);
  return null;
}
export function playEffectAt(key, index) {
  const l = lists[key];
  if (l && l.length) return playEffect(l[index % l.length]);
  return null;
}
export function effectsCount(key) { return lists[key] ? lists[key].length : 0; }

// ------------------------------------------------------------------ music
export function playMusic(name, loop = true) {
  stopMusic();
  musicName = name;
  if (!settings.music) return;
  music = new Audio(MUSIC_DIR + name);
  music.loop = loop;
  music.volume = 0.7;
  music.play().catch(() => {});
}
export function stopMusic() {
  if (music) { music.pause(); music.src = ''; music = null; }
}
export function pauseMusic(p) { if (music) { if (p) music.pause(); else music.play().catch(() => {}); } }
export function setMusicEnabled(on) {
  settings.music = on; saveSettings();
  if (!on) stopMusic(); else if (musicName) playMusic(musicName);
}
export function setSfxEnabled(on) { settings.sfx = on; saveSettings(); }
