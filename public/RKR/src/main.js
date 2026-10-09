// Boot, game flow between the menus and gameplay, and the fixed-timestep main loop.
import { WIN_W, WIN_H, loadAtlas, loadFont, loadImage } from './engine.js';
import { GameScene, prepareLevel } from './game.js';
import { game, savedGame, options, achievements, loadPossiblePoints } from './model.js';
import { keys, onKeyDown, setTouchMode } from './input.js';
import * as menus from './menus.js';
import * as audio from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const uiRoot = document.getElementById('ui');
const PLAYABLE_CHAPTERS = menus.PLAYABLE_CHAPTERS;

let scene = null;
let paused = false;
let loadToken = 0;

// Keep the 480x320 menu layer scaled to the stage
function fitUI() { uiRoot.style.setProperty('--k', String(stage.clientWidth / WIN_W)); }
window.addEventListener('resize', fitUI);
fitUI();

// ------------------------------------------------------------------ boot
async function boot() {
  const ui = ['vignette-corner-half.png', 'death-loadScreen.jpg', 'btn-pause-up.png', 'btn-pause-down.png'];
  await Promise.all([
    loadAtlas('timmyEnemiesMeta'),
    loadFont('currentScoreFont'),
    loadFont('pointNumbers'),
    loadPossiblePoints(),
    ...ui.map(u => loadImage(`assets/ui/${u}`)),
    document.fonts ? document.fonts.load('21px "Futura RKR"') : null,
  ]);
  if (options.showControls !== null && options.showControls !== undefined) setTouchMode(options.showControls);
  menus.initMenus({
    startLevel, resume, restart: () => startLevel(game.currentChapter, game.currentLevel), quit: endScene, next: nextLevel,
    inGame: () => !!scene,
    playChapter5: () => {
      if (PLAYABLE_CHAPTERS.includes(5)) menus.playLevel(5, 1);
      else menus.popup('COMING SOON', 'CHAPTER 5 IS STILL BEING PORTED', () => {}, { yes: 'OK', no: null });
    },
  });
  // Debug shortcuts (?unlock, ?level=2-3) are switched off in the public build
  const isPublic = !!document.querySelector('meta[name="rkr-public"]');
  const params = new URLSearchParams(isPublic ? '' : location.search);
  if (params.has('unlock')) savedGame.unlockAll();
  if (params.get('level')) {
    const [c, l] = params.get('level').split('-').map(Number);
    if (c && l) { startLevel(c, l); return; }
  }
  menus.showSplash();
}

// ------------------------------------------------------------------ level flow
async function startLevel(chapter, level, { death = false } = {}) {
  audio.unlock();
  endScene();
  game.currentChapter = chapter;
  game.currentLevel = level;
  menus.showLoading(death);
  const token = ++loadToken;
  const minDelay = new Promise(r => setTimeout(r, death ? 500 : 1000));
  try {
    const data = await prepareLevel(chapter, level);
    await minDelay;
    if (token !== loadToken) return;
    menus.hideMenus();
    scene = new GameScene(data, {
      onWin: () => setTimeout(levelComplete, 300),
      onRestart: () => { game.playerDidDie = true; startLevel(chapter, level, { death: true }); },
    });
    paused = false;
    last = performance.now();
  } catch (err) {
    console.error(err);
    menus.showLevelSelect(chapter);
    menus.popup('LOADING FAILED', String(err.message).toUpperCase().slice(0, 40), () => {}, { yes: 'OK', no: null });
  }
}

function endScene() {
  if (scene) { scene.destroy(); scene = null; }
  paused = false;
  game.gameplayIsPaused = false;
  audio.stopMusic();
}

function pause() {
  if (!scene || paused || scene.finished) return;
  paused = true;
  game.gameplayIsPaused = true;
  audio.pauseMusic(true);
  if (scene.timmy) scene.timmy.sprite.stopAllSounds();
  scene.stopAllSounds();
  scene.inputLayer.reset();
  menus.showPause();
}

function resume() {
  if (!paused) return;
  paused = false;
  game.gameplayIsPaused = false;
  audio.pauseMusic(false);
  menus.hidePause();
  last = performance.now();
}

function levelComplete() {
  const c = game.currentChapter, l = game.currentLevel;
  const points = game.points;
  const prevHigh = savedGame.highScore(c, l);
  const newHigh = points > prevHigh;
  if (newHigh) savedGame.setHighScore(c, l, points);
  if (game.lollipopCollected) savedGame.setLollipopCollected(c, l);
  reportProgressAchievements();
  const lastLevel = l >= game.levelsForChapter(c);
  menus.showLevelComplete({
    chapter: c, level: l, points, newHigh, highScore: Math.max(points, prevHigh),
    photo: game.lollipopCollected,
    hasNext: !lastLevel || c === 5 || PLAYABLE_CHAPTERS.includes(c + 1) || c === 4,
  });
}

// Star and photo achievements (checked when a level is completed, as in the original)
function reportProgressAchievements() {
  let totalStars = 0, photos = 0;
  const chapterIds = ['RKR_11', 'RKR_12', 'RKR_13', 'RKR_14'];
  for (let c = 1; c <= 4; c++) {
    let stars = 0;
    for (let l = 1; l <= 9; l++) {
      stars += savedGame.starsForScore(savedGame.highScore(c, l), c, l);
      if (savedGame.isLollipopCollected(c, l)) photos++;
    }
    totalStars += stars;
    achievements.report(chapterIds[c - 1], stars / 27);
  }
  const s5 = savedGame.starsForScore(savedGame.highScore(5, 1), 5, 1);
  if (savedGame.isLollipopCollected(5, 1)) photos++;
  achievements.report('RKR_31', (totalStars + s5) / 111);
  achievements.report('RKR_15', s5 / 3);
  achievements.report('RKR_19', photos / 37);
}

function nextLevel() {
  const c = game.currentChapter, l = game.currentLevel;
  endScene();
  if (c === 5) {
    menus.showCutscene('Ch6', () => menus.showCredits(() => menus.showMain('home')));
  } else if (l < game.levelsForChapter(c)) {
    startLevel(c, l + 1);
  } else if (PLAYABLE_CHAPTERS.includes(c + 1)) {
    game.currentChapter = c + 1;
    menus.playLevel(c + 1, 1);
  } else {
    game.currentChapter = c + 1;
    menus.showChapterSelect();
  }
}

onKeyDown(code => {
  if (!scene) return;
  if ((code === 'KeyP' || code === 'Escape') && !paused) pause();
  else if (code === 'KeyP' && paused && menus.isPauseOpen()) resume();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// The drawn iPhone's home button pauses (and resumes) the game
document.getElementById('home-button').addEventListener('click', () => {
  if (!scene) return;
  if (!paused) pause();
  else if (menus.isPauseOpen()) resume();
});

// ------------------------------------------------------------------ pointer input on the canvas
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * WIN_W, y: WIN_H - (e.clientY - r.top) / r.height * WIN_H };
}
canvas.addEventListener('pointerdown', e => {
  if (!scene || paused) return;
  audio.unlock();
  if (e.pointerType === 'touch' && options.showControls !== false) setTouchMode(true);
  const p = toGame(e);
  if (scene.hud.hitPause(p.x, p.y)) { pause(); return; }
  if (scene.inputLayer.pointerDown(e.pointerId, p.x, p.y)) { try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } }
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => { if (scene) { const p = toGame(e); scene.inputLayer.pointerMove(e.pointerId, p.x, p.y); } });
const up = e => { if (scene) scene.inputLayer.pointerUp(e.pointerId); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ------------------------------------------------------------------ main loop (fixed 60 Hz like the original)
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (scene && !paused) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) { scene.step(STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (scene) {
    const k = canvas.width / WIN_W;
    ctx.setTransform(k, 0, 0, -k, 0, canvas.height);
    scene.render(ctx);
  }
}
requestAnimationFrame(frame);

// Debug hook for automated testing in the browser console
window.__rkr = {
  get scene() { return scene; }, game, keys, startLevel, savedGame, menus, achievements,
  // Step the simulation without relying on requestAnimationFrame (works in hidden tabs)
  advance(seconds) { const n = Math.round(seconds / STEP); for (let i = 0; i < n && scene; i++) scene.step(STEP); },
};

boot().catch(err => {
  console.error(err);
  document.getElementById('ui').textContent = 'Failed to load: ' + err.message;
});
