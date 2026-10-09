// Boss enemies: BaseBossEnemy + Pandasaurus (chapter 2 finale).
import {
  Sprite, Animate, Sequence, Spawn, Repeat, Delay, Call, FadeTo, FadeIn, FadeOut, RotateTo, RotateBy, EaseBounceOut, BezierTo,
  MoveBy, RepeatForever,
  frame, animFrames, rectIntersects, assets,
} from './engine.js';
import { BaseEnemy, Hamster, Gigglesnout, RageBunny } from './enemies.js';
import { EnemyCollision } from './timmy.js';
import { pointsLabel, MotionStreak } from './effects.js';
import { ParticleSystem, loadParticles } from './particles.js';
import { FireballType, loadPlatformImage } from './platforms.js';
import { game, POINTS, achievements } from './model.js';
import { TILE_SIZE_26 } from './character.js';
import { bool } from './tilemap.js';
import * as audio from './audio.js';

const BOSS_HITS_TO_KILL = 3;
const RANDOM = (avg, range) => avg + (Math.random() - 0.5) * range;

export class BaseBossEnemy extends BaseEnemy {
  get isBoss() { return true; }
  createAnimations() {
    this.makeStun = () => new Sequence(
      new Repeat(new Sequence(new FadeTo(0.125, 60), new FadeTo(0.125, 200)), 6),
      FadeIn(0), new Call(() => this.stunActionDidFinish()));
  }
  setInitialState() {
    this.hits = 0;
    this.currentVelocity.x = 0;
    this.defeated = false;
    this.isStunned = false;
    this.hasBecomeActive = false;
    this.ignoreActiveBox = true;
  }
  handleCollisionWithPlayerRect(rect) {
    if (this.isStunned || this.defeated) return EnemyCollision.None;
    return super.handleCollisionWithPlayerRect(rect);
  }
  hitShouldKillEnemy() {
    this.hits++;
    if (this.hits >= BOSS_HITS_TO_KILL) {
      this.sprite.stopAllActions();
      this.sprite.opacity = 255;
      this.defeated = true;
      this.bossWasDefeated();
    } else this.stun();
    return false;
  }
  stun() { this.isStunned = true; this.sprite.runAction(this.makeStun()); }
  stunActionDidFinish() { this.isStunned = false; }
  didBecomeInactive() { /* bosses never leave the active box */ }
  didBecomeActive() {
    super.didBecomeActive();
    if (!this.hasBecomeActive) { this.hasBecomeActive = true; this.bossFirstBecameActive(); }
  }
  bossFirstBecameActive() {}
  bossWasDefeated() {}
}

// ------------------------------------------------------------------ Pandasaurus
const PANDA_SPEED = 33;
const PANDA_FIRE_SPREAD_ANGLE = Math.PI / 4 / 2;
const PANDA_PAUSE_TIME = 0.6;
const State = { Waiting: 0, Entering: 1, Walking: 2, Shooting: 3, Falling: 4 };

export async function preloadPandasaurus() {
  await Promise.all([loadParticles('pandaPoof'), loadParticles('pandaExplode')]);
}

export class Pandasaurus extends BaseBossEnemy {
  createSprite() {
    const container = new Sprite('transparent.png');
    this.pandaSprite = container.addChild(new Sprite('Panda_001.png'), 1);
    return container;
  }

  createAnimations() {
    super.createAnimations();
    const walk = animFrames('Panda_00', 9, 1);
    this.makeWalkForward = () => new Sequence(new Animate(walk, 0.1), new Call(() => this.nextAction()));
    this.makeWalkBackward = () => new Sequence(new Animate([...walk].reverse(), 0.09), new Call(() => this.walkBackwardCycleComplete()));
    this.makeEntrance = () => new Sequence(new Delay(1.5), new Call(() => this.completeEntrance()));
    this.makePause = () => new Sequence(new Delay(PANDA_PAUSE_TIME), new Call(() => this.nextAction()));
    this.makeShoot = () => new Sequence(
      new Call(() => audio.playEffect('panda_peg_leg')),
      new Animate(animFrames('Panda_shoot_0', 8, 11), 0.07, false),
      new Call(() => this.launchFireballs()),
      new Call(() => audio.playEffect('panda_peg_leg')),
      new Animate(['Panda_shoot_018.png'], 0.1),
      new Call(() => this.walkTowardsTimmy()));

    const stunFrames = [1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1].map(i => `Panda_stun_00${i}.png`);
    this.makeStun = () => new Sequence(
      new Spawn(new Animate(stunFrames, 0.08), new Repeat(new Sequence(new FadeTo(0.125, 60), new FadeTo(0.125, 200)), 6)),
      FadeIn(0), new Call(() => this.stunActionDidFinish()), new Delay(0.75));

    const jumpTimmy = new Call(() => this.gameScene.inputLayer.overrideJump());
    const left = () => new Call(() => this.overrideX(-0.75));
    const right = () => new Call(() => this.overrideX(1));
    const stop = () => new Call(() => this.overrideX(0));
    const explode = () => new Call(() => this.explodePanda());
    this.makeFall = () => new Spawn(
      new Sequence(jumpTimmy, left(), new Delay(0.5), right(), new Delay(0.15), stop(), new Call(() => this.checkBridgeDistance())),
      new Sequence(
        explode(), new Call(() => audio.playEffect('panda_death')), new FadeTo(0.1, 128),
        new Delay(1.0),
        explode(), new Call(() => this.smokePanda()), explode(), explode(),
        FadeOut(0.5),
        new Call(() => this.removePandaSprite()),
        new Call(() => this.lowerDrawbridge()), new Delay(4.0),
        new Call(() => this.fallCycleComplete())));
    this.makeFall2 = () => new Sequence(left(), new Delay(0.75), right(), new Delay(0.15), stop());
  }

  overrideX(x) { const il = this.gameScene.inputLayer; il.overrideUserInput = true; il.overrideX = x; }

  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 39, yToMiddle: -25, yToBottom: -50, xToMiddleRight: 33, xToBottomRight: 15 });
  }

  setInitialState() {
    super.setInitialState();
    this.pointValue = POINTS.PANDASAURUS;
    this.pandaState = State.Waiting;
    this.checkLeadingFoot = true;
    this.distantTimer = setInterval(() => this.onDistantTimer(), 4000);
  }

  // Event triggers from the level
  onEvent(name) {
    if (name === 'pandaEnter' && !this.enterTriggerHandled) {
      this.enterTriggerHandled = true;
      audio.stopMusic();
      this.gameScene.closeBossDoor(97, 10);
      this.enterArena();
    } else if (name === 'timmyJump' && this.pandaState === State.Falling) {
      this.gameScene.inputLayer.overrideJump();
    }
  }

  enterArena() {
    this.gameScene.timmy.killedByBoss = true;
    this.pandaState = State.Entering;
    this.currentVelocity.x = 0;
    this.pandaSprite.runAction(this.makeEntrance());
  }
  completeEntrance() {
    audio.playMusic('CH_2_bad_guy.mp3', true);
    this.gameScene.smallCameraShake();
    this.growl();
    this.shootAtTimmy();
  }

  stun() {
    this.pandaSprite.stopAllActions();
    this.currentVelocity.x = 0;
    this.isStunned = true;
    this.pandaSprite.runAction(this.makeStun());
    audio.playEffect('panda_hurt');
  }
  stunActionDidFinish() {
    this.isStunned = false;
    this.backAwayFromTimmy();
  }

  timmyToTheRight() { return this.gameScene.timmy.position.x > this.position.x; }

  walkTowardsTimmy() {
    this.gameScene.smallCameraShake();
    const right = this.timmyToTheRight();
    this.currentVelocity.x = right ? PANDA_SPEED : -PANDA_SPEED;
    this.pandaSprite.flipX = right;
    this.pandaSprite.stopAllActions();
    this.pandaSprite.runAction(this.makeWalkForward());
    this.pandaState = State.Walking;
  }
  backAwayFromTimmy() {
    this.extraSpriteFlip = false;
    this.gameScene.smallCameraShake();
    const right = this.timmyToTheRight();
    this.currentVelocity.x = right ? -PANDA_SPEED : PANDA_SPEED;
    this.pandaSprite.flipX = right;
    this.pandaSprite.stopAllActions();
    this.pandaSprite.runAction(this.makeWalkBackward());
    this.pandaState = State.Walking;
  }
  walkBackwardCycleComplete() {
    this.extraSpriteFlip = true;
    this.walkTowardsTimmy();
  }
  shouldContinueAfterLeadingFootHitEdge() {
    if (this.ignoreGravity) return true;
    this.currentVelocity.x *= -1;
    return false;
  }

  nextAction() {
    if (this.isStunned) return;
    const dist = Math.abs(this.sprite.x - this.gameScene.timmy.position.x);
    if (dist > 175 && Math.floor(Math.random() * 10) < 3) { this.walkTowardsTimmy(); return; }
    switch (Math.floor(Math.random() * 10)) {
      case 1: this.growl(); this.pause(); break;
      case 2: case 3: this.backAwayFromTimmy(); break;
      default: this.shootAtTimmy();
    }
  }

  pause() {
    this.currentVelocity.x = 0;
    this.pandaSprite.stopAllActions();
    this.pandaSprite.setFrame(frame('Panda_001.png'));
    this.pandaSprite.runAction(this.makePause());
  }

  shootAtTimmy() {
    this.currentVelocity.x = 0;
    this.pandaSprite.flipX = this.timmyToTheRight();
    this.pandaSprite.stopAllActions();
    this.pandaSprite.runAction(this.makeShoot());
    this.pandaState = State.Shooting;
  }

  worldPositionOfPegLeg() { const p = this.position; return { x: p.x, y: p.y - 31 }; }

  launchFireballs() {
    const t = this.gameScene.timmy.position, s = this.worldPositionOfPegLeg();
    let a = Math.atan2(t.y - s.y, t.x - s.x);
    if (!this.timmyToTheRight()) a -= 15 * Math.PI / 180;
    if (this.hits === 0) this.launchFireBall(a + PANDA_FIRE_SPREAD_ANGLE / 2);
    if (this.hits === 1) { this.launchFireBall(a + PANDA_FIRE_SPREAD_ANGLE / 2); this.launchFireBall(a - PANDA_FIRE_SPREAD_ANGLE / 2); }
    if (this.hits >= 2) { this.launchFireBall(a); this.launchFireBall(a + PANDA_FIRE_SPREAD_ANGLE); this.launchFireBall(a - PANDA_FIRE_SPREAD_ANGLE); }
  }
  launchFireBall(angle) {
    const p = this.worldPositionOfPegLeg();
    this.gameScene.launchFireball(p.x, p.y, angle, RANDOM(150, 100), RANDOM(40, 20), 8, FireballType.Panda);
  }

  hitShouldKillEnemy() {
    this.hits++;
    if (this.hits >= 5) {
      this.sprite.stopAllActions();
      this.sprite.opacity = 255;
      this.defeated = true;
      this.bossWasDefeated();
    } else this.stun();
    return false;
  }

  bossFirstBecameActive() { this.endDistantGrowls(); }

  bossWasDefeated() {
    const gs = this.gameScene;
    this.pandaState = State.Falling;
    this.currentVelocity.x = 0;
    audio.playEffect('panda_hurt');
    game.addPoints(this.pointValue);
    game.enemiesKilledCount += 1;
    pointsLabel(gs.gameLayer, this.pointValue, this.sprite.x, this.sprite.y);
    this.pandaSprite.stopAllActions();
    this.pandaSprite.setFrame(frame('Panda_stun_001.png'));
    this.pandaSprite.runAction(this.makeFall());
    gs.timmy.ignoreBlockers = true;
    game.playerIsInvincible = true;
    achievements.addToStat('pandaKills');
    achievements.report('RKR_6', 1);
    gs.timmy.overrideUserInput = true;
    gs.inputLayer.overrideUserInput = true;
    audio.stopMusic();
  }

  // Death effects
  explodePanda() {
    const ps = this.pandaSprite;
    if (!this.exploder) {
      this.exploder = new ParticleSystem(this.gameScene.particleConfigs.pandaExplode);
      this.exploder.x = ps.width * 0.5;
      this.exploder.y = ps.height * 0.5 + this.sensorOffsets.yToMiddle;
      ps.addChild(this.exploder, 3);
    } else {
      this.exploder.x = ps.width * RANDOM(0.5, 2);
      this.exploder.y = ps.height * RANDOM(0.5, 0.4) + this.sensorOffsets.yToMiddle;
      this.exploder.resetSystem();
    }
  }
  smokePanda() {
    const poof = new ParticleSystem(this.gameScene.particleConfigs.pandaPoof);
    this.sprite.addChild(poof, 2);
  }
  removePandaSprite() {
    // (The original's removeChild was a no-op; the panda has already faded to 0 opacity.)
    this.isActive = false;
    this.shouldUnschedule = true;
  }

  lowerDrawbridge() {
    const gs = this.gameScene;
    gs.bridge.runAction(new EaseBounceOut(new RotateTo(3, 0)));
    gs.chain.visible = true;
    gs.bridgeTicker = () => {
      const b = gs.bridge, bounds = b.boundingBox();
      const cx = bounds.x + 5, cy = bounds.y + bounds.h;
      gs.chain.x = cx; gs.chain.y = cy;
      const ax = b.x + 25, ay = b.y + b.width * 0.94;
      gs.chain.rotation = Math.atan2(ax - cx, ay - cy) * 180 / Math.PI;
    };
  }

  checkBridgeDistance() {
    const b = this.gameScene.bridge, t = this.gameScene.timmy.position;
    if (Math.abs(t.x - b.x) < TILE_SIZE_26 * 6 || Math.abs(t.y - b.y) > TILE_SIZE_26 * 5) {
      this.pandaSprite.runAction(this.makeFall2());
    }
  }

  fallCycleComplete() {
    const gs = this.gameScene;
    gs.playerWillWin();
    this.cleanup();
    gs.playerDidWin();
  }

  // Panda removes itself without the poof
  removeWithPoofButNotPoints() { this.isActive = false; }
  handleEnemyWasKilled() { this.cleanup(); }
  checkForStaticCollisions() { if (!this.defeated) super.checkForStaticCollisions(); }

  growl(pitch = 1, volume = 1) {
    audio.playEffect('panda_growl', { volume, rate: pitch });
  }
  onDistantTimer() {
    if (Math.floor(Math.random() * 3) !== 1 || game.gameplayIsPaused) return;
    this.growl(0.75, 0.15);
  }
  endDistantGrowls() { clearInterval(this.distantTimer); this.distantTimer = null; }
  cleanup() { this.endDistantGrowls(); }
  unscheduleUpdatesWithCleanup() { super.unscheduleUpdatesWithCleanup(); this.cleanup(); }
  playDeathSound() {}
}

// ------------------------------------------------------------------ Zorsicorn (chapter 3 finale)
const ZORSICORN_SPEED = 50;
const ZORSICORN_PAUSE_TIME = 0.8;
const Z = { Waiting: 1, Walking: 2, Dash: 3, Shooting: 4, Dying: 5, Dead: 6, Exiting: 7 };
const ZORS_PARTICLES = ['zorsicornComet', 'zorsicornCometHit', 'zorsicornSpawn', 'zorsicornAttack',
  'zorsicornSplode_part1', 'zorsicornSplode_part2', 'zorsicornSplode_part3'];

export async function preloadZorsicorn(chapter) {
  const cfgs = await Promise.all(ZORS_PARTICLES.map(n => loadParticles(n)));
  await loadPlatformImage('rainbowBlur.png', chapter);
  const out = {};
  ZORS_PARTICLES.forEach((n, i) => { out[n] = cfgs[i]; });
  return out;
}

export class Zorsicorn extends BaseBossEnemy {
  createSprite() {
    const container = new Sprite('transparent.png');
    this.zSprite = container.addChild(new Sprite('Zor_run_001.png'), 2);
    this.zSprite.anchorX = 0; this.zSprite.anchorY = 0;
    this.zSprite.opacity = 0;
    container.width = this.zSprite.width; container.height = this.zSprite.height;
    return container;
  }

  // Particle systems need configs from the scene, so they're built on first activation
  buildEffects() {
    if (this.effectsBuilt) return;
    this.effectsBuilt = true;
    const cfg = this.gameScene.particleConfigs;
    const c = this.sprite, z = this.zSprite, mid = { x: z.width * 0.5, y: z.height * 0.5 + this.sensorOffsets.yToMiddle };
    const make = (name, zOrder, pos) => {
      const ps = new ParticleSystem(cfg[name]);
      ps.stopSystem(); ps.particles = [];
      if (pos) { ps.x = pos.x; ps.y = pos.y; }
      c.addChild(ps, zOrder);
      return ps;
    };
    this.comet = make('zorsicornComet', 3);
    this.cometHit = make('zorsicornCometHit', 4);
    this.magicFloor = make('zorsicornSpawn', 5);
    this.splode3 = make('zorsicornSplode_part3', 6, mid);
    this.splode2 = make('zorsicornSplode_part2', 7, mid);
    this.splode1 = make('zorsicornSplode_part1', 8, mid);
  }

  setInitialState() {
    super.setInitialState();
    this.pointValue = POINTS.ZORSICORN;
    this.state = Z.Waiting;
    this.checkLeadingFoot = true;
    this.extraSpriteFlip = false;
    this.timers = [];
  }

  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 18, yToMiddle: -21, yToBottom: -55, xToMiddleRight: 12, xToBottomRight: 12 });
  }

  createAnimations() {
    super.createAnimations();
    const run = animFrames('Zor_run_00', 9, 1);
    this.makeWalkForward = () => new Sequence(new Animate(run, 0.1), new Call(() => this.nextAction()));
    this.makeWalkBackward = () => new Sequence(new Animate([...run].reverse(), 0.1),
      new Call(() => { this.extraSpriteFlip = false; this.nextAction(); }));
    this.makePause = () => new Sequence(new Delay(ZORSICORN_PAUSE_TIME), new Call(() => this.nextAction()));
    this.makeDash = () => new Sequence(
      new Animate(animFrames('Zor_stand_0', 8, 10), 0.08, false),
      new Animate(['Zor_dash_001.png', 'Zor_dash_002.png'], 0.08),
      new Call(() => this.runDashAttack()));
    const lower = [];
    for (let i = 17; i >= 10; i--) lower.push(`Zor_stand_0${i}.png`);
    this.makeShoot = () => new Sequence(
      new Animate(animFrames('Zor_stand_0', 4, 10), 0.08, false),
      new Repeat(new Spawn(new Animate(animFrames('Zor_stand_0', 4, 14), 0.08, true), new Call(() => this.launchFireballs())), 3),
      new Animate(lower, 0.1),
      new Call(() => this.gameScene.smallCameraShake()),
      new Call(() => this.shootCycleComplete()));
    this.makeFall = () => new Spawn(
      new Sequence(new Call(() => this.gameScene.inputLayer.overrideJump()), new Call(() => this.getTimmyToSafePoint())),
      new Sequence(
        new Call(() => audio.playEffect('panda_death')), new Call(() => this.splodeStep1()),
        new Delay(1.5),
        new Call(() => this.splodeStep2()),
        FadeOut(0.5),
        new Call(() => { this.isActive = false; this.shouldUnschedule = true; }),
        new Call(() => this.lowerDrawbridge()), new Delay(4.0),
        new Call(() => this.fallCycleComplete())));
    this.makeStun = () => new Sequence(
      new Spawn(new Repeat(new Animate(['Zor_rub_001.png', 'Zor_rub_002.png'], 0.09), 9),
        new Repeat(new Sequence(new FadeTo(0.125, 60), new FadeTo(0.125, 200)), 6)),
      FadeIn(0), new Call(() => this.stunActionDidFinish()), new Delay(1));
  }

  // setTimeout replacement that runs on game time and stops when the boss is cleaned up
  after(seconds, fn) { this.timers.push({ t: seconds, fn }); }
  update(dt) {
    super.update(dt);
    for (const t of [...this.timers]) {
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(this.timers.indexOf(t), 1); t.fn(); }
    }
  }

  didBecomeActive() {
    this.buildEffects();
    super.didBecomeActive();
  }

  overrideX(x) { const il = this.gameScene.inputLayer; il.overrideUserInput = true; il.overrideX = x; }
  stopTimmy() { this.overrideX(0); }

  onEvent(name) {
    if (name === 'timmyLockIn' && !this.lockHandled) {
      this.lockHandled = true;
      audio.stopMusic();
      this.gameScene.closeBossDoor(85, 8);
    } else if (name === 'zorsicornEnter' && !this.enterHandled) {
      if (this.state >= Z.Dying) { this.stopTimmy(); return; }
      this.enterHandled = true;
      this.stopTimmy();
      this.launchComet();
      this.gameScene.timmy.killedByBoss = true;
    } else if (name === 'zorsicornExitReached') {
      this.stopTimmy();
      this.fallCycleComplete();
    }
  }

  launchComet() {
    this.buildEffects();
    audio.playEffect('unicorn_appear');
    const z = this.zSprite;
    this.comet.x = -300; this.comet.y = 700;
    this.cometEnd = { x: z.width * 0.5, y: z.height * 0.5 + this.sensorOffsets.yToBottom };
    const cp = { x: this.cometEnd.x, y: this.cometEnd.y + 200 };
    this.comet.runAction(new Sequence(
      new BezierTo(0.4, cp, cp, this.cometEnd),
      new Call(() => this.spawnZorsicorn()),
      new Call(() => this.gameScene.inputLayer.overrideJump()),
      new Call(() => this.overrideX(-0.75)), new Delay(1),
      new Call(() => this.overrideX(1)), new Delay(0.15),
      new Call(() => this.stopTimmy())));
    this.comet.resetSystem();
  }

  spawnZorsicorn() {
    this.comet.stopSystem();
    this.gameScene.smallCameraShake();
    Object.assign(this.cometHit, this.cometEnd); this.cometHit.resetSystem();
    Object.assign(this.magicFloor, this.cometEnd); this.magicFloor.resetSystem();
    const grow = () => {
      if (this.state === Z.Exiting) return;
      const c = this.magicFloor.c;
      if (c.startParticleSize > 150 && this.zSprite.opacity === 0) {
        this.zSprite.flipX = true;
        this.zSprite.runAction(FadeIn(0.5));
      }
      if (c.startParticleSize < 200) {
        c.startParticleSize += 15;
        this.after(0.1, grow);
      } else {
        this.magicFloor.stopSystem();
        this.after(1.5, () => this.completeEntrance());
      }
    };
    this.after(0.1, grow);
  }

  completeEntrance() {
    if (this.state === Z.Exiting) return;
    audio.playMusic('CH_3_bad_guy.mp3', true);
    this.walkTowardsTimmy();
    this.gameScene.inputLayer.overrideUserInput = false;
  }

  timmyToTheRight() { return this.gameScene.timmy.position.x > this.position.x; }

  stopZActions() {
    for (const a of [...this.zSprite.actions]) this.zSprite.stopAction(a);
  }

  nextAction() {
    this.removeDashBlur();
    this.stopZActions();
    switch (Math.floor(Math.random() * 10)) {
      case 0: case 1: this.walkTowardsTimmy(); break;
      case 2: this.pause(); break;
      case 3: this.backAwayFromTimmy(); break;
      case 4: case 5: case 6:
        if (this.hits < 3) { this.pause(); break; }
        this.dashAtTimmy(); break;
      default: this.shootAtTimmy();
    }
  }

  walkTowardsTimmy() {
    const right = this.timmyToTheRight();
    this.currentVelocity.x = right ? ZORSICORN_SPEED : -ZORSICORN_SPEED;
    this.zSprite.flipX = !right;
    this.stopZActions();
    this.zSprite.runAction(this.makeWalkForward());
    this.state = Z.Walking;
    audio.playEffect('unicorn_gallop_single');
  }
  backAwayFromTimmy() {
    const right = this.timmyToTheRight();
    this.zSprite.flipX = !right;
    this.currentVelocity.x = right ? -ZORSICORN_SPEED : ZORSICORN_SPEED;
    this.stopZActions();
    this.zSprite.runAction(this.makeWalkBackward());
    audio.playEffect('unicorn_gallop_single');
    this.state = Z.Walking;
  }
  shouldContinueAfterLeadingFootHitEdge() {
    this.currentVelocity.x *= -1;
    if (this.state === Z.Dash) this.pause();
    this.nextAction();
    return false;
  }
  pause() {
    this.currentVelocity.x = 0;
    this.stopZActions();
    this.zSprite.setFrame(frame('Zor_stand_010.png'));
    this.zSprite.runAction(this.makePause());
  }

  dashAtTimmy() {
    const right = this.timmyToTheRight();
    this.zSprite.flipX = !right;
    this.dashDirection = right ? ZORSICORN_SPEED : -ZORSICORN_SPEED;
    // Don't dash off the island: the brake zones force the direction
    const rect = this.collisionRect();
    const brakeL = this.gameScene.triggerForName('dashBrakeLeft');
    const brakeR = this.gameScene.triggerForName('dashBrakeRight');
    if (brakeL && rectIntersects(brakeL.rect, rect)) { this.dashDirection = ZORSICORN_SPEED; this.zSprite.flipX = false; }
    if (brakeR && rectIntersects(brakeR.rect, rect)) { this.dashDirection = -ZORSICORN_SPEED; this.zSprite.flipX = true; }
    this.currentVelocity.x = 0;
    this.stopZActions();
    this.zSprite.runAction(this.makeDash());
    this.state = Z.Dash;
  }
  runDashAttack() {
    this.zSprite.setFrame(frame('Zor_dash_002.png'));
    this.currentVelocity.x = this.dashDirection * 12;
    audio.playEffect('unicorn_zoom_forward');
    this.removeDashBlur();
    const img = assets.images['assets/sprites/rainbowBlur-hd.png'] || assets.images['assets/sprites/rainbowBlur.png'];
    if (!img) return;
    const c = this.sprite, z = this.zSprite, oy = this.sensorOffsets.yToMiddle;
    const streak = new MotionStreak(img, 0.35, 32, 0.5,
      () => ({ x: c.x - c.width / 2 + z.width / 2, y: c.y - c.height / 2 + z.height / 2 + oy }));
    streak.origin = () => ({ x: c.x - c.width / 2, y: c.y - c.height / 2 });
    this.blur = c.addChild(streak, 0);
  }
  removeDashBlur() { if (this.blur) { this.blur.removeFromParent(); this.blur = null; } }

  shootAtTimmy() {
    this.currentVelocity.x = 0;
    this.zSprite.flipX = !this.timmyToTheRight();
    this.stopZActions();
    this.zSprite.runAction(this.makeShoot());
    this.state = Z.Shooting;
    if (!this.sparkles) {
      this.sparkles = new ParticleSystem(this.gameScene.particleConfigs.zorsicornAttack);
      this.sparkles.x = this.zSprite.width * 0.5;
      this.sparkles.y = this.zSprite.height * 0.5 + this.sensorOffsets.yToMiddle;
      this.sprite.addChild(this.sparkles, 1);
    } else this.sparkles.resetSystem();
  }
  launchFireballs() {
    const deg = this.timmyToTheRight() ? 335 + Math.floor(Math.random() * 50) : 135 + Math.floor(Math.random() * 50);
    const p = this.position;
    this.gameScene.launchFireball(p.x, p.y - 10, deg * Math.PI / 180, RANDOM(200, 50), RANDOM(30, 20), 8, FireballType.Sparkle);
  }
  shootCycleComplete() {
    this.walkTowardsTimmy();
    if (this.sparkles) this.sparkles.stopSystem();
  }

  handleCollisionWithPlayerRect(rect) {
    if (this.isStunned || this.defeated) return EnemyCollision.None;
    const r = super.handleCollisionWithPlayerRect(rect);
    // Stomping him mid-dash doesn't work: Timmy gets hurt instead
    if (this.state === Z.Dash && r === EnemyCollision.EnemyDamaged) return EnemyCollision.PlayerDamaged;
    return r;
  }
  hitShouldKillEnemy() {
    if (this.state === Z.Dash) return false;
    this.hits++;
    if (this.hits >= 5) {
      this.sprite.stopAllActions();
      this.sprite.opacity = 255;
      this.defeated = true;
      this.bossWasDefeated();
    } else this.stun();
    return false;
  }
  stun() {
    if (this.sparkles) this.sparkles.stopSystem();
    this.stopZActions();
    this.currentVelocity.x = 0;
    this.isStunned = true;
    audio.playEffect('unicorn_hurt');
    this.zSprite.runAction(this.makeStun());
  }
  stunActionDidFinish() {
    this.isStunned = false;
    this.dashAtTimmy();
  }

  bossWasDefeated() {
    const gs = this.gameScene;
    this.state = Z.Dying;
    this.currentVelocity.x = 0;
    game.playerIsInvincible = true;
    game.addPoints(this.pointValue);
    game.enemiesKilledCount += 1;
    pointsLabel(gs.gameLayer, this.pointValue, this.sprite.x, this.sprite.y);
    if (this.sparkles) { this.sparkles.removeFromParent(); this.sparkles = null; }
    this.removeDashBlur();
    this.stopZActions();
    this.zSprite.runAction(this.makeFall());
    gs.timmy.ignoreBlockers = true;
    audio.stopMusic();
    achievements.report('RKR_7', 1);
  }

  getTimmyToSafePoint() {
    const t = this.gameScene.triggerForName('zorsicornEnter');
    this.enterHandled = false;   // running Timmy back to the spawn point; the trigger stops him there
    if (!t) return;
    this.overrideX(this.gameScene.timmy.position.x > t.rect.x ? -0.75 : 1);
  }

  splodeStep1() { this.splode1.resetSystem(); }
  splodeStep2() {
    this.splode1.stopSystem();
    this.splode2.resetSystem();
    this.splode3.resetSystem();
    this.state = Z.Dead;
  }

  lowerDrawbridge() {
    const gs = this.gameScene;
    gs.timmy.ignoreGravity = true;
    gs.bridge.runAction(new EaseBounceOut(new RotateTo(3, 0)));
    gs.chain.visible = true;
    gs.bridgeTicker = () => {
      const b = gs.bridge, bounds = b.boundingBox();
      const cx = bounds.x + 5, cy = bounds.y + bounds.h;
      gs.chain.x = cx; gs.chain.y = cy;
      gs.chain.rotation = Math.atan2(b.x + 25 - cx, b.y + b.width * 0.94 - cy) * 180 / Math.PI;
    };
  }

  fallCycleComplete() {
    if (this.finished) return;
    this.finished = true;
    const gs = this.gameScene;
    gs.playerWillWin();
    this.cleanup();
    gs.playerDidWin();
  }

  removeWithPoofButNotPoints() {}
  handleEnemyWasKilled() { this.cleanup(); }
  checkForStaticCollisions() { if (!this.defeated) super.checkForStaticCollisions(); }
  cleanup() {
    this.state = Z.Exiting;
    this.timers = [];
  }
  playDeathSound() {}
}

// ------------------------------------------------------------------ Mitch's projectiles
// Both live in a transparent container sprite so the particle effects can sit on their own layers.
function projectileContainer(frameName, contentFromFrame) {
  const container = new Sprite('transparent.png');
  const inner = container.addChild(new Sprite(frameName), 1);
  inner.anchorX = 0; inner.anchorY = 0;
  if (contentFromFrame) { container.width = inner.width; container.height = inner.height; }
  return [container, inner];
}

export class Firecracker extends BaseEnemy {
  createSprite() {
    const [c, inner] = projectileContainer('mitch_firecracker_006.png', false);
    this.inner = inner;
    inner.anchorX = 0.52; inner.anchorY = 0.25;
    return c;
  }
  createAnimations() {
    this.inner.runAction(new RepeatForever(new Animate(animFrames('mitch_firecracker_00', 3, 6), 0.15)));
    this.rotationSpeed = Math.floor(Math.random() * 10);
    this.rotationDir = Math.random() < 0.5 ? 1 : -1;
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 20, yToMiddle: 0, yToBottom: -25, xToMiddleRight: 30, xToBottomRight: 30 });
  }
  setInitialState() { this.pointValue = 0; this.fuse = 0.75; this.fcState = 0; this.checkLeadingFoot = true; }
  shouldContinueAfterLeadingFootHitEdge() { return true; }
  update(dt) {
    super.update(dt);
    if (this.shouldUnschedule) return;
    if (!this.soundStarted) { this.soundStarted = true; audio.playEffect('mitch_toss_fire'); }
    this.fuse -= dt;
    if (this.fuse <= 0) this.blowUp();
    if (this.currentVelocity.y === 0) { this.currentVelocity.x = 0; this.blowUp(); }
    if (this.currentVelocity.y !== 0) this.inner.rotation += this.rotationSpeed * this.rotationDir;
  }
  blowUp() {
    if (this.fcState >= 1) return;
    this.fcState = 1;
    this.inner.opacity = 0;
    this.currentVelocity = { x: 0, y: 0 };
    this.ignoreGravity = true;
    const cfg = this.gameScene.particleConfigs;
    for (const n of ['firecrackerBoom', 'firecrackerPoof']) this.sprite.addChild(new ParticleSystem(cfg[n]), 2);
    audio.playEffect('mitch_firework');
    this.inner.runAction(new Sequence(new Delay(0.3), new Call(() => {
      this.fcState = 2;
      this.inner.runAction(new Sequence(new Delay(2), new Call(() => this.removeSelf())));
    })));
  }
  removeSelf() {
    this.isActive = false;
    this.parentNode.removeChild(this.sprite);
    this.shouldUnschedule = true;
    this.gameScene.removeEnemy(this);
  }
  // Only the explosion hurts
  handleCollisionWithPlayerRect(rect) {
    this.applySensorOffsetsFromPoint(this.position);
    if (!rectIntersects(rect, this.collisionRect())) return EnemyCollision.None;
    return this.fcState === 1 ? EnemyCollision.PlayerDamaged : EnemyCollision.None;
  }
  hitShouldKillEnemy() { return false; }
  removeWithPoofButNotPoints() {}
  playDeathSound() {}
}

export class Barrel extends BaseEnemy {
  createSprite() {
    const [c, inner] = projectileContainer('mitch_barrel_008.png', true);
    this.inner = inner;
    inner.anchorX = 0.5; inner.anchorY = 0.5;
    inner.x = c.width * 0.5; inner.y = c.height * 0.5;
    return c;
  }
  createAnimations() {
    this.spin = this.inner.runAction(new RepeatForever(new Animate(animFrames('mitch_barrel_00', 7, 2), 0.15)));
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 22, yToMiddle: 0, yToBottom: -22, xToMiddleRight: 22, xToBottomRight: 22 });
  }
  setInitialState() { this.pointValue = 0; this.bState = 0; this.checkLeadingFoot = true; }
  shouldContinueAfterLeadingFootHitEdge() { return true; }
  update(dt) {
    super.update(dt);
    if (this.shouldUnschedule) return;
    if (this.currentVelocity.x === 0) this.blowUp();
    if (this.currentVelocity.y === 0 && this.bState === 0) {
      // Landed: start rolling
      this.rotationSpeed = Math.abs(this.currentVelocity.x / 25);
      this.rotationDir = this.currentVelocity.x > 0 ? 1 : -1;
      this.inner.stopAllActions();
      this.bState = 1;
      this.inner.setFrame(frame('mitch_barrel_008.png'));
    }
    if (this.bState === 1) this.inner.rotation += this.rotationSpeed * this.rotationDir;
  }
  handleXCollision(movingRight, overrun) {
    super.handleXCollision(movingRight, overrun);
    this.blowUp();
  }
  blowUp() {
    if (this.bState >= 2) return;
    this.bState = 2;
    this.inner.opacity = 0;
    this.currentVelocity = { x: 0, y: 0 };
    this.ignoreGravity = true;
    const smoke = new ParticleSystem(this.gameScene.particleConfigs.firecrackerPoof);
    smoke.x = this.sprite.width * 0.5; smoke.y = this.sprite.height * 0.5 + this.sensorOffsets.yToMiddle;
    this.sprite.addChild(smoke, 2);
    audio.playEffect('mitch_barrel_crash');
    this.inner.runAction(new Sequence(new Delay(0.3), new Call(() => {
      this.bState = 3;
      this.inner.runAction(new Sequence(new Delay(2), new Call(() => this.removeSelf())));
    })));
  }
  removeSelf() {
    this.isActive = false;
    this.parentNode.removeChild(this.sprite);
    this.shouldUnschedule = true;
    this.gameScene.removeEnemy(this);
  }
  handleCollisionWithPlayerRect(rect) {
    this.applySensorOffsetsFromPoint(this.position);
    if (!rectIntersects(rect, this.collisionRect())) return EnemyCollision.None;
    return this.bState === 3 ? EnemyCollision.None : EnemyCollision.PlayerDamaged;
  }
  hitShouldKillEnemy() { return false; }
  removeWithPoofButNotPoints() {}
  playDeathSound() {}
}

// ------------------------------------------------------------------ Mitch (chapter 4 finale)
const MITCH_SPEED = 70;
const M = {
  Waiting: 1, Entering: 2, Paused: 3, Walking: 4, Grabbing: 5, Throwing: 6, Jumping: 7,
  StompUp: 8, StompPause: 9, StompDown: 10, WaitingToAttack: 11, Dying: 12, Dead: 13,
};

export async function preloadMitch() {
  const out = {};
  for (const n of ['firecrackerBoom', 'firecrackerPoof']) out[n] = await loadParticles(n);
  return out;
}

export class Mitch extends BaseBossEnemy {
  createSprite() {
    const container = new Sprite('transparent.png');
    const m = container.addChild(new Sprite('mitch_fall_022.png'), 3);
    m.anchorX = 0; m.anchorY = 0;
    container.width = m.width; container.height = m.height;
    m.setFrame(frame('transparent.png'));   // invisible until he slides down the rope
    this.mitchSprite = m;
    this.emptyRope = container.addChild(new Sprite('mitch_fall_015.png'), 0);
    this.emptyRope.anchorX = 0; this.emptyRope.anchorY = 0;
    this.emptyRope.opacity = 0;
    audio.addEffectsList('mitchHurt', ['mitch_ugh_1', 'mitch_ugh_2', 'mitch_ugh_3']);
    return container;
  }

  setInitialState() {
    super.setInitialState();
    this.pointValue = POINTS.MITCH;
    this.state = M.Waiting;
    this.checkLeadingFoot = true;
    this.extraSpriteFlip = false;
    this.ignoreGravity = true;
    this.entranceSequenceComplete = false;
  }

  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 30, yToMiddle: -21, yToBottom: -50, xToMiddleRight: 15, xToBottomRight: 15 });
  }

  createAnimations() {
    super.createAnimations();
    const pad = i => String(i).padStart(3, '0');
    const fall = (a, b) => { const out = []; for (let i = a; i <= b; i++) out.push(`mitch_fall_${pad(i)}.png`); return out; };
    const jump = () => new Call(() => this.gameScene.inputLayer.overrideJump());
    const left = () => new Call(() => this.overrideX(-0.75));
    const right = () => new Call(() => this.overrideX(0.75));
    const stop = () => new Call(() => this.overrideX(0));

    this.makeEntrance = () => new Sequence(stop(),
      new Animate(fall(4, 14), 0.15, false), new Call(() => this.mitchFall()),
      new Animate(fall(16, 19), 0.15, false),
      left(), new Delay(0.5), stop(), right(), new Delay(0.15), stop());
    this.makeStand = () => new Sequence(new Animate(fall(20, 22), 0.15, false), new Call(() => this.onEntranceComplete()));
    const pauseFrames = [22, 21, 20, 21, 22].map(i => `mitch_fall_${pad(i)}.png`);
    this.makePause = () => new Sequence(new Animate(pauseFrames, 0.33), new Call(() => this.nextAction()));
    const run = []; for (let i = 1; i <= 15; i++) run.push(`mitch_run_${pad(i)}.png`);
    this.makeWalk = () => new Sequence(new Animate(run, 0.07), new Call(() => this.onWalkComplete()));
    this.makeM80 = () => new Sequence(
      new Animate(animFrames('mitch_firecracker_00', 4, 1), 0.1, false),
      new Call(() => this.launchFirecracker()),
      new Animate(['mitch_firecracker_005.png'], 0.1, false),
      new Delay(0.5), new Call(() => this.onThrowComplete()));
    this.makeBarrel = () => new Sequence(
      new Animate(animFrames('mitch_throw_00', 7, 1), 0.1, false),
      new Call(() => this.barrelMitchMove()),
      new Animate(['mitch_throw_008.png', 'mitch_throw_009.png'], 0.1, false),
      new Call(() => this.launchBarrel()),
      new Animate(['mitch_throw_010.png'], 0.1, false),
      new Delay(2.0), new Call(() => this.onThrowComplete()));
    const stunSpawn = () => new Spawn(
      new Animate(animFrames('mitch_hopback_00', 8, 1), 0.15),
      new Repeat(new Sequence(new FadeTo(0.125, 60), new FadeTo(0.125, 200)), 6));
    this.makeStun = () => new Sequence(stunSpawn(), FadeIn(0), new Call(() => this.stunActionDidFinish()), new Delay(1));
    this.makeDeath = () => new Sequence(
      new Spawn(stunSpawn(), new Sequence(stop(), jump(), new Delay(0.35), right(), new Delay(0.15), stop())),
      new RotateBy(0.33, 15), new Call(() => this.bossDeathDidComplete()));
    const jumpPrep = () => [
      new Animate(fall(20, 22).reverse(), 0.15, false),
      new Call(() => { this.sensorOffsets.yToBottom = -38; }),
      new Animate(['mitch_fall_019.png'], 0.15, false),
      new Delay(0.5)];
    const jumpUp = () => new Animate(['mitch_fall_018.png', 'mitch_fall_017.png'], 0.08, false);
    this.makeJump = () => new Sequence(...jumpPrep(), new Call(() => this.executeJump()), jumpUp());
    this.makeCritter = () => new Sequence(...jumpPrep(), new Call(() => this.executeCritterJump()), jumpUp());
    this.makeJumpLand = () => new Sequence(
      new Call(() => this.jumpLand()), new Delay(0.5),
      new Call(() => { this.sensorOffsets.yToBottom = -50; }),
      new Animate(fall(20, 22), 0.33, false),
      new Call(() => { this.landing = null; this.pause(); this.isStunned = false; }));
  }

  overrideX(x) { const il = this.gameScene.inputLayer; il.overrideUserInput = true; il.overrideX = x; }
  timmyToTheRight() { return this.gameScene.timmy.position.x > this.position.x; }
  run(a) { this.current = a; return this.mitchSprite.runAction(a); }
  // Stops everything except the stun animation
  stopMitchActions() {
    for (const a of [...this.mitchSprite.actions]) if (a !== this.stunAnim) this.mitchSprite.stopAction(a);
    this.landing = null;
  }

  onEvent(name) {
    if (name === 'mitchEnter' && !this.enterHandled) {
      this.enterHandled = true;
      audio.stopMusic();
      this.gameScene.timmy.killedByBoss = true;
      this.state = M.Entering;
      this.currentVelocity.x = 0;
      this.run(this.makeEntrance());
      audio.playEffect('mitch_laugh');
    } else if (name === 'critterAttack') {
      this.releaseCritters();
    } else if (name === 'stompBrake' && this.state === M.StompUp) {
      this.state = M.StompPause;
      this.stompTimer = 0.35;
      this.currentVelocity = { x: 0, y: 0 };
      this.ignoreGravity = true;
    }
  }

  mitchFall() { this.ignoreGravity = false; this.emptyRope.opacity = 255; }

  standMitchUp() {
    this.stopMitchActions();
    this.run(this.makeStand());
    this.entranceSequenceComplete = true;
    this.gameScene.inputLayer.overrideUserInput = false;
    audio.playEffect('mitch_land');
    this.gameScene.smallCameraShake();
    this.pause();
    this.emptyRope.runAction(FadeOut(0.15));
  }
  onEntranceComplete() {
    this.entranceSequenceComplete = true;
    audio.playMusic('CH_4_bad_guy.mp3', true);
  }

  update(dt) {
    super.update(dt);
    if (this.state >= M.Dying || !this.isActive) return;
    const v = this.currentVelocity;
    if (!this.entranceSequenceComplete && this.state === M.Entering && v.y === 0 && !this.ignoreGravity) this.standMitchUp();
    if ((this.state === M.Jumping || this.state === M.StompDown) && v.y === 0 && !this.landing) {
      this.landing = this.run(this.makeJumpLand());
    }
    if (this.state === M.StompUp) {
      const x = this.position.x;
      if ((v.x < 0 && x < this.stompTarget.x) || (v.x >= 0 && x > this.stompTarget.x) || x === this.stompTarget.x) {
        this.state = M.StompPause;
        this.stompTimer = 0.35;
        this.currentVelocity = { x: 0, y: 0 };
        this.ignoreGravity = true;
      }
    }
    if (this.state === M.StompPause) {
      this.stompTimer -= dt;
      if (this.stompTimer <= 0) {
        this.state = M.StompDown;
        this.ignoreGravity = false;
        this.currentVelocity.y = -525;
      }
    }
    this.gameScene.checkForTriggerInRect(this.sprite.boundingBox());
  }

  nextAction() {
    if (this.state >= M.Dying) return;
    this.stopMitchActions();
    const p = this.position;
    const tc = this.gameScene.tileCoordinatesFromWorldLocation({ x: p.x, y: p.y + this.sensorOffsets.yToMiddle });
    const props = this.gameScene.propertiesForTileWithCoordinates(tc);
    const atBarrelStore = !!props && bool(props.barrelStore);
    const dist = Math.abs(this.gameScene.timmy.position.x - p.x);
    switch (Math.floor(Math.random() * 10)) {
      case 0: this.pause(); break;
      case 1: case 2: if (atBarrelStore) this.throwBarrel(); else this.walkTowardsTimmy(); break;
      case 4: case 5: if (dist > TILE_SIZE_26 * 6) this.jumpAtTimmy(); else this.throwFirecracker(); break;
      case 6: case 7: case 8: this.throwFirecracker(); break;
      default: this.walkTowardsTimmy();
    }
  }

  pause() {
    this.mitchSprite.flipX = this.timmyToTheRight();
    this.currentVelocity.x = 0;
    this.stopMitchActions();
    this.run(this.makePause());
    this.state = M.Paused;
  }
  walkTowardsTimmy() {
    const right = this.timmyToTheRight();
    this.currentVelocity.x = right ? MITCH_SPEED : -MITCH_SPEED;
    this.mitchSprite.flipX = !right;
    this.sensorOffsets.yToBottom = -55;
    this.stopMitchActions();
    this.run(this.makeWalk());
    this.state = M.Walking;
  }
  onWalkComplete() {
    this.currentVelocity.x = 0;
    this.sensorOffsets.yToBottom = -50;
    const p = this.position; this.position = { x: p.x, y: p.y - 5 };
    this.nextAction();
  }
  shouldContinueAfterLeadingFootHitEdge() {
    this.currentVelocity.x *= -1;
    if (this.state === M.Jumping) this.pause();
    this.nextAction();
    return false;
  }

  jumpAtTimmy() { this.run(this.makeJump()); }
  executeJump() {
    this.state = M.StompUp;
    this.collisionLockedBottom = false;
    const dir = this.timmyToTheRight() ? 1 : -1;
    this.stompTarget = { x: this.gameScene.timmy.position.x, y: this.position.y + 100 };
    this.currentVelocity = { x: 500 * dir, y: 600 };
  }
  jumpLand() {
    this.state = M.WaitingToAttack;
    this.currentVelocity.x = 0;
    this.gameScene.smallCameraShake();
    audio.playEffect('mitch_land');
    this.critterRectTriggered = false;
    this.mitchSprite.setFrame(frame('mitch_fall_019.png'));
  }

  throwFirecracker() {
    this.throwing = true;
    const right = this.timmyToTheRight();
    this.mitchSprite.flipX = !right;
    this.throwDirection = right ? 1 : -1;
    this.sensorOffsets.yToBottom = -60;
    this.currentVelocity.x = 0;
    this.run(this.makeM80());
  }
  throwBarrel() {
    this.throwing = true;
    const right = this.timmyToTheRight();
    this.mitchSprite.flipX = !right;
    this.throwDirection = right ? 1 : -1;
    this.sensorOffsets.yToBottom = -60;
    this.currentVelocity.x = 0;
    audio.playEffect('mitch_pick_up_barrel');
    this.run(this.makeBarrel());
  }
  onThrowComplete() {
    this.sensorOffsets.yToBottom = -50;
    const p = this.position; this.position = { x: p.x, y: p.y - 10 };
    this.nextAction();
  }
  barrelMitchMove() {
    this.sprite.runAction(new MoveBy(0.15, 10 * (this.timmyToTheRight() ? 1 : -1), 0));
  }
  launchFirecracker() {
    let vx = (200 + Math.floor(Math.random() * 150)) * this.throwDirection;
    let vy = 150 + Math.floor(Math.random() * 100);
    if (this.throwCancelled) { vx = 0; vy = 100; }
    const p = this.position;
    this.gameScene.launchProjectile({ x: p.x + 25 * this.throwDirection, y: p.y + 30 }, vx, vy,
      new Firecracker(this.gameScene.gameLayer, false));
    this.throwing = this.throwCancelled = false;
  }
  launchBarrel() {
    let vx = (200 + Math.floor(Math.random() * 150)) * this.throwDirection;
    let vy = 150;
    if (this.throwCancelled) { vx = 0; vy = 100; }
    const p = this.position;
    this.gameScene.launchProjectile({ x: p.x + 25 * this.throwDirection, y: p.y + 35 }, vx, vy,
      new Barrel(this.gameScene.gameLayer, false));
    this.throwing = this.throwCancelled = false;
  }

  hitShouldKillEnemy() {
    this.hits++;
    if (this.hits >= 7) {
      this.sprite.stopAllActions();
      this.sprite.opacity = 255;
      this.defeated = true;
      this.bossWasDefeated();
      audio.playEffect('mitch_final_hit');
    } else this.stun();
    return false;
  }
  stun() {
    if (this.throwing) this.throwCancelled = true;
    this.stopMitchActions();
    this.currentVelocity.x = 0;
    this.isStunned = true;
    this.stunAnim = this.mitchSprite.runAction(this.makeStun());
    audio.playRandomEffect('mitchHurt');
  }
  stunActionDidFinish() {
    this.isStunned = false;
    this.stunAnim = null;
    if (this.hits % 2 === 0) this.runCritterAttack();
    else this.nextAction();
  }

  // Every second hit Mitch leaps up out of the arena and drops critters on Timmy
  runCritterAttack() {
    this.isStunned = true;
    this.run(this.makeCritter());
  }
  executeCritterJump() {
    this.state = M.Jumping;
    this.collisionLockedBottom = false;
    this.currentVelocity = { x: 10 * (this.timmyToTheRight() ? 1 : -1), y: 1500 };
  }
  releaseCritters() {
    if (this.critterRectTriggered || this.state >= M.Dying) return;
    this.critterRectTriggered = true;
    this.currentVelocity = { x: 0, y: 0 };
    const p = this.position; this.position = { x: p.x, y: p.y + 150 };
    this.ignoreGravity = true;
    const gs = this.gameScene;
    const area = gs.triggerForName('critterAttack');
    if (area) {
      const o = { x: area.rect.x + area.rect.w * 0.25, y: area.rect.y };
      const spawn = (count, make, vx) => {
        for (let i = 0; i < count; i++) {
          const e = make();
          e.ignoreActiveBox = true;
          o.x += area.rect.w * 0.1 * i;
          gs.launchProjectile({ x: o.x, y: o.y }, vx, -25, e);
        }
      };
      if (this.hits === 2) spawn(2, () => new Hamster(gs.gameLayer, false), 28);
      if (this.hits === 4) spawn(2, () => { const g = new Gigglesnout(gs.gameLayer, false, 'red'); g.patrolAnchorX = o.x; return g; }, 0);
      if (this.hits === 6) spawn(3, () => new RageBunny(gs.gameLayer, false), 0);
    }
    this.mitchSprite.runAction(new Sequence(new Delay(2), new Call(() => {
      this.ignoreGravity = false;
      this.isStunned = false;
    })));
  }

  bossWasDefeated() {
    const gs = this.gameScene;
    audio.stopMusic();
    this.mitchSprite.stopAllActions();
    this.sprite.stopAllActions();
    game.addPoints(this.pointValue);
    game.enemiesKilledCount += 1;
    pointsLabel(gs.gameLayer, this.pointValue, this.sprite.x, this.sprite.y);
    this.state = M.Dying;
    this.currentVelocity.x = 0;
    game.playerIsInvincible = true;
    gs.playerWillWin();
    this.mitchSprite.setFrame(frame('mitch_fall_016.png'));
    this.mitchSprite.runAction(this.makeDeath());
    achievements.report('RKR_8', 1);
  }
  bossDeathDidComplete() {
    this.state = M.Dead;
    this.isActive = false;
    this.gameScene.playerDidWin();
  }
  handleEnemyWasKilled() {}
  removeWithPoofButNotPoints() {}
  checkForStaticCollisions() { if (!this.defeated) super.checkForStaticCollisions(); }
  playDeathSound() {}
}
