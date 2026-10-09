// GameModel + SavedGame port: scores, health, three save slots, stats and achievements (localStorage).

export const POINTS = {
  COIN: 100, HAMSTER: 150, SNAIL: 200, ZOMBIE: 200, GIGGLESNOUT: 200, BUNNY: 250,
  HEART_LEFT: 500, EXTRA_HEART: 500, LOLLIPOP: 1000,
  PANDASAURUS: 5000, ZORSICORN: 6000, MITCH: 10000,
};

const listeners = new Map();

export const game = {
  points: 0,
  health: 3,
  enemyComboCount: 1,
  enemiesKilledCount: 0,
  coinsCollectedCount: 0,
  bonusHeartsCount: 0,
  lollipopCollected: false,
  playerIsInvincible: false,
  gameplayIsPaused: false,
  playerDidDie: false,
  currentChapter: 1,
  currentLevel: 1,

  on(key, fn) { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); },
  off(key, fn) { listeners.get(key)?.delete(fn); },
  set(key, value) { this[key] = value; listeners.get(key)?.forEach(fn => fn(value)); },
  addPoints(n) { this.set('points', this.points + n); },
  addHealthBonus() { this.addPoints(this.health * POINTS.HEART_LEFT); },

  levelsForChapter(ch) { return ch === 5 ? 1 : 9; },
  titleForChapter(ch) {
    return ['', 'SHY TIMMY', 'THE ASCENT', "IT'S A TRAP", "MITCH'S TREEHOUSE", 'RUN KITTY RUN!'][ch] || 'UNKNOWN TITLE';
  },
};

// ------------------------------------------------------------------ storage helpers
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? Object.assign(fallback, JSON.parse(raw)) : fallback;
  } catch { return fallback; }   // storage unavailable: progress lasts for this session only
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ saved games (3 slots)
const SLOTS_KEY = 'rkr.slots.v1';
const emptySlot = () => ({ highScores: {}, lollipops: {} });
const slots = load(SLOTS_KEY, { current: 1, 1: emptySlot(), 2: emptySlot(), 3: emptySlot() });

// One-time migration: progress from the single-save version goes into slot A
try {
  const old = JSON.parse(localStorage.getItem('rkr.save.v1') || 'null');
  if (old && !slots.migrated) {
    Object.assign(slots[1].highScores, old.highScores || {});
    Object.assign(slots[1].lollipops, old.lollipops || {});
    slots.migrated = true;
    store(SLOTS_KEY, slots);
  }
} catch { /* nothing to migrate */ }

// Possible points per level (precomputed from the level files) — the basis for star ratings
let possible = {};
export async function loadPossiblePoints() {
  try { possible = await (await fetch('assets/levels/possible.json')).json(); } catch { possible = {}; }
}

const lk = (c, l) => `${c}_${l}`;
const slot = () => slots[slots.current];
const persist = () => store(SLOTS_KEY, slots);

export const savedGame = {
  get currentSlot() { return slots.current; },
  selectSlot(n) { slots.current = n; persist(); },
  deleteSlot(n) { slots[n] = emptySlot(); persist(); },
  slotData(n) { return slots[n]; },

  highScore(c, l, n = slots.current) { return slots[n].highScores[lk(c, l)] || 0; },
  setHighScore(c, l, s) { slot().highScores[lk(c, l)] = s; persist(); },
  // Original rules: a level unlocks once the previous one has a score; a chapter once its last level does
  isLevelCompleted(c, l, n) { return this.highScore(c, l, n) > 0; },
  isLevelUnlocked(c, l, n) { return this.isChapterUnlocked(c, n) && (l === 1 || this.highScore(c, l - 1, n) > 0); },
  isChapterUnlocked(c, n) { return c === 1 || this.highScore(c - 1, game.levelsForChapter(c - 1), n) > 0; },
  highScoreForChapter(c, n) {
    let s = 0;
    for (let l = 1; l <= game.levelsForChapter(c); l++) s += this.highScore(c, l, n);
    return s;
  },
  // Furthest point reached, e.g. [2, 4] for "Chapter 2 - 4"
  progress(n) {
    let ch = 1;
    for (let c = 1; c <= 5; c++) if (this.isChapterUnlocked(c, n)) ch = c;
    let lv = 1;
    for (let l = 1; l <= game.levelsForChapter(ch); l++) if (this.isLevelUnlocked(ch, l, n)) lv = l;
    return [ch, lv];
  },

  setLollipopCollected(c, l) { slot().lollipops[lk(c, l)] = true; persist(); },
  isLollipopCollected(c, l, n = slots.current) { return !!slots[n].lollipops[lk(c, l)]; },

  savePossiblePoints(c, l, p) { possible[lk(c, l)] = p; },
  possiblePoints(c, l) { return possible[lk(c, l)] || 0; },

  // 33% for 1 star, 66% for 2, and 90% for 3 (chapter 5 uses gentler thresholds)
  thresholds(c) { return c === 5 ? [0.33, 0.53, 0.68] : [0.33, 0.66, 0.90]; },
  starsForScore(score, c, l) {
    const poss = this.possiblePoints(c, l);
    if (!poss || !score) return 0;
    const pct = score / poss;
    const t = this.thresholds(c);
    return pct >= t[2] ? 3 : pct >= t[1] ? 2 : pct >= t[0] ? 1 : 0;
  },
  pointsForStars(stars, c, l) {
    return Math.floor(this.possiblePoints(c, l) * this.thresholds(c)[stars - 1]);
  },
  // Debug helper (?unlock): give every level a token score in the current slot
  unlockAll() {
    for (let c = 1; c <= 5; c++) {
      for (let l = 1; l <= game.levelsForChapter(c); l++) if (!this.highScore(c, l)) slot().highScores[lk(c, l)] = 1;
    }
    persist();
  },
};

// ------------------------------------------------------------------ settings
const settings = load('rkr.settings.v1', { showControls: null });
export const options = {
  get showControls() { return settings.showControls; },
  set showControls(v) { settings.showControls = v; store('rkr.settings.v1', settings); },
};

// ------------------------------------------------------------------ stats + achievements
const stats = load('rkr.stats.v1', {});
const earned = load('rkr.achievements.v1', {});

// The 33 achievements the original game awarded (titles from its Game Center IDs;
// descriptions describe what the code checks for)
export const ACHIEVEMENTS = [
  ['RKR_1', 'Hamster Squasher', 'Stomp 100 hamsters'],
  ['RKR_2', 'Snail Squasher', 'Stomp 100 cyclops snails'],
  ['RKR_3', 'Bunny Squasher', 'Stomp 150 rage bunnies'],
  ['RKR_4', 'Zombie Stomper', 'Stomp 200 zombies'],
  ['RKR_5', 'Giggle Stomper', 'Stomp 150 gigglesnouts'],
  ['RKR_6', 'Panda My Saurus', 'Defeat the Pandasaurus'],
  ['RKR_7', 'Shun the Nonbeliever', 'Defeat the Zorsicorn'],
  ['RKR_8', 'Bon Voyage', 'Defeat Mitch'],
  ['RKR_9', 'Aerial Stompage', 'Stomp a zombie while it is in the air'],
  ['RKR_10', 'Persistence', 'Lose 100 lives'],
  ['RKR_11', 'Run Timmy Run', 'Earn all 27 stars in chapter 1'],
  ['RKR_12', 'Pandarama', 'Earn all 27 stars in chapter 2'],
  ['RKR_13', 'Zorsicorns Forever', 'Earn all 27 stars in chapter 3'],
  ['RKR_14', 'Michelle My Belle', 'Earn all 27 stars in chapter 4'],
  ['RKR_15', "Devil's Backbone", 'Earn 3 stars on Run Kitty Run!'],
  ['RKR_16', 'Learning How to Stomp', 'Stomp 3 hamsters in a row in one combo'],
  ['RKR_17', 'Rage Alert', 'Make 125 bunnies rage'],
  ['RKR_18', 'Run Kitty Run', 'Finish Run Kitty Run!'],
  ['RKR_19', 'My Favorite Memories', 'Find every hidden photo'],
  ['RKR_20', 'Timmy Liker', 'Visit Timmy on Facebook from the credits'],
  ['RKR_21', 'Timmy Follower', 'Visit Timmy on Twitter from the credits'],
  ['RKR_22', 'The Adventures of Timmy', 'Watch every cutscene'],
  ['RKR_23', 'Nine Lives', 'Lose 9 lives'],
  ['RKR_24', 'Got a Secret', 'Reach a 21x stomp combo'],
  ['RKR_26', 'Make It Rain', 'Visit Rain from the credits'],
  ['RKR_27', 'Our Experiment', 'Visit Cross Borders from the credits'],
  ['RKR_28', 'Frisbie', 'Visit Frisbie from the credits'],
  ['RKR_29', 'I Am Not a Quitter', 'Lose 40 lives on Run Kitty Run!'],
  ['RKR_31', 'Twinkle Twinkle', 'Earn every star in the game'],
  ['RKR_32', 'Coin Collector', 'Collect 1,000 coins'],
  ['RKR_33', 'Mega Coin Collector', 'Collect 2,500 coins'],
  ['RKR_34', 'Insane Coin Collector', 'Collect 10,000 coins'],
  ['RKR_35', 'Wall Jumper', 'Jump off a wall'],
];

let toastHandler = null;
export const achievements = {
  onUnlock(fn) { toastHandler = fn; },
  percent(id) { return Math.min(1, earned[id] || 0); },
  isEarned(id) { return (earned[id] || 0) >= 1; },
  report(id, pct) {
    if (this.isEarned(id) || !(pct > (earned[id] || 0))) return;
    earned[id] = Math.min(1, pct);
    store('rkr.achievements.v1', earned);
    if (earned[id] >= 1 && toastHandler) {
      const a = ACHIEVEMENTS.find(x => x[0] === id);
      if (a) toastHandler(a);
    }
  },
  stat(name) { return stats[name] || 0; },
  addToStat(name, n = 1) { stats[name] = (stats[name] || 0) + n; store('rkr.stats.v1', stats); return stats[name]; },
  setStat(name, v) { stats[name] = v; store('rkr.stats.v1', stats); },
};
