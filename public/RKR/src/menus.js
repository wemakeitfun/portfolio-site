// The original UIKit menus, rebuilt from the game's Interface Builder layouts:
// splash, the sliding treehouse home (home / story-mode slots / options), chapter map with
// photo album, level select, cutscenes, loading, pause, level complete, credits, achievements.
import { el, box, img, label, button, backButton, title, frameAnim, range, fade, M } from './ui.js';
import { game, savedGame, options, achievements, ACHIEVEMENTS } from './model.js';
import { touchMode, setTouchMode } from './input.js';
import * as audio from './audio.js';

const ui = document.getElementById('ui');
let hooks = {};
let stops = [];          // animation timers owned by the current screens
let menuMusic = null;
export let PLAYABLE_CHAPTERS = [1, 2, 3, 4, 5];

export function initMenus(h) {
  hooks = h;
  achievements.onUnlock(toast);
  window.addEventListener('keydown', e => {
    if (e.code !== 'Escape') return;
    const back = [...ui.querySelectorAll('.screen:not(.hidden) .back-btn')].pop();
    if (back) { e.preventDefault(); back.click(); }
  });
}

// ------------------------------------------------------------------ plumbing
function screen(name, { overlay = false } = {}) {
  const s = el('div', ui, `screen ${overlay ? 'overlay' : ''}`);
  s.dataset.name = name;
  return s;
}
function clear(keepOverlaysOnly = false) {
  for (const s of [...ui.querySelectorAll('.screen')]) {
    if (keepOverlaysOnly && !s.classList.contains('overlay')) continue;
    s.remove();
  }
  if (!keepOverlaysOnly) { stops.forEach(f => f()); stops = []; }
}
export function hideMenus() { clear(); stopMenuMusic(); }
const anim = (i, names, d) => stops.push(frameAnim(i, names, d));
const back = (parent, fn, x, y) => { const b = backButton(parent, fn, x, y); b.classList.add('back-btn'); return b; };
// Move focus into a new screen only for keyboard users (no focus rings after mouse/touch)
let keyboardUser = false;
window.addEventListener('keydown', e => { if (e.code.startsWith('Arrow') || e.code === 'Tab' || e.code === 'Enter') keyboardUser = true; }, true);
window.addEventListener('pointerdown', () => { keyboardUser = false; }, true);
const focusFirst = s => setTimeout(() => {
  if (keyboardUser) s.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  else document.activeElement?.blur?.();
}, 50);

export function startMenuMusic() {
  if (menuMusic || !audio.settings.sfx) return;
  menuMusic = new audio.SoundSource('menu_ambience', true);
  menuMusic.play();
}
export function stopMenuMusic() { if (menuMusic) { menuMusic.stop(); menuMusic = null; } }

// ------------------------------------------------------------------ splash
export function showSplash() {
  clear();
  const s = screen('splash');
  img(s, 'splashBG.jpg', 0, 0, 480, 320);
  const logo = img(s, 'rainLogo.png', 159, 135, 162, 49);
  const tap = label(s, 'TAP TO START', 0, 262, 480, 21, { align: 'center', size: 12, cls: 'pulse' });
  const go = async () => {
    s.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
    audio.unlock();
    tap.remove();
    await fade(logo, 0, 700);
    showMain('home', false);
    const cover = screen('splash-cover', { overlay: true });
    img(cover, 'splashBG.jpg', 0, 0, 480, 320);
    await fade(cover, 0, 700);
    cover.remove();
  };
  s.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

// ------------------------------------------------------------------ main menus (one sliding scene)
const PANELS = { home: [0, -320], slots: [0, 0], options: [-480, -320] };

export function showMain(panel = 'home', animated = false) {
  clear();
  startMenuMusic();
  const s = screen('main');
  const bg = img(s, 'homeScreenBG.jpg', 0, 0, 960, 960, 'slide');
  const burst = box(s, -280, 0, 965, 960, 'slide');
  img(burst, 'homeSunburst.png', 0, 0, 965, 960, 'spin');
  const tree = img(s, 'homeScreenTree.png', 0, 0, 960, 960, 'slide');
  const cont = box(s, 0, 0, 960, 960, 'slide');

  const home = box(cont, 0, 320, 480, 320);
  const slots = box(cont, 0, 0, 480, 320);
  const opts = box(cont, 480, 320, 480, 320);

  const go = (name, anim = true) => {
    const [x, y] = PANELS[name];
    for (const n of [bg, tree, cont]) n.classList.toggle('instant', !anim);
    burst.classList.toggle('instant', !anim);
    for (const n of [bg, tree, cont]) { n.style.left = `${x}px`; n.style.top = `${y}px`; }
    // syncSunburst: keep the burst centred behind whichever panel is showing
    let bx = x, by = y;
    if (x === 0) bx -= 280;
    if (x === -480) bx += 35;
    if (y === 0) by -= 70;
    burst.style.left = `${bx}px`; burst.style.top = `${by}px`;
    s.classList.add('busy');
    setTimeout(() => s.classList.remove('busy'), anim ? 600 : 0);
    for (const [n, p] of [['home', home], ['slots', slots], ['options', opts]]) p.inert = n !== name;
    focusFirst(name === 'home' ? home : name === 'slots' ? slots : opts);
  };

  // Home
  const timmy = img(home, 'timmy_home_1.png', 50, 164, 63, 91);
  anim(timmy, range('timmy_home_', 1, 3), 0.7);
  const win = img(home, 'window-1.png', 391, 7, 55, 54);
  anim(win, range('window-', 1, 7), 1.5);
  const door = img(home, 'entrence-1.png', 355, 268, 95, 52);
  anim(door, range('entrence-', 1, 7), 1);
  label(home, 'WEB EDITION', 20, 279, 219, 21, { size: 9, color: '#353535' });
  const homeBtn = (t, yy, fn) => button(home, { x: 310, y: yy, w: 151, h: 45, up: 'homeScreenBtn_up.png', down: 'homeScreenBtn_over.png', title: t, onClick: fn });
  homeBtn('PLAY', 41, () => go('slots'));
  homeBtn('ACHIEVEMENTS', 94, () => showAchievements());
  homeBtn('OPTIONS', 146, () => go('options'));

  // Story mode (save slots)
  title(slots, 'STORY MODE', 25, 23, 169);
  const slotY = [70, 132, 196];
  const buildSlots = () => {
    slots.querySelectorAll('.slot').forEach(n => n.remove());
    for (let n = 1; n <= 3; n++) gameSlotButton(slots, 84, slotY[n - 1], n, buildSlots);
  };
  buildSlots();
  back(slots, () => go('home'));

  // Options
  buildOptions(opts, () => go('home'));

  go(panel, animated);
  return { go };
}

function gameSlotButton(parent, x, y, n, refresh) {
  const holder = box(parent, x, y, 312, 55, 'slot');
  const [ch, lv] = savedGame.progress(n);
  const isNew = ch === 1 && lv === 1 && !savedGame.isLevelCompleted(1, 1, n);
  const name = isNew ? '(Start New Game)' : ch < 5 ? `Chapter ${ch} - ${lv}` : 'Chapter 5';
  if (isNew) holder.style.opacity = '0.25';
  button(holder, {
    x: 0, y: 0, w: 312, h: 55, up: 'btn-GAMESELECT-up.png', down: 'btn-GAMESELECT-down.png', aria: `Game ${'ABC'[n - 1]}: ${name}`,
    onClick: () => { savedGame.selectSlot(n); showChapterSelect(); },
  });
  label(holder, 'ABC'[n - 1], 16, 17, 26, 21, { align: 'center', size: 12, cls: 'nohit' });
  label(holder, name, 75, 17, 163, 21, { align: 'center', size: 20, font: 'interstate-black', cls: 'nohit' });
  const del = button(holder, { x: 267, y: 10, w: 35, h: 35, up: 'btn-DELETE-up.png', down: 'btn-DELETE-down.png', aria: `Delete game ${'ABC'[n - 1]}`, cls: 'icon' });
  del.disabled = isNew;
  del.addEventListener('click', () => {
    popup('DELETE SAVED GAME', 'ARE YOU SURE?', yes => { if (yes) { savedGame.deleteSlot(n); refresh(); } });
  });
}

// Options panel (also used from the pause menu)
function buildOptions(p, onBack) {
  const main = box(p, 0, 0, 480, 320);
  const help = box(p, 0, 0, 480, 320, 'hidden');
  title(main, 'OPTIONS', 25, 23, 104);
  const toggle = (t, x, y, w, large, get, set) => {
    const sfx = large ? '-LARGE' : '';
    const b = button(main, { x, y, w, h: 41, title: t, onClick: () => { set(!get()); sync(); } });
    const sync = () => {
      const on = get();
      b.style.setProperty('--up', `url("${M(`btn-${on ? 'ON' : 'OFF'}-up${sfx}.png`)}")`);
      b.style.setProperty('--down', `url("${M(`btn-${on ? 'ON' : 'OFF'}-down${sfx}.png`)}")`);
      b.setAttribute('aria-pressed', String(on));
    };
    sync();
  };
  toggle('MUSIC', 96, 60, 137, false, () => audio.settings.music, v => audio.setMusicEnabled(v));
  toggle('SFX', 246, 60, 137, false, () => audio.settings.sfx, v => {
    audio.setSfxEnabled(v);
    if (!v) stopMenuMusic(); else if (!hooks.inGame?.()) startMenuMusic();
  });
  toggle('TOUCH CONTROLS', 96, 112, 287, true, () => touchMode, v => { setTouchMode(v); options.showControls = v; });
  button(main, { x: 96, y: 166, w: 287, h: 41, up: 'longBtn-up.png', down: 'longBtn-down.png', title: 'CONTROLS',
    onClick: () => { main.classList.add('hidden'); help.classList.remove('hidden'); focusFirst(help); } });
  button(main, { x: 96, y: 220, w: 287, h: 41, up: 'longBtn-up.png', down: 'longBtn-down.png', title: 'CREDITS', onClick: () => showCredits() });
  back(main, onBack);

  title(help, 'CONTROLS', 25, 20, 213);
  img(help, 'controls_dPad.png', 32, 67, 418, 164);
  label(help, 'KEYBOARD: ← → OR A / D TO RUN, SPACE OR ↑ TO JUMP, P TO PAUSE', 20, 232, 440, 18, { align: 'center', size: 9 });
  back(help, () => { help.classList.add('hidden'); main.classList.remove('hidden'); focusFirst(main); });
}

// ------------------------------------------------------------------ chapter map
export function showChapterSelect() {
  clear();
  startMenuMusic();
  const s = screen('chapters');
  const bg = img(s, 'gameMap.jpg', 0, 0, 480, 935);
  img(s, 'gameMap-TreeLayer.png', 0, 0, 480, 320);
  const win = img(s, 'window-1.png', 391, 5, 55, 54);
  anim(win, range('window-', 1, 7), 1.5);
  const door = img(s, 'entrence-1.png', 355, 268, 95, 52);
  anim(door, range('entrence-', 1, 7), 1);

  const chapters = box(s, 0, 0, 480, 320, 'slide-x');
  const album = box(s, -480, 0, 480, 320, 'slide-x');
  album.inert = true;

  // Pages: chapter 5 at the top (only once unlocked), chapter 1 at the bottom
  const ch5 = savedGame.isChapterUnlocked(5);
  const pages = ch5 ? [5, 4, 3, 2, 1] : [4, 3, 2, 1];
  const scroller = box(chapters, 0, 0, 480, 320, 'pager');
  for (const c of pages) chapterPage(el('div', scroller, 'page'), c, ch5);
  title(chapters, 'CHAPTERS', 25, 23, 169);
  const dots = box(chapters, 30, 142 - (pages.length * 14) / 2 + 18, 18, pages.length * 14, 'dots');
  pages.forEach(() => el('span', dots));
  const albumBtn = button(chapters, { x: 22, y: 255, w: 45, h: 45, up: 'photobook-btn.png', down: 'photobook-btn-down.png', aria: 'Photo album', cls: 'icon',
    onClick: () => toggleAlbum(true) });
  void albumBtn;

  const maxScroll = (pages.length - 1) * 320;
  const sync = () => {
    const top = scroller.scrollTop;
    bg.style.top = `${-615 + (maxScroll - top) * 615 / 1280}px`;
    const page = Math.round(top / 320);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === page));
  };
  scroller.addEventListener('scroll', sync);
  const startPage = Math.max(0, pages.indexOf(Math.min(game.currentChapter || 1, pages[0])));
  requestAnimationFrame(() => { scroller.scrollTop = startPage * 320; sync(); });
  sync();
  scroller.addEventListener('keydown', e => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      scroller.scrollBy({ top: e.code === 'ArrowUp' ? -320 : 320, behavior: 'smooth' });
    }
  });

  // Photo album
  title(album, 'PHOTO ALBUM', 25, 23, 169);
  img(album, 'album-bg.png', 81, 57, 318, 226);
  const holders = { 1: [118, 75, 1], 2: [98, 192, 3], 3: [168, 151, 4], 4: [264, 82, 2], 5: [299, 167, 5] };
  const photoView = box(s, 0, 0, 480, 320, 'photo-view hidden');
  const full = img(photoView, 'photo1-full.jpg', 117, 25, 247, 270);
  photoView.addEventListener('click', async () => { await fade(photoView, 0, 300); photoView.classList.add('hidden'); });
  for (const [c, [x, y, id]] of Object.entries(holders)) {
    const h = box(album, x, y, 66, 72, 'photo-holder');
    const isCh5 = Number(c) === 5 && savedGame.isLollipopCollected(5, 1);
    let found = 0;
    for (let i = 1; i <= 9; i++) {
      if (savedGame.isLollipopCollected(Number(c), i) || isCh5) {
        found++;
        img(h, `photo${id}-${i}.jpg`, ((i - 1) % 3) * 22, Math.floor((i - 1) / 3) * 24, 22, 24);
      }
    }
    if (found === 9 || isCh5) {
      button(album, { x, y, w: 66, h: 72, aria: `Chapter ${c} photo`, cls: 'icon', onClick: () => {
        full.src = M(`photo${id}-full.jpg`);
        photoView.style.opacity = '0';
        photoView.classList.remove('hidden');
        fade(photoView, 1, 400);
      } });
    }
  }

  let albumOpen = false;
  function toggleAlbum(open) {
    albumOpen = open;
    album.style.left = open ? '0px' : '-480px';
    chapters.style.left = open ? '480px' : '0px';
    album.inert = !open; chapters.inert = open;
    focusFirst(open ? album : chapters);
  }
  back(s, () => { if (albumOpen) toggleAlbum(false); else showMain('slots', false); });
  focusFirst(chapters);
}

function chapterPage(p, c, ch5Visible) {
  const unlocked = savedGame.isChapterUnlocked(c);
  const dim = unlocked ? 1 : 0.25;
  label(p, `CHAPTER ${c}`, 190, 110, 100, 21, { align: 'center', size: 10 }).style.opacity = dim;
  label(p, game.titleForChapter(c), 110, 127, 260, 21, { align: 'center', size: 20 }).style.opacity = dim;
  const btn = button(p, { x: 89, y: 101, w: 302, h: 117, up: 'btn-chapter-up.png', down: 'btn-chapter-down.png',
    aria: `Chapter ${c}: ${game.titleForChapter(c)}${unlocked ? '' : ' (locked)'}`,
    onClick: () => {
      game.currentChapter = c;
      if (c < 5) showLevelSelect(c);
      else hooks.playChapter5?.();
    } });
  btn.disabled = !unlocked;
  if (!unlocked) {
    img(p, 'icon-lock.png', 232, 164, 17, 20).style.opacity = '0.25';
  } else {
    let photos = 0, stars = 0;
    const n = game.levelsForChapter(c);
    for (let l = 1; l <= n; l++) {
      if (savedGame.isLollipopCollected(c, l)) photos++;
      stars += savedGame.starsForScore(savedGame.highScore(c, l), c, l);
    }
    label(p, 'SCORE', 214, 150, 52, 21, { size: 13, cls: 'nohit' });
    label(p, String(savedGame.highScoreForChapter(c)), 185, 177, 111, 21, { align: 'center', size: 17, cls: 'nohit' });
    label(p, `${photos}/${n}`, 321, 177, 42, 21, { align: 'center', size: 9, cls: 'nohit' });
    label(p, `${stars}/${n * 3}`, 116, 177, 42, 21, { align: 'center', size: 9, cls: 'nohit' });
    img(p, 'polaroid-icon.png', 331, 150, 22, 27, 'nohit');
    img(p, 'icon-star-up.png', 123, 147, 29, 27, 'nohit');
    if (c < 5) {
      for (let l = 1; l <= 9; l++) {
        const name = l === 1 ? 'icon-levelIndicater-left-up.png' : l === 9 ? 'icon-levelIndicater-right-up.png' : 'icon-levelIndicater-up.png';
        const x = l === 1 ? 115 : l === 9 ? 340 : 144 + (l - 2) * 28;
        img(p, name, x, 200, l === 1 || l === 9 ? 26 : 25, 11, 'nohit').style.opacity = savedGame.isLevelCompleted(c, l) ? '1' : '0.25';
      }
    }
  }
  const showUp = !(c === 5 || (c === 4 && !ch5Visible));
  if (showUp) img(p, 'icon-arrow-up.png', 235, 47, 11, 16, 'nohit');
  if (c !== 1) img(p, 'icon-arrow-down.png', 235, 257, 11, 16, 'nohit');
}

// ------------------------------------------------------------------ level select
export function showLevelSelect(ch = game.currentChapter) {
  clear();
  startMenuMusic();
  game.currentChapter = ch;
  const s = screen('levels');
  img(s, 'gameMap.jpg', 0, -153.75 * (5 - ch), 480, 935);
  label(s, game.titleForChapter(ch), 25, 23, 440, 21, { font: 'futura', size: 21 });
  const place = (l, cx, cy) => levelButton(s, cx - 63.5, cy - 26, ch, l);
  if (ch < 5) {
    let l = 1;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) place(l++, 100 + col * 140, 85 + row * 65);
  } else {
    place(1, 240, 150);
  }
  back(s, () => showChapterSelect());
  focusFirst(s);
}

function levelButton(parent, x, y, ch, l) {
  const holder = box(parent, x, y, 127, 52);
  const unlocked = savedGame.isLevelUnlocked(ch, l);
  const stars = savedGame.starsForScore(savedGame.highScore(ch, l), ch, l);
  const b = button(holder, { x: 0, y: 0, w: 127, h: 52, up: 'btn-levels-up.png', down: 'btn-levels-down.png',
    aria: unlocked ? `Level ${l}, ${stars} of 3 stars` : `Level ${l}, locked`,
    onClick: () => playLevel(ch, l) });
  if (!unlocked) {
    b.disabled = true;
    b.style.opacity = '0.25';
    img(holder, 'icon-lock.png', 55, 16, 17, 20, 'nohit').style.opacity = '0.25';
    return;
  }
  label(holder, `Level ${l}`, 14, 5, 75, 21, { size: 10, cls: 'nohit' });
  for (let i = 0; i < 3; i++) img(holder, 'icon-star-up.png', 14 + i * 24, 27, 18, 17, 'nohit').style.opacity = stars > i ? '1' : '0.25';
  img(holder, 'polaroid-icon.png', 94, 13, 22, 27, 'nohit').style.opacity = savedGame.isLollipopCollected(ch, l) ? '1' : '0.25';
}

// Level 1 of each chapter is preceded by that chapter's cutscene
export function playLevel(ch, l) {
  game.playerDidDie = false;
  if (l === 1) showCutscene(`Ch${ch}`, () => hooks.startLevel(ch, l));
  else hooks.startLevel(ch, l);
}

// ------------------------------------------------------------------ cutscenes
export function showCutscene(id, then) {
  clear();
  stopMenuMusic();
  audio.stopMusic();
  const s = screen('cutscene');
  const video = el('video', s, 'abs video');
  video.src = `assets/video/${id}.mp4`;
  video.playsInline = true;
  video.muted = !audio.settings.music && !audio.settings.sfx;
  const loadBG = img(s, 'loadingBG.jpg', 0, 0, 480, 320);
  const runner = img(s, 'run_1.png', 216, 135, 48, 50);
  anim(runner, range('run_', 1, 13), 0.65);
  const skip = button(s, { x: 415, y: 255, w: 40, h: 40, up: 'btn-skip-up.png', down: 'btn-skip-down.png', aria: 'Skip cutscene', cls: 'icon back-btn' });
  let done = false;
  const exit = async () => {
    if (done) return;
    done = true;
    skip.disabled = true;
    loadBG.style.opacity = '0';
    loadBG.classList.remove('hidden');
    await Promise.all([fade(loadBG, 1, 1000), fade(skip, 0, 1000)]);
    video.pause();
    then();
  };
  skip.addEventListener('click', exit);
  video.addEventListener('ended', () => {
    achievements.setStat(id, 1);
    if (['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6'].every(k => achievements.stat(k))) achievements.report('RKR_22', 1);
    exit();
  });
  video.addEventListener('playing', () => { fade(loadBG, 0, 500).then(() => loadBG.classList.add('hidden')); fade(runner, 0, 500); }, { once: true });
  video.addEventListener('error', exit);
  video.play().catch(() => { video.muted = true; video.play().catch(exit); });
  focusFirst(s);
}

// ------------------------------------------------------------------ loading (LoadingScene)
export function showLoading(death) {
  clear();
  stopMenuMusic();
  const s = screen('loading');
  if (death) {
    img(s, 'death-loadScreen.jpg', 0, 0, 480, 320);
  } else {
    img(s, 'loadingBG.jpg', 0, 0, 480, 320);
    const runner = img(s, 'run_1.png', 216, 130, 48, 50);
    runner.style.opacity = '0';
    fade(runner, 1, 1000);
    anim(runner, range('run_', 1, 13), 0.65);
  }
}

// ------------------------------------------------------------------ pause
export function showPause() {
  const s = screen('pause', { overlay: true });
  s.classList.add('dim');
  const main = box(s, 0, 0, 480, 320);
  title(main, 'PAUSE', 25, 23, 98);
  const blank = (t, y, fn) => button(main, { x: 172, y, w: 137, h: 41, up: 'btn-BLANK-up.png', down: 'btn-BLANK-down.png', title: t, onClick: fn });
  blank('RESTART', 57, () => { s.remove(); hooks.restart(); });
  blank('OPTIONS', 110, () => {
    main.classList.add('hidden');
    const o = box(s, 0, 0, 480, 320);
    buildOptions(o, () => { o.remove(); main.classList.remove('hidden'); focusFirst(main); });
    focusFirst(o);
  });
  blank('LEVELS', 164, () => { s.remove(); hooks.quit(); if (game.currentChapter === 5) showChapterSelect(); else showLevelSelect(); });
  blank('MAIN MENU', 217, () => { s.remove(); hooks.quit(); showMain('home'); });
  back(main, () => { s.remove(); hooks.resume(); });
  focusFirst(main);
}
export function hidePause() { ui.querySelector('.screen[data-name="pause"]')?.remove(); }
export function isPauseOpen() { return !!ui.querySelector('.screen[data-name="pause"]'); }

// ------------------------------------------------------------------ level complete
export function showLevelComplete(r) {
  const s = screen('complete', { overlay: true });
  s.classList.add('dim');
  label(s, 'LEVEL COMPLETE!', 91, 23, 299, 21, { align: 'center', font: 'futura', size: 21 });
  const lolly = img(s, 'levelCompletePhoto.png', 417, 22, 38, 38);
  lolly.style.opacity = '0.25';
  if (r.photo) fade(lolly, 1, 500);
  const starImgs = [
    img(s, 'img-star1-empty.png', 105, 61, 100, 95),
    img(s, 'img-star2-empty.png', 190, 52, 100, 95),
    img(s, 'img-start3-empty.png', 275, 60, 100, 95),
  ];
  label(s, 'YOUR SCORE', 188, 137, 104, 21, { align: 'center', size: 10 });
  const total = label(s, '0', 188, 154, 104, 31, { align: 'center', size: 27 });
  label(s, 'HIGH SCORE', 186, 189, 108, 21, { align: 'center', size: 10 });
  const high = label(s, String(r.highScore), 193, 206, 94, 31, { align: 'center', size: 27 });
  high.style.opacity = '0.5';
  if (r.newHigh) {
    high.classList.add('hidden');
    img(s, 'highScore-lvlComplete.png', 189, 209, 102, 20, 'pop-in');
  }
  const sumBtn = (t, x, fn) => button(s, { x, y: 258, w: 112, h: 40, up: 'btn-SUMMARYscreen-up.png', down: 'btn-SUMMARYscreen-down.png', title: t, onClick: fn });
  const lv = sumBtn('LEVELS', 60, () => { s.remove(); hooks.quit(); if (r.chapter === 5) showChapterSelect(); else showLevelSelect(r.chapter); });
  const rp = sumBtn('REPLAY', 185, () => { s.remove(); hooks.startLevel(r.chapter, r.level); });
  const nx = sumBtn('NEXT', 310, () => { s.remove(); hooks.next(); });
  if (!r.hasNext) nx.classList.add('hidden');
  for (const b of [lv, rp, nx]) b.disabled = true;

  // Count the score up (30 steps per second for ~1.5s) and pop each star as its threshold passes
  const thresholds = [1, 2, 3].map(i => savedGame.pointsForStars(i, r.chapter, r.level));
  const inc = Math.max(1, r.points / 30);
  let shown = 0;
  const lit = [false, false, false];
  const t = setInterval(() => {
    shown = Math.min(r.points, shown + inc);
    total.textContent = String(Math.floor(shown));
    thresholds.forEach((th, i) => {
      if (!lit[i] && th > 0 && shown >= th) {
        lit[i] = true;
        starImgs[i].src = M(`img-star${i + 1}-filled.png`);
        starImgs[i].classList.add('pop-in');
        audio.playEffect(['star_one', 'star_two', 'star_three'][i]);
      }
    });
    if (shown >= r.points) {
      clearInterval(t);
      for (const b of [lv, rp, nx]) b.disabled = false;
      focusFirst(s);
    }
  }, 50);
  stops.push(() => clearInterval(t));
  audio.playEffect('point_counter');
}

// ------------------------------------------------------------------ credits
const CREDIT_ACHIEVEMENTS = [['mediarain.com', 'RKR_26'], ['frisbienyc.com', 'RKR_28'], ['crossborders.tv', 'RKR_27'],
  ['twitter.com', 'RKR_21'], ['facebook.com', 'RKR_20']];

export function showCredits(onDone) {
  const s = screen('credits', { overlay: true });
  const bg = img(s, 'credits-bg.jpg', 0, 0, 480, 935);
  const holder = box(s, 0, 0, 480, 320, 'credits-frame');
  const frame = el('iframe', holder);
  frame.title = 'Credits';
  frame.src = 'assets/credits/credits.html';
  title(s, 'CREDITS', 25, 23, 104);
  const wasMusic = !hooks.inGame?.();
  stopMenuMusic();
  audio.playMusic('credits_music_loop.mp3', true);
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    const st = doc.createElement('style');
    st.textContent = `@font-face{font-family:Interstate;src:url(../fonts/Interstate-Bold.ttf)}
      @font-face{font-family:Futura;src:url(../fonts/Futura-ExtraBold.ttf)}
      html,body{background:transparent!important;scrollbar-width:none}body::-webkit-scrollbar{display:none}`;
    doc.head.appendChild(st);
    const win = frame.contentWindow;
    win.addEventListener('scroll', () => {
      const max = Math.max(1, doc.documentElement.scrollHeight);
      bg.style.top = `${-win.scrollY * (935 - 320) / max}px`;
    });
    doc.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      for (const [host, id] of CREDIT_ACHIEVEMENTS) if (a.href.includes(host)) achievements.report(id, 1);
      window.open(a.href, '_blank', 'noopener');
    });
  });
  back(s, () => {
    s.remove();
    audio.stopMusic();
    if (onDone) onDone();
    else if (wasMusic) startMenuMusic();
  });
  focusFirst(s);
}

// ------------------------------------------------------------------ achievements
export function showAchievements() {
  const s = screen('achievements', { overlay: true });
  img(s, 'credits-bg.jpg', 0, -300, 480, 935);
  title(s, 'ACHIEVEMENTS', 25, 23, 220);
  const count = ACHIEVEMENTS.filter(a => achievements.isEarned(a[0])).length;
  label(s, `${count} / ${ACHIEVEMENTS.length}`, 300, 23, 155, 21, { align: 'right', size: 13 });
  const list = box(s, 25, 56, 430, 192, 'ach-list');
  list.tabIndex = 0;
  list.setAttribute('aria-label', 'Achievements list');
  for (const [id, name, desc] of ACHIEVEMENTS) {
    const done = achievements.isEarned(id);
    const pct = achievements.percent(id);
    const row = el('div', list, `ach-row ${done ? 'done' : ''}`);
    const icon = el('img', row, 'ach-icon');
    icon.src = M(`${id}.png`);
    icon.alt = '';
    const text = el('div', row, 'ach-text');
    el('div', text, 'ach-name interstate-bold').textContent = name.toUpperCase();
    el('div', text, 'ach-desc interstate-regular').textContent = desc;
    if (!done && pct > 0) {
      const bar = el('div', text, 'ach-bar');
      el('div', bar).style.width = `${Math.round(pct * 100)}%`;
    }
  }
  back(s, () => s.remove());
  focusFirst(s);
}

// Achievement toast (BCAchievementNotification style)
const toastQueue = [];
let toasting = false;
export function toast(a) {
  toastQueue.push(a);
  if (!toasting) nextToast();
}
async function nextToast() {
  const a = toastQueue.shift();
  if (!a) { toasting = false; return; }
  toasting = true;
  const t = box(ui, 136, -44, 207, 38, 'toast');
  img(t, 'achievementBG.png', 0, 0, 207, 38);
  label(t, 'ACHIEVEMENT UNLOCKED!', 14, 5, 160, 12, { font: 'interstate-regular', size: 8, color: '#000' });
  label(t, a[1].toUpperCase(), 14, 16, 160, 16, { size: 10, color: '#000' });
  requestAnimationFrame(() => { t.style.top = '6px'; });
  await new Promise(r => setTimeout(r, 3000));
  t.style.top = '-44px';
  await new Promise(r => setTimeout(r, 400));
  t.remove();
  nextToast();
}

// ------------------------------------------------------------------ popup alert
export function popup(titleText, message, done, { yes = 'YES', no = 'NO' } = {}) {
  const s = screen('popup', { overlay: true });
  s.classList.add('dim');
  img(s, 'alert-bg.png', 79, 96, 322, 127);
  label(s, titleText, 114, 106, 252, 21, { align: 'center', size: 13 });
  label(s, message, 114, 131, 252, 21, { align: 'center', size: 11 });
  const close = v => { s.remove(); done(v); };
  if (no) {
    button(s, { x: 129, y: 162, w: 107, h: 41, up: 'alert-btn-up.png', down: 'alert-btn-down.png', title: yes, onClick: () => close(true) });
    button(s, { x: 244, y: 162, w: 107, h: 41, up: 'alert-btn-up.png', down: 'alert-btn-down.png', title: no, onClick: () => close(false), cls: 'back-btn' });
  } else {
    button(s, { x: 186, y: 162, w: 107, h: 41, up: 'alert-btn-up.png', down: 'alert-btn-down.png', title: yes, onClick: () => close(true), cls: 'back-btn' });
  }
  focusFirst(s);
}
