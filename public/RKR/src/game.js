// Port of GameScene.m — builds a level, runs the camera and the active-box, handles win/death.
import {
  Node, Sprite, WIN_W, WIN_H, assets, frameFromImage, loadImage, loadAtlas, FadeIn, Sequence, Call, JumpBy, MoveBy, MoveTo,
  rectIntersects, rectContains, rectInset, vibrate,
} from './engine.js';
import { TileMap, loadLevel, bool } from './tilemap.js';
import { Timmy } from './timmy.js';
import { Hamster, RageBunny, CyclopticSnail, Zombie, Gigglesnout } from './enemies.js';
import { Pandasaurus, preloadPandasaurus, Zorsicorn, preloadZorsicorn, Mitch, preloadMitch } from './bosses.js';
import {
  BackAndForthMovingPlatform, OneWayMovingPlatform, PathMovingPlatform, MovingWall, FireballLauncher, Fireball,
  loadPlatformImage, fireSound,
} from './platforms.js';
import { loadParticles, loadTexture } from './particles.js';
import { Coin, Heart, Lollipop, Checkpoint } from './pickups.js';
import { HUD } from './hud.js';
import { InputLayer } from './input.js';
import { animatedSwingset, animatedTorch } from './effects.js';
import { game, POINTS, savedGame } from './model.js';
import { FootSound } from './character.js';
import * as audio from './audio.js';

const ACTIVE_BOX_MARGIN = 100;
const GAMEPLAY_CAMERA_PAN_PIXELS_SECOND = 350;
const COIN_INSET = 5, HEART_INSET = 5, LOLLIPOP_INSET = 5;
const BACKGROUND_OVERLAP = 2;

// ------------------------------------------------------------------ parallax backgrounds
class ScrollingBackground extends Sprite {
  constructor(img, worldWidth, scaleX = 1, scaleY = 1.25) {
    super(frameFromImage(img, 1));
    this.anchorX = 0; this.anchorY = 0;
    this.scaleX = scaleX; this.scaleY = scaleY;
    this.factorX = (this.width * scaleX - WIN_W) / Math.max(1, worldWidth - WIN_W);
  }
  updateWithDelta(dx) { this.x += dx * this.factorX; }
}

class RepeatingBackground extends Node {
  constructor(img, factorX, autoScroll = 0, scaleX = 1, scaleY = 1.25) {
    super();
    this.factorX = factorX; this.autoScroll = autoScroll;
    const f = frameFromImage(img, 1);
    this.left = this.addChild(new Sprite(f));
    this.right = this.addChild(new Sprite(f), 1);
    for (const s of [this.left, this.right]) { s.anchorX = 0; s.anchorY = 0; s.scaleX = scaleX; s.scaleY = scaleY; }
    this.span = this.left.width * scaleX - BACKGROUND_OVERLAP;
    this.right.x = this.span;
  }
  updateWithDelta(dx) {
    const d = dx * this.factorX + this.autoScroll;
    this.left.x += d;
    this.right.x = this.left.x + this.span;
    if (d < 0) {
      if (this.right.x <= 0) { this.left.x = 0; this.right.x = this.span; }
    } else if (this.left.x >= 0) {
      this.left.x = -this.span; this.right.x = 0;
    }
  }
}

const THEMES = {
  chapter1: [
    { type: 'scroll', image: 'ch1_sunset.png' },
    { type: 'repeat', image: 'ch1_middleMtn.png', factor: 0.3, y: 103 },
    { type: 'repeat', image: 'ch1_frontMtn.png', factor: 0.5 },
  ],
  // Chapter 4's layers exist only as HD files, drawn at half scale (x1.25 tall like the others)
  chapter4: [
    { type: 'scroll', image: 'ch4_ch4-bg-backlayer-hd.png', scale: 0.5 },
    { type: 'repeat', image: 'ch4_ch4-bg-frontlayer-hd.png', factor: 0.5, scale: 0.5 },
  ],
  chapter3: [
    { type: 'scroll', image: 'ch3_starryNight.png' },
    { type: 'repeat', image: 'ch3_nightClouds.png', factor: 0.5, auto: -0.1 },
  ],
  chapter2: [
    { type: 'repeat', image: 'ch2_greenMountains.png', factor: 0.3 },
    { type: 'repeat', image: 'ch2_greyMountains.png', factor: 0.5 },
  ],
};

// Chapter 2 foreground trees (Chapter2ForegroundTrees.m): [element, x] per level
const CH2_TREES = {
  1: [[1, 515], [3, 1271], [2, 2290], [1, 4113]],
  2: [[4, 435], [4, 2386], [4, 2870]],
  3: [[3, 420], [4, 1099], [4, 1729], [4, 2974], [3, 3213]],
  4: [],
  5: [[3, 905]],
  6: [[4, 1783]],
  7: [[2, 20], [3, 210], [4, 455], [4, 980], [4, 1680]],
  8: [[3, 30], [4, 630], [4, 1695], [3, 2940], [4, 3452]],
  9: [[3, 840], [4, 1260], [3, 3612], [3, 4060], [3, 4421]],
};

class ForegroundTrees extends Node {
  constructor(level) {
    super();
    this.scaleY = 1.25;
    for (const [el, x] of CH2_TREES[level] || []) {
      const fg = this.addChild(new Sprite(`ch2-fg${el}.png`));
      fg.scale = 2;
      if (el <= 2) { fg.anchorX = 0; fg.anchorY = 0; fg.x = x; fg.y = 0; }
      else { fg.anchorX = 0; fg.anchorY = 1; fg.x = x; fg.y = 267; }
    }
  }
  updateWithDelta(dx) { this.x += dx * 1.4; }
}

// ------------------------------------------------------------------ loading
export async function prepareLevel(chapter, level) {
  const name = `level${chapter}_${level}`;
  const data = await loadLevel(name);
  const theme = THEMES[data.info.theme] || [];
  const platformImages = new Set();
  for (const o of [...(data.objectGroups.movingPlatforms || []), ...(data.objectGroups.movingWalls || [])]) {
    if (o.props.image) platformImages.add(o.props.image);
  }
  const metaTypes = new Set(data.layers.find(l => l.name === 'meta').data
    .map(g => (data.tileProps[g] || {}).enemyType).filter(Boolean));
  const needsFire = (data.objectGroups.shootingFire || []).length || metaTypes.has('panda');
  await Promise.all([
    ...theme.map(t => loadImage(`assets/levels/${t.image}`)),
    chapter === 1 ? loadAtlas('chapter1Extras') : null,
    chapter === 2 ? loadAtlas('ch2-fg') : null,
    ...[...platformImages].map(i => loadPlatformImage(i, chapter)),
    needsFire ? loadPlatformImage('chapter2FireballLauncher.png', 2) : null,
    needsFire ? loadTexture('fire.png') : null,
    metaTypes.has('panda') || metaTypes.has('zorsicorn') ? loadAtlas('panda') : null,
    metaTypes.has('zorsicorn') ? loadAtlas('zorsicorn') : null,
    metaTypes.has('mitch') ? loadAtlas('mitch') : null,
    metaTypes.has('zorsicorn') ? loadPlatformImage('zorsicornWall.png', chapter) : null,
    metaTypes.has('panda') ? preloadPandasaurus() : null,
    metaTypes.has('panda') ? loadPlatformImage('pandaBackWall.png', chapter) : null,
  ]);
  data.particleConfigs = {};
  if (metaTypes.has('panda')) {
    for (const n of ['pandaPoof', 'pandaExplode']) data.particleConfigs[n] = await loadParticles(n);
  }
  if (metaTypes.has('zorsicorn')) Object.assign(data.particleConfigs, await preloadZorsicorn(chapter));
  if (metaTypes.has('mitch')) Object.assign(data.particleConfigs, await preloadMitch());
  if ((data.objectGroups.shootingFire || []).length || metaTypes.has('panda') || metaTypes.has('zorsicorn')) {
    await loadTexture('fire.png');
  }
  return data;
}

// ------------------------------------------------------------------ the scene
export class GameScene extends Node {
  constructor(data, { onWin, onRestart, onPause }) {
    super();
    this.callbacks = { onWin, onRestart, onPause };
    this.scheduled = [];
    this.gameplayStarted = false;
    this.initTimer = 1.0;

    Object.assign(game, {
      points: 0, health: 3, enemiesKilledCount: 0, coinsCollectedCount: 0, bonusHeartsCount: 0,
      lollipopCollected: false, playerIsInvincible: false, gameplayIsPaused: false, enemyComboCount: 1,
    });
    game.set('points', 0);
    game.set('health', 3);

    this.levelInfo = data.info;
    this.particleConfigs = data.particleConfigs || {};
    this.tileMap = new TileMap(data);
    this.tileSize = this.tileMap.tileSize;
    this.worldWidth = this.tileMap.width;
    this.worldHeight = this.tileMap.height;
    audio.playMusic(`CH_${game.currentChapter}${game.currentLevel === 9 ? '_9' : ''}_music.mp3`);
    this.initGameplayAudio();

    // Backgrounds (parallax)
    this.parallax = [];
    for (const t of THEMES[data.info.theme] || []) {
      const img = assets.images[`assets/levels/${t.image}`];
      const k = t.scale || 1;
      const node = t.type === 'scroll'
        ? new ScrollingBackground(img, this.worldWidth, k, 1.25 * k)
        : new RepeatingBackground(img, t.factor, t.auto || 0, k, 1.25 * k);
      if (t.y) node.y += t.y;
      this.parallax.push(node);
      this.addChild(node);
    }

    this.shakeNode = this.addChild(new Node());
    this.gameLayer = this.shakeNode.addChild(new Node());
    this.gameLayer.addChild(this.tileMap);

    // Event triggers (Tiled object coordinates are y-down)
    this.eventTriggers = [];
    for (const o of data.objectGroups.eventTriggers || []) {
      this.eventTriggers.push({
        name: o.props.triggerName,
        rect: { x: o.x, y: this.worldHeight - o.y - o.height, w: o.width, h: o.height },
      });
    }

    // Moving platforms
    this.movingPlatforms = [];
    for (const o of data.objectGroups.movingPlatforms || []) {
      const t = o.type;
      if (t === 'backAndForth') {
        const p = new BackAndForthMovingPlatform(o, this.gameLayer, this.worldHeight);
        p.addMotion(); this.movingPlatforms.push(p);
      } else if (t === 'oneWay') {
        const p = new OneWayMovingPlatform(o, this.gameLayer, this.worldHeight);
        p.addMotion(); this.movingPlatforms.push(p);
      } else if (t === 'path') {
        this.movingPlatforms.push(new PathMovingPlatform(o, this.gameLayer, this.worldHeight));
      } else if (t === 'treadmill') {
        this.movingPlatforms.push(...OneWayMovingPlatform.treadmill(o, this.gameLayer, this.worldHeight));
      } else {
        console.warn('Unrecognized movingPlatform type:', t);
      }
    }

    // Moving walls
    this.movingWalls = [];
    this.movingWallsParent = this.gameLayer.addChild(new Node());

    // Projectiles
    this.activeFireballs = new Set();
    this.fireballsParent = this.gameLayer.addChild(new Node(), 20);
    this.launchersParent = this.gameLayer.addChild(new Node(), 21);
    for (const o of data.objectGroups.shootingFire || []) {
      const l = new FireballLauncher(o, this.worldHeight);
      l.gameScene = this;
      this.launchersParent.addChild(l);
    }

    // Objects from the meta layer
    this.activeCrumbleBlocks = new Set();
    this.inactiveCrumbleBlocks = new Set();
    this.coins = new Set();
    this.hearts = new Set();
    this.inactiveEnemies = new Set();
    this.activeEnemies = new Set();
    this.killedEnemies = new Set();
    this.enemiesToRemove = new Set();
    this.lollipop = null;
    this.checkpoint = null;

    const metaBatch = this.gameLayer.addChild(new Node());
    const enemiesBatch = this.gameLayer.addChild(new Node(), 18);
    this.footSoundsToLoad = [];
    const ts = this.tileSize, half = ts * 0.5;
    const center = (c, r) => ({ x: c * ts + half, y: this.worldHeight - (r * ts + half) });
    this.timmyLastDirectionIsRight = true;
    this.playerEnd = { x: -9999, y: -9999, w: 0, h: 0 };

    for (let row = 0; row < this.tileMap.mapH; row++) {
      for (let col = 0; col < this.tileMap.mapW; col++) {
        const props = this.tileMap.propertiesForGID(this.tileMap.gidAt('meta', col, row)) || {};
        const plat = this.propertiesForTileWithCoordinates({ x: col, y: row });
        if (plat && plat.footSound !== undefined) {
          const fs = parseInt(plat.footSound, 10);
          if (!this.footSoundsToLoad.includes(fs)) this.footSoundsToLoad.push(fs);
        }
        const p = center(col, row);
        if (bool(props.playerStart)) {
          this.playerStart = p;
          this.timmyLastDirectionIsRight = props.direction !== 'left';
        } else if (bool(props.playerEnd)) {
          this.playerEnd = { x: p.x, y: p.y - ts, w: ts, h: 160 };
        } else if (bool(props.checkpoint)) {
          this.checkpoint = new Checkpoint(metaBatch);
          this.checkpoint.sprite.x = p.x; this.checkpoint.sprite.y = p.y;
          metaBatch.addChild(this.checkpoint.sprite);
        } else if (bool(props.lollipop)) {
          this.lollipop = new Lollipop(metaBatch);
          this.lollipop.sprite.x = p.x; this.lollipop.sprite.y = p.y;
          this.lollipop.gameScene = this;
        } else if (bool(props.coin)) {
          const c = new Coin(metaBatch);
          c.sprite.x = p.x; c.sprite.y = p.y; c.gameScene = this;
          this.coins.add(c);
        } else if (bool(props.heart)) {
          const h = new Heart(metaBatch);
          h.sprite.x = p.x; h.sprite.y = p.y; h.gameScene = this;
          this.hearts.add(h);
        }

        const type = props.enemyType;
        if (type) {
          const flip = props.direction !== 'right';
          let enemy = null;
          if (type === 'hamster') {
            enemy = new Hamster(enemiesBatch, flip);
            enemy.position = p;
          } else if (type === 'bunny') {
            enemy = new RageBunny(enemiesBatch, flip);
            enemy.position = { x: p.x, y: p.y + 10 };
            enemy.patrolAnchorX = enemy.position.x;
          } else if (type === 'snail') {
            enemy = new CyclopticSnail(enemiesBatch, flip);
            enemy.position = p;
          } else if (type === 'zombie') {
            enemy = new Zombie(enemiesBatch, flip);
            enemy.position = p;
          } else if (type === 'gigglesnout') {
            enemy = new Gigglesnout(enemiesBatch, flip, props.color);
            enemy.position = p;
            enemy.patrolAnchorX = enemy.position.x;
          } else if (type === 'mitch') {
            enemy = new Mitch(this.gameLayer, flip);
            enemy.position = p;
          } else if (type === 'zorsicorn') {
            enemy = new Zorsicorn(this.gameLayer, flip);
            enemy.position = p;
          } else if (type === 'panda') {
            enemy = new Pandasaurus(this.gameLayer, flip);
            enemy.position = p;
          } else {
            console.warn('Enemy type not ported yet:', type);
          }
          if (enemy) { enemy.gameScene = this; this.inactiveEnemies.add(enemy); }
        }
      }
    }
    for (const e of this.inactiveEnemies) e.adjustInitialPosition();
    savedGame.savePossiblePoints(game.currentChapter, game.currentLevel, this.totalPossiblePoints());

    // Camera setup
    this.tilemapMaxX = 0;
    this.tilemapMinX = -(this.worldWidth - WIN_W);
    this.tilemapMaxY = 0;
    this.tilemapMinY = -(this.worldHeight - WIN_H);
    this.camLeft = this.camRight = WIN_W * 0.5;
    this.camTop = this.camBottom = WIN_H * 0.5;
    this.activeBoxW = WIN_W + 2 * ACTIVE_BOX_MARGIN;
    this.activeBoxH = WIN_H + 2 * ACTIVE_BOX_MARGIN;

    if (data.info.theme === 'chapter2') {
      const trees = new ForegroundTrees(game.currentLevel);
      this.parallax.push(trees);
      this.addChild(trees);
    }

    this.addVignette();
    this.inputLayer = this.addChild(new InputLayer());
    this.hud = this.addChild(new HUD());
    this.blackOverlay = this.addChild(new Sprite(frameFromImage(assets.images['assets/ui/death-loadScreen.jpg'], 0.5)));
    this.blackOverlay.anchorX = 0; this.blackOverlay.anchorY = 0;
    this.blackOverlay.opacity = 0;
    this.hud.addLevelNumberString();

    const before = this.gameLayer.x;
    const beforeY = this.gameLayer.y;
    this.initialCameraPosition();
    for (const p of this.parallax) p.updateWithDelta(this.gameLayer.x - before, this.gameLayer.y - beforeY);

    this.addPlayer();
  }

  // ---------------------------------------------------------------- scheduler
  schedule(obj) { if (!this.scheduled.includes(obj)) this.scheduled.push(obj); }
  unschedule(obj) { const i = this.scheduled.indexOf(obj); if (i >= 0) this.scheduled.splice(i, 1); }

  step(dt) {
    this.updateActions(dt);
    for (const obj of this.scheduled.slice()) {
      if (this.scheduled.includes(obj)) obj.update(dt);
    }
    this.hud.step(dt);
    this.inputLayer.tick(dt);
    this.tileMap.setView(-this.gameLayer.x - this.shakeNode.x, -this.gameLayer.y - this.shakeNode.y, WIN_W, WIN_H);
  }

  initGameplayAudio() {
    const coins = ['coins1', 'coins2', 'coins3', 'coins4', 'coins5', 'coins6'];
    for (let i = coins.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coins[i], coins[j]] = [coins[j], coins[i]];
    }
    audio.addEffectsList('coin', coins);
    audio.addEffectsList('heart', ['tim_grab_heart', 'tim_grab_heart_vox']);
    audio.preload(['hamster_death', 'bunny_death', 'bunny_hop_normal', 'bunny_hop_zombie', 'bunny_electrify_zap',
      'tim_grab_lollipop', 'tim_jump_off_wall', 'tim_wall_slide_loop', 'land_grass']);
  }

  addPlayer() {
    this.timmy = new Timmy(this.gameLayer, !this.timmyLastDirectionIsRight);
    this.timmy.position = this.playerStart;
    this.timmy.gameScene = this;
    this.timmy.input = this.inputLayer;
    const dfs = this.tileMap.properties.defaultFootSound;
    this.timmy.defaultFootSound = parseInt(dfs || '0', 10);
    if (dfs !== undefined) this.footSoundsToLoad.push(parseInt(dfs, 10));
    this.timmy.initFootSounds(this.footSoundsToLoad);
    this.gameLayerCheckpointPosition = { x: this.gameLayer.x, y: this.gameLayer.y };
    this.levelSpecificSetup();
    game.gameplayIsPaused = false;
    this.timmy.scheduleUpdates();
    this.schedule(this);
    this.gameplayStarted = true;
  }

  // ---------------------------------------------------------------- camera
  initialCameraPosition() {
    const sx = this.playerStart.x + this.gameLayer.x;
    const sy = this.playerStart.y + this.gameLayer.y;
    const g = this.gameLayer;
    if (sx > this.camRight) g.x = Math.max(this.tilemapMinX, g.x + this.camRight - sx);
    else if (sx < this.camLeft) g.x = Math.min(this.tilemapMaxX, g.x + this.camLeft - sx);
    if (sy > this.camTop) g.y = Math.max(this.tilemapMinY, g.y + this.camTop - sy);
    else if (sy < this.camBottom) g.y = Math.min(this.tilemapMaxY, g.y + this.camBottom - sy);
  }

  update(dt) {
    if (this.initTimer < 0) this.timmy.landSoundsEnabled = true;
    else this.initTimer -= dt;
    const ox = this.gameLayer.x, oy = this.gameLayer.y;
    this.marioStyleCamera(dt);
    const dx = this.gameLayer.x - ox, dy = this.gameLayer.y - oy;
    for (const p of this.parallax) p.updateWithDelta(dx, dy);
    this.handleActiveBox();
    if (this.bridgeTicker) this.bridgeTicker();
    // Enemies that killed themselves this frame (e.g. zombies running into Timmy)
    for (const e of this.enemiesToRemove) {
      if (this.activeEnemies.delete(e)) this.killedEnemies.add(e);
    }
    this.enemiesToRemove.clear();
  }

  killEnemy(e) { this.enemiesToRemove.add(e); }
  removeEnemy(e) {
    if (this.activeEnemies.delete(e)) { e.unscheduleUpdatesWithCleanup(); e.didBecomeInactive(); }
  }
  // Thrown objects / dropped critters join the fight immediately
  launchProjectile(pos, vx, vy, enemy) {
    this.activeEnemies.add(enemy);
    enemy.position = pos;
    enemy.gameScene = this;
    enemy.isActive = true;
    enemy.applyVelocity({ x: vx, y: vy });
    enemy.didBecomeActive();
  }
  checkForTriggerInRect(rect) {
    for (const t of this.eventTriggers) if (rectIntersects(rect, t.rect)) this.postEvent(t.name);
  }
  removeInactiveEnemy(e) { this.inactiveEnemies.delete(e); }
  triggerForName(name) { return this.eventTriggers.find(t => t.name === name) || null; }

  marioStyleCamera(dt) {
    const g = this.gameLayer;
    let x = g.x, y = g.y;
    const tp = this.timmy.position;
    const sx = tp.x + g.x, sy = tp.y + g.y;
    const maxPan = GAMEPLAY_CAMERA_PAN_PIXELS_SECOND * dt;
    if (sx > this.camLeft) {
      x += Math.max(this.camLeft - sx, -maxPan);
      x = Math.max(this.tilemapMinX, x);
    } else if (sx < this.camRight) {
      x += Math.min(this.camRight - sx, maxPan);
      x = Math.min(this.tilemapMaxX, x);
    }
    if (sy > this.camTop) {
      let d = this.camTop - sy;
      if (d < -8) d = -3;
      y = Math.max(this.tilemapMinY, y + d);
    } else if (sy < this.camBottom) {
      y = Math.min(this.tilemapMaxY, y + this.camBottom - sy);
    }
    g.x = Math.round(x); g.y = Math.round(y);
  }

  smallCameraShake() {
    this.shakeNode.stopAllActions();
    this.shakeNode.x = this.shakeNode.y = 0;
    this.shakeNode.runAction(new JumpBy(0.25, 0, 0, 8, 4));
    vibrate(60);
  }

  // ---------------------------------------------------------------- active box
  activeBoxRect() {
    return { x: -this.gameLayer.x - ACTIVE_BOX_MARGIN, y: -this.gameLayer.y - ACTIVE_BOX_MARGIN, w: this.activeBoxW, h: this.activeBoxH };
  }

  manageItems(set, inset, canCollect) {
    const box = this.activeBoxRect();
    const tr = this.timmy.collisionRect();
    const collected = [];
    for (const item of set) {
      const now = rectContains(box, item.sprite.x, item.sprite.y);
      if (item.isActive && !now) { item.isActive = false; item.didBecomeInactive(); }
      else if (!item.isActive && now) { item.isActive = true; item.didBecomeActive(); }
      if (now && rectIntersects(tr, rectInset(item.sprite.boundingBox(), inset, inset)) && canCollect()) collected.push(item);
    }
    for (const item of collected) { item.collected(); set.delete(item); }
  }

  handleActiveBox() {
    const box = this.activeBoxRect();
    const timmy = this.timmy;
    const tr = timmy.collisionRect();

    this.manageItems(this.coins, COIN_INSET, () => true);
    this.manageItems(this.hearts, HEART_INSET, () => game.health < 3);

    for (const b of [...this.inactiveCrumbleBlocks]) {
      if (rectContains(box, b.sprite.x, b.sprite.y)) {
        b.isActive = true; b.didBecomeActive();
        this.activeCrumbleBlocks.add(b); this.inactiveCrumbleBlocks.delete(b);
      }
    }
    for (const b of [...this.activeCrumbleBlocks]) {
      if (rectContains(tr, b.sprite.x, b.sprite.y) && !b.isCrumbling) b.startCrumbleTimer();
      if (!rectContains(box, b.sprite.x, b.sprite.y)) {
        b.isActive = false; b.didBecomeInactive();
        this.inactiveCrumbleBlocks.add(b); this.activeCrumbleBlocks.delete(b);
      }
    }

    const lp = this.lollipop;
    if (lp && !lp.wasCollected) {
      if (rectContains(box, lp.sprite.x, lp.sprite.y)) {
        if (!lp.isActive) { lp.isActive = true; lp.didBecomeActive(); }
        if (rectIntersects(tr, rectInset(lp.sprite.boundingBox(), LOLLIPOP_INSET, LOLLIPOP_INSET))) lp.collected();
      } else if (lp.isActive) { lp.isActive = false; lp.didBecomeInactive(); }
    }

    const entering = [...this.inactiveEnemies].filter(e => rectContains(box, e.position.x, e.position.y));
    const leaving = [...this.activeEnemies].filter(e => !rectContains(box, e.position.x, e.position.y) && !e.ignoreActiveBox);
    for (const e of entering) {
      this.activeEnemies.add(e); this.inactiveEnemies.delete(e);
      e.isActive = true; e.didBecomeActive();
    }
    for (const e of leaving) {
      this.inactiveEnemies.add(e); this.activeEnemies.delete(e);
      e.isActive = false; e.didBecomeInactive();
    }

    if (this.checkpoint && rectContains(tr, this.checkpoint.sprite.x, this.checkpoint.sprite.y)) {
      this.checkpoint.checkpointWasReached();
      this.gameLayerCheckpointPosition = { x: this.gameLayer.x, y: this.gameLayer.y };
      this.playerStart = timmy.position;
    }

    for (const t of this.eventTriggers) {
      if (rectIntersects(tr, t.rect)) this.postEvent(t.name);
    }

    if (!timmy.hasWon && rectIntersects(tr, this.playerEnd)) timmy.startWinState();
  }

  postEvent(name) {
    if (name === 'treeEntrance') this.timmy.onTreeEntrance();
    for (const e of [...this.inactiveEnemies, ...this.activeEnemies]) if (e.onEvent) e.onEvent(name);
  }

  // ---------------------------------------------------------------- projectiles
  launchFireball(x, y, angle, speed, size, secondsToLive, type) {
    const box = this.activeBoxRect();
    const launchRect = { x: box.x - 300, y: box.y - 300, w: box.w + 600, h: box.h + 600 };
    if (!rectContains(launchRect, x, y)) return;
    const f = new Fireball(size, type);
    f.gameScene = this;
    f.x = x; f.y = y;
    f.c.angle = angle * 180 / Math.PI - 180;
    f.c.angleVariance = 10;
    this.activeFireballs.add(f);
    this.fireballsParent.addChild(f);
    f.runAction(new Sequence(
      new MoveBy(secondsToLive, speed * secondsToLive * Math.cos(angle), speed * secondsToLive * Math.sin(angle)),
      new Call(() => f.reachedEndOfRange())));
    if (rectContains(box, x, y)) fireSound(type);
  }
  removeAllFireballs() {
    this.fireballsParent.removeAllChildren();
    this.activeFireballs.clear();
  }

  // The boss-arena door slams shut (closePandaDoor / closeZorsicornDoor)
  closeBossDoor(col, row) {
    const door = this.bossDoor;
    if (!door) return;
    this.gameLayer.reorderChild(this.movingWallsParent, -1);
    door.sprite.opacity = 255;
    const p = this.worldLocationForTileCoordinate({ x: col, y: row });
    door.sprite.runAction(new Sequence(new MoveTo(0.25, p.x, p.y), new Call(() => this.smallCameraShake())));
    audio.playEffect('bad_guys_wall_slam_down');
  }

  // ---------------------------------------------------------------- tile queries
  metaPropertiesForTileAtWorldLocation(loc) {
    const tc = this.tileCoordinatesFromWorldLocation(loc);
    if (tc.x < 0 || tc.y < 0 || tc.x >= this.tileMap.mapW || tc.y >= this.tileMap.mapH) return { instaDeath: '1' };
    return this.tileMap.propertiesForGID(this.tileMap.gidAt('meta', tc.x, tc.y));
  }
  propertiesForTileAtWorldLocation(loc) {
    return this.propertiesForTileWithCoordinates(this.tileCoordinatesFromWorldLocation(loc));
  }
  propertiesForTileWithCoordinates(tc) {
    const m = this.tileMap;
    if (tc.y >= m.mapH) return {};
    if (tc.x < 0 || tc.y < 0 || tc.x >= m.mapW) return { solid: '1' };
    return m.propertiesForGID(m.gidAt('platform_0', tc.x, tc.y)) || m.propertiesForGID(m.gidAt('platform_1', tc.x, tc.y)) || null;
  }
  worldLocationForTileCoordinate(tc) {
    return { x: Math.floor(tc.x * this.tileSize), y: Math.floor(this.worldHeight - tc.y * this.tileSize) };
  }
  tileCoordinatesFromWorldLocation(loc) {
    return { x: Math.floor(loc.x / this.tileSize), y: Math.floor((this.worldHeight - loc.y) / this.tileSize) };
  }

  // ---------------------------------------------------------------- win / death
  playerWillWin() {
    game.playerIsInvincible = true;
    for (const e of [...this.activeEnemies]) e.removeWithPoofButNotPoints();
    game.addHealthBonus();
  }

  playerDidWin() {
    if (this.finished) return;
    this.finished = true;
    game.playerDidDie = false;
    this.timmy.sprite.stopAllSounds();
    audio.playMusic('RKR_tim_win.mp3', false);
    this.callbacks.onWin();
  }

  playerWillDie() {
    game.set('health', 0);
    game.set('points', 0);
  }

  playerDidDie() {
    game.playerDidDie = true;
    this.blackOverlay.runAction(new Sequence(FadeIn(1.0), new Call(() => this.callbacks.onRestart())));
  }

  totalPossiblePoints() {
    let enemies = 0;
    for (const e of this.inactiveEnemies) enemies += e.pointValue;
    return enemies + this.coins.size * POINTS.COIN + (this.lollipop ? POINTS.LOLLIPOP : 0) + 3 * POINTS.HEART_LEFT;
  }

  // ---------------------------------------------------------------- theme extras
  addVignette() {
    const img = assets.images['assets/ui/vignette-corner-half.png'];
    const f = frameFromImage(img, 1);
    const corner = (ax, ay, x, y, fx, fy) => {
      const s = this.addChild(new Sprite(f));
      s.scaleX = 1.875; s.scaleY = 2.5;
      s.anchorX = ax; s.anchorY = ay; s.x = x; s.y = y; s.flipX = fx; s.flipY = fy;
    };
    corner(0, 0, 0, 0, false, false);
    corner(0, 1, 0, WIN_H, false, true);
    corner(1, 1, WIN_W, WIN_H, true, true);
    corner(1, 0, WIN_W, 0, true, false);
  }

  levelSpecificSetup() {
    const c = game.currentChapter, l = game.currentLevel;
    if (c === 1 && l === 1) {
      const swing = animatedSwingset();
      swing.x = 325; swing.y = 426;
      this.gameLayer.addChild(swing, -1);
    } else if (c === 1 && l === 9) {
      const ax = 4637, ay = 827;
      const torch1 = animatedTorch();
      torch1.x = ax - 26; torch1.y = ay + 49;
      this.gameLayer.addChild(torch1);
      const overlay = new Sprite('tree-entrance-overlay.png');
      overlay.anchorX = 0; overlay.anchorY = 0; overlay.x = ax; overlay.y = ay;
      this.gameLayer.addChild(overlay, 11);
      const torch2 = animatedTorch();
      torch2.x = ax + 50; torch2.y = ay + 49;
      this.gameLayer.addChild(torch2, 13);
      this.gameLayer.reorderChild(this.timmy.sprite, 10);
      this.timmy.gameLayerZ = 10;
    } else if (c === 2 && l === 9) {
      // Pandasaurus arena: hidden door that slams shut, and the drawbridge out
      this.bossDoor = new MovingWall('pandaBackWall.png', this.movingWallsParent);
      Object.assign(this.bossDoor.sprite, this.worldLocationForTileCoordinate({ x: 97, y: 3 }));
      this.bossDoor.sprite.opacity = 0;
      this.movingWalls.push(this.bossDoor);
      this.addDrawbridge(125, 11);
    } else if (c === 3 && l === 9) {
      // Zorsicorn arena
      this.bossDoor = new MovingWall('zorsicornWall.png', this.movingWallsParent);
      Object.assign(this.bossDoor.sprite, this.worldLocationForTileCoordinate({ x: 85, y: 4 }));
      this.bossDoor.sprite.opacity = 0;
      this.movingWalls.push(this.bossDoor);
      this.addDrawbridge(110, 19);
    }
  }

  addDrawbridge(col, row) {
    const bridge = new Sprite('drawbridge.png');
    this.gameLayer.addChild(bridge, 44);
    bridge.anchorX = 0.96; bridge.anchorY = 0.32;
    bridge.rotation = 90;
    Object.assign(bridge, this.worldLocationForTileCoordinate({ x: col, y: row }));
    const chain = new Sprite('chain.png');
    this.gameLayer.addChild(chain, -2);
    chain.anchorX = 0; chain.anchorY = 0;
    chain.x = bridge.x; chain.y = bridge.y + bridge.width * 0.94;
    chain.visible = false;
    this.bridge = bridge; this.chain = chain;
  }

  destroy() {
    this.hud.destroy();
    if (this.timmy) this.timmy.sprite.stopAllSounds();
    for (const e of [...this.activeEnemies, ...this.inactiveEnemies, ...this.killedEnemies]) {
      if (e.jumpSound) e.jumpSound.stop();
      if (e.slither) e.slither.stop();
      if (e.cleanup) e.cleanup();
    }
    this.removeAllFireballs();
  }
}

export { FootSound };
