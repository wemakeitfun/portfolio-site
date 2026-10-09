// Port of BaseEnemy.m and the chapter enemies.
import { Sprite, Animate, Sequence, Repeat, RepeatForever, Spawn, Call, MoveBy, Delay, animFrames, frame, rectIntersects } from './engine.js';
import { BaseCharacter, TILE_SIZE_26, CHARACTER_COLLISION_SINK, isInstaDeath } from './character.js';
import { EnemyCollision } from './timmy.js';
import { smokePoof, pointsLabel } from './effects.js';
import { game, POINTS, achievements } from './model.js';
import * as audio from './audio.js';

export class BaseEnemy extends BaseCharacter {
  constructor(parentNode, startsFlippedX) {
    super(startsFlippedX);
    this.parentNode = parentNode;
    this.isActive = false;
    this.shouldUnschedule = false;
    this.ignoreActiveBox = false;
    if (this.pointValue === undefined) this.pointValue = 0;
  }
  initialExtraSpriteFlip() { return true; }
  get isBoss() { return false; }

  update(dt) {
    if (this.shouldUnschedule) { this.unscheduleUpdates(); this.shouldUnschedule = false; }
    else super.update(dt);
  }

  didBecomeActive() {
    this.parentNode.addChild(this.sprite);
    this.shouldUnschedule = false;
    this.scheduleUpdates();
  }
  didBecomeInactive() {
    this.parentNode.removeChild(this.sprite);
    this.shouldUnschedule = true;
  }

  adjustInitialPosition() {
    const halfTile = TILE_SIZE_26 / 2;
    const overrun = halfTile - Math.abs(this.sensorOffsets.yToBottom);
    if (overrun < 0) {
      const p = this.position;
      this.position = { x: p.x, y: p.y - overrun };
    }
  }

  handleCollisionWithPlayerRect(playerRect) {
    // Sensors are refreshed from the current position so inactive frames still collide correctly
    this.applySensorOffsetsFromPoint(this.position);
    if (!rectIntersects(playerRect, this.collisionRect())) return EnemyCollision.None;
    const timmy = this.gameScene.timmy;
    if (timmy.currentVelocity.y < 0) {
      if (rectIntersects(timmy.collisionRectBottom(), this.collisionRectTop())) {
        if (this.hitShouldKillEnemy()) {
          this.handleEnemyWasKilled();
          return EnemyCollision.EnemyDied;
        }
        return EnemyCollision.EnemyDamaged;
      }
      return EnemyCollision.PlayerDamaged;
    }
    return EnemyCollision.PlayerDamaged;
  }

  hitShouldKillEnemy() { return true; }

  handleEnemyWasKilled() {
    this.sprite.stopAllActions();
    this.isActive = false;
    this.parentNode.removeChild(this.sprite);
    this.shouldUnschedule = true;
    game.addPoints(this.pointValue * game.enemyComboCount);
    game.enemiesKilledCount += 1;
    const gl = this.gameScene.gameLayer;
    smokePoof(gl, this.sprite.x, this.sprite.y);
    const text = game.enemyComboCount > 1 ? `${this.pointValue} x${game.enemyComboCount}` : `${this.pointValue}`;
    pointsLabel(gl, text, this.sprite.x, this.sprite.y);
    this.playDeathSound();
    reportKill(this);
  }

  removeWithPoofButNotPoints() {
    this.isActive = false;
    this.didBecomeInactive();
    smokePoof(this.gameScene.gameLayer, this.sprite.x, this.sprite.y);
  }

  // Enemies bounce elastically off walls by default
  handleXCollision(movingRight, overrun) {
    if (this.timmyBlock) {
      this.collisionLockedRight = this.collisionLockedLeft = false;
      return;
    }
    this.newPosition.x += movingRight ? -(overrun * 2) : overrun * 2;
    this.currentVelocity.x = -this.currentVelocity.x;
  }

  playDeathSound() { audio.playEffect('enemyKill'); }
}

// Kill-count achievements (the thresholds from each enemy's updateAchievementProgress)
let hamsterStreak = 0;
let lastKilled = null;
function reportKill(e) {
  const a = achievements;
  switch (e.constructor.name) {
    case 'Hamster': {
      a.report('RKR_1', a.addToStat('hamsterKills') / 100);
      hamsterStreak = lastKilled === 'Hamster' ? hamsterStreak + 1 : 1;
      if (hamsterStreak >= 3 && game.enemyComboCount >= 3) a.report('RKR_16', 1);
      break;
    }
    case 'CyclopticSnail': a.report('RKR_2', a.addToStat('snailKills') / 100); break;
    case 'RageBunny': a.report('RKR_3', a.addToStat('rageBunnyKills') / 150); break;
    case 'Zombie':
      a.report('RKR_4', a.addToStat('zombieKills') / 200);
      if (!e.collisionLockedBottom) a.report('RKR_9', 1);
      break;
    case 'Gigglesnout': a.report('RKR_5', a.addToStat('giggleKills') / 150); break;
  }
  lastKilled = e.constructor.name;
}

// ------------------------------------------------------------------ Hamster
const HAMSTER_SPEED = 28;

export class Hamster extends BaseEnemy {
  constructor(parentNode, flipped) {
    super(parentNode, flipped);
    this.checkLeadingFoot = true;
  }
  createSprite() { return new Sprite('hamster_001.png'); }
  createAnimations() {
    this.sprite.runAction(new RepeatForever(new Animate(animFrames('hamster_00', 4, 1), 0.15)));
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 6, yToMiddle: 0, yToBottom: -17, xToMiddleRight: 17, xToBottomRight: 9 });
  }
  setInitialState() {
    this.extraSpriteFlip = false;
    this.pointValue = POINTS.HAMSTER;
    this.currentVelocity.x = this.sprite.flipX ? HAMSTER_SPEED : -HAMSTER_SPEED;
  }
  shouldContinueAfterLeadingFootHitEdge() {
    this.currentVelocity.x = -this.currentVelocity.x;
    return false;
  }
  playDeathSound() { audio.playEffect('hamster_death'); }
}

// ------------------------------------------------------------------ Rage Bunny
const BunnyState = { Unknown: 0, Patrolling: 1, TransformToRage: 2, Rage: 3 };
const BUNNY_SPEED_PATROL = 35;
const PATROL_DISTANCE = 30;
const BUNNY_SPEED_RAGE = 90;
const RAGE_THRESHOLD_DISTANCE = 180;
const BUNNY_JUMP_PATROL = 121;
const BUNNY_JUMP_RAGE = 243;

export class RageBunny extends BaseEnemy {
  createSprite() { return new Sprite('bunny_1.png'); }
  createAnimations() {
    this.makePatrol = () => new RepeatForever(new Animate(animFrames('bunny_', 4, 1), 0.10));
    this.makeTransform = () => new Sequence(
      new Repeat(new Animate(animFrames('bunny_', 2, 5), 0.05), 2),
      new Call(() => this.transformToRageComplete()));
    this.makeRage = () => new RepeatForever(new Animate(animFrames('bunny_', 6, 7), 0.2, false));
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: -4, yToMiddle: -15, yToBottom: -30, xToMiddleRight: 13, xToBottomRight: 6 });
  }
  setInitialState() {
    this.pointValue = POINTS.BUNNY;
    this.bunnyState = BunnyState.Unknown;
    this.patrolAnchorX = 0;
    this.jumpSound = null;
  }

  beginPatrol() {
    this.currentVelocity.x = this.sprite.flipX ? BUNNY_SPEED_PATROL : -BUNNY_SPEED_PATROL;
    this.bunnyState = BunnyState.Patrolling;
    this.sprite.stopAllActions();
    this.sprite.runAction(this.makePatrol());
  }
  transformToRage() {
    this.bunnyState = BunnyState.TransformToRage;
    this.sprite.stopAllActions();
    this.sprite.runAction(this.makeTransform());
    audio.playEffect('bunny_electrify_zap');
    achievements.report('RKR_17', achievements.addToStat('bunnyRages') / 125);
  }
  transformToRageComplete() {
    this.bunnyState = BunnyState.Rage;
    this.sprite.stopAllActions();
    this.sprite.runAction(this.makeRage());
  }

  handleXCollision(movingRight, overrun) {
    if (this.bunnyState === BunnyState.Rage) {
      this.newPosition.x += movingRight ? -(overrun + CHARACTER_COLLISION_SINK) : (overrun + CHARACTER_COLLISION_SINK);
      this.currentVelocity.x = 0;
    } else super.handleXCollision(movingRight, overrun);
  }

  didBecomeActive() {
    super.didBecomeActive();
    if (this.bunnyState === BunnyState.Unknown) this.beginPatrol();
  }

  update(dt) {
    super.update(dt);
    if (!this.collisionLockedBottom || this.shouldUnschedule || !this.isActive) return;
    const timmy = this.gameScene.timmy;
    const tp = timmy.position, p = this.position;
    switch (this.bunnyState) {
      case BunnyState.Patrolling: {
        if (Math.abs(tp.x - p.x) + Math.abs(tp.y - p.y) < RAGE_THRESHOLD_DISTANCE) {
          this.currentVelocity.x = 0;
          this.sprite.flipX = tp.x > p.x;
          this.transformToRage();
          return;
        }
        if (this.currentVelocity.x > 0) {
          if (p.x > this.patrolAnchorX + PATROL_DISTANCE) this.currentVelocity.x = -this.currentVelocity.x;
        } else if (this.currentVelocity.x < 0) {
          if (this.sprite.x < this.patrolAnchorX - PATROL_DISTANCE) this.currentVelocity.x = -this.currentVelocity.x;
        }
        this.currentVelocity.y = BUNNY_JUMP_PATROL;
        this.collisionLockedBottom = false;
        this.playJumpSound('bunny_hop_normal');
        break;
      }
      case BunnyState.Rage:
        this.currentVelocity.x = tp.x > p.x ? BUNNY_SPEED_RAGE : -BUNNY_SPEED_RAGE;
        this.currentVelocity.y = BUNNY_JUMP_RAGE;
        this.collisionLockedBottom = false;
        this.playJumpSound('bunny_hop_zombie');
        break;
    }
  }

  playJumpSound(name) {
    if (this.jumpSound) this.jumpSound.stop();
    this.jumpSound = audio.playEffect(name);
  }
  playDeathSound() {
    if (this.jumpSound) this.jumpSound.stop();
    audio.playEffect('bunny_death');
  }
}

// ------------------------------------------------------------------ Cyclopic Snail
const SNAIL_SPEED = 30;

export class CyclopticSnail extends BaseEnemy {
  constructor(parentNode, flipped) {
    super(parentNode, flipped);
    this.checkLeadingFoot = true;
  }
  createSprite() { return new Sprite('e_snail_001.png'); }
  createAnimations() {
    const stretch = ['e_snail_001.png', 'e_snail_001.png', 'e_snail_001.png', 'e_snail_001.png', 'e_snail_002.png', 'e_snail_003.png', 'e_snail_004.png'];
    const drag = ['e_snail_003.png', 'e_snail_002.png', 'e_snail_001.png'];
    this.makeStretch = () => new Sequence(new Animate(stretch, 0.1), new Call(() => this.dragBodyForward()));
    this.makeDrag = () => new Sequence(new Animate(drag, 0.1), new Call(() => this.stretchForward()));
    this.slither = new audio.SoundSource('snail_slither', false);
    audio.addEffectsList('snailGrowl', ['snail_growl1', 'snail_growl2', 'snail_growl3', 'snail_growl4']);
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 9, yToMiddle: -5, yToBottom: -15, xToMiddleRight: 20, xToBottomRight: 20 });
  }
  setInitialState() {
    this.pointValue = POINTS.SNAIL;
    this.stretchForward();
  }
  stretchForward() {
    this.currentVelocity.x = 0;
    this.sprite.runAction(this.makeStretch());
  }
  dragBodyForward() {
    this.currentVelocity.x = this.sprite.flipX ? SNAIL_SPEED : -SNAIL_SPEED;
    this.sprite.runAction(this.makeDrag());
    this.slither.stop();
    if (this.isActive) this.slither.play();
  }
  shouldContinueAfterLeadingFootHitEdge() {
    this.currentVelocity.x = -this.currentVelocity.x;
    return false;
  }
  didBecomeInactive() { super.didBecomeInactive(); this.slither.stop(); }
  playDeathSound() {
    this.slither.stop();
    audio.playEffect('snail_death');
    audio.playRandomEffect('snailGrowl');
  }
}

// ------------------------------------------------------------------ Zombie
const ZOMBIE_SPEED = 125;
const ZOMBIE_JUMP_SPEED = 300;
const ZombieState = { Unknown: 0, Running: 1, InAirUp: 2, InAirDown: 3 };

export class Zombie extends BaseEnemy {
  createSprite() { return new Sprite('z_run_1.png'); }
  createAnimations() {
    this.makeRun = () => new RepeatForever(new Animate(animFrames('z_run_', 13, 1), 0.035));
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 15, xToMiddleRight: 13, yToMiddle: -5, xToBottomRight: 7, yToBottom: -25 });
  }
  setInitialState() {
    this.pointValue = POINTS.ZOMBIE;
    this.extraSpriteFlip = false;
    this.zombieState = ZombieState.Unknown;
    this.currentVelocity.x = 0;
    this.jumpAttempts = 0;
    this.lastJumpX = 0;
    this.growlTimer = null;
  }
  didBecomeActive() {
    super.didBecomeActive();
    this.runTowardsTimmy();
  }
  didBecomeInactive() {
    super.didBecomeInactive();
    this.currentVelocity.x = 0;
    this.gameScene.removeInactiveEnemy(this);   // zombies that leave the screen are gone for good
    this.stopSounds();
  }
  runTowardsTimmy() {
    if (this.runAnim) this.sprite.stopAction(this.runAnim);
    this.runAnim = this.sprite.runAction(this.makeRun());
    this.currentVelocity.x = this.gameScene.timmy.position.x > this.sprite.x ? ZOMBIE_SPEED : -ZOMBIE_SPEED;
    if (this.growlTimer === null) {
      this.growlTimer = 0;
      this.growl = audio.playEffect('zombie_run');
    }
  }
  update(dt) {
    super.update(dt);
    if (this.growlTimer !== null && !this.shouldUnschedule) {
      this.growlTimer += dt;
      if (this.growlTimer >= 5) {
        this.growlTimer -= 5;
        if (!game.gameplayIsPaused && Math.floor(Math.random() * 5) <= 3) this.growl = audio.playEffect('zombie_run');
      }
    }
  }
  handleXCollision(movingRight, overrun) {
    if (this.collisionLockedBottom) {
      // On the ground: jump over the obstacle (or give up if stuck)
      this.currentVelocity.y = ZOMBIE_JUMP_SPEED;
      this.collisionLockedBottom = false;
      if (this.jumpAttempts > 1 && Math.abs(this.lastJumpX - this.position.x) <= 10) {
        this.zombieSuicide();
        return;
      }
      this.jumpAttempts++;
      this.lastJumpX = this.position.x;
    }
    this.newPosition.x += movingRight ? -overrun : overrun;
  }
  zombieSuicide() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.stopAllActions();
    this.isActive = false;
    this.parentNode.removeChild(this.sprite);
    this.shouldUnschedule = true;
    this.gameScene.killEnemy(this);
    smokePoof(this.gameScene.gameLayer, this.sprite.x, this.sprite.y);
    this.playDeathSound();
  }
  handleNewPositionSet() {
    if (isInstaDeath(this.gameScene.metaPropertiesForTileAtWorldLocation(this.sensors.center))) this.zombieSuicide();
  }
  handleLanded() {
    const sounds = { 1: 'land_letter_block', 2: 'land_fence', 3: 'land_cinderblock', 4: 'land_swamp', 5: 'land_platform' };
    audio.playEffect(sounds[this.footSound] || sounds[this.defaultFootSound] || 'land_grass');
  }
  syncCharacterState() {
    let s;
    if (this.collisionLockedBottom) s = ZombieState.Running;
    else s = this.currentVelocity.y > 0 ? ZombieState.InAirUp : ZombieState.InAirDown;
    if (s === this.zombieState) return;
    this.zombieState = s;
    if (this.runAnim) this.sprite.stopAction(this.runAnim);
    if (s === ZombieState.Running) this.runAnim = this.sprite.runAction(this.makeRun());
    else this.sprite.setFrame(frame(s === ZombieState.InAirUp ? 'z_jump_1.png' : 'z_jump_2.png'));
  }
  // Zombies run straight into Timmy: unless stomped, they hurt him and destroy themselves
  handleCollisionWithPlayerRect(playerRect) {
    if (this.dead) return EnemyCollision.None;
    const r = super.handleCollisionWithPlayerRect(playerRect);
    if (r === EnemyCollision.PlayerDamaged) {
      this.zombieSuicide();
      return EnemyCollision.PlayerDamagedOnEnemySuicide;
    }
    return r;
  }
  handleEnemyWasKilled() {
    this.dead = true;
    super.handleEnemyWasKilled();
    this.growlTimer = null;
  }
  stopSounds() { if (this.growl) this.growl.stop(); }
  playDeathSound() {
    this.stopSounds();
    this.growlTimer = null;
    audio.playEffect('zombie_death');
  }
  cleanup() { this.stopSounds(); }
}

// ------------------------------------------------------------------ Kitty (Kitty.m)
// Timmy's runaway cat in Run Kitty Run!: waves, then bolts. Never hurts Timmy and can't be stomped.
const KITTY_SPEED = 250;
const KITTY_JUMP_SPEED = 190;
const KittyState = { Unknown: 0, Waiting: 1, Running: 2, InAirUp: 3, InAirDown: 4 };

export class Kitty extends BaseEnemy {
  createSprite() { return new Sprite('Kitty_run_001.png'); }
  createAnimations() {
    const names = (pre, ids) => ids.map(i => frame(`${pre}${String(i).padStart(3, '0')}.png`));
    const run = names('Kitty_run_', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    this.makeRun = () => new RepeatForever(new Animate(run, 0.035));
    const idle = names('Kitty_idle_', [1, 2, 3, 4]);
    const wave = names('Kitty_idle_', [5, 6, 7, 8, 7, 6]);
    this.makeWait = () => new RepeatForever(new Sequence(new Animate(idle, 0.11), new Animate(wave, 0.11)));
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 15, xToMiddleRight: 13, yToMiddle: -5, xToBottomRight: 7, yToBottom: -23 });
  }
  setInitialState() {
    this.extraSpriteFlip = false;
    this.kittyState = KittyState.Waiting;
    this.checkLeadingFoot = true;
    this.waitTime = this.waitTime || 0;
  }
  didBecomeActive() {
    super.didBecomeActive();
    if (this.waitTime === 0) this.waitTime = 3;
    if (this.waitTime >= 10) this.ignoreActiveBox = true;
    // wave, then run away
    this.sprite.runAction(new Sequence(new Delay(this.waitTime), new Call(() => this.runAway())));
    this.runAnim = this.sprite.runAction(this.makeWait());
  }
  runAway() {
    this.sprite.stopAllActions();
    this.currentVelocity.x = this.sprite.flipX ? KITTY_SPEED : -KITTY_SPEED;
    this.runAnim = this.sprite.runAction(this.makeRun());
    this.kittyState = KittyState.Running;
  }
  // Turn around (with a hop) when running into a wall
  handleXCollision(movingRight, overrun) {
    if (this.collisionLockedBottom) {
      this.currentVelocity.y = KITTY_JUMP_SPEED;
      this.collisionLockedBottom = false;
      this.currentVelocity.x = -this.currentVelocity.x;
    }
    this.newPosition.x += movingRight ? -overrun : overrun;
  }
  shouldContinueAfterLeadingFootHitEdge() { return true; }
  handleLanded() {
    const sounds = { 1: 'land_letter_block', 2: 'land_fence', 3: 'land_cinderblock', 4: 'land_swamp', 5: 'land_platform' };
    audio.playEffect(sounds[this.footSound] || sounds[this.defaultFootSound] || 'land_grass');
  }
  syncCharacterState() {
    let s = KittyState.Unknown;
    if (this.collisionLockedBottom && this.currentVelocity.x !== 0) s = KittyState.Running;
    else if (this.kittyState > KittyState.Waiting) s = this.currentVelocity.y > 0 ? KittyState.InAirUp : KittyState.InAirDown;
    if (s === this.kittyState) return;
    this.kittyState = s;
    if (this.runAnim) this.sprite.stopAction(this.runAnim);
    this.runAnim = null;
    if (s === KittyState.Running) this.runAnim = this.sprite.runAction(this.makeRun());
    else if (s === KittyState.InAirUp) this.sprite.setFrame(frame('Kitty_jump_001.png'));
    else if (s === KittyState.InAirDown) this.sprite.setFrame(frame('Kitty_jump_002.png'));
  }
  handleCollisionWithPlayerRect() { return EnemyCollision.None; }
  playDeathSound() {}
  // The kitty doesn't poof away when Timmy wins
  removeWithPoofButNotPoints() { this.isActive = false; this.didBecomeInactive(); }
  didBecomeInactive() {
    super.didBecomeInactive();
    this.currentVelocity.x = 0;
    this.gameScene.removeInactiveEnemy(this);
  }
}

// ------------------------------------------------------------------ Gigglesnout
// Each color has its own personality: [followThreshold, followSpeed, patrolDistance, patrolSpeed, prefix]
const GIGGLE = {
  red: [225, 90, 40, 35, 'R_fly_'],          // aggressive: chases earliest
  green: [175, 110, 30, 50, 'Gr_fly_'],      // fastest
  pink: [100, 80, 15, 15, 'Pi_fly_'],        // bashful: you have to get close
  purple: [125, 60, 25, 25, 'Pu_fly_'],      // slowpokes
};
let pendingGiggleColor = 'green';

export class Gigglesnout extends BaseEnemy {
  constructor(parentNode, flipped, color) {
    pendingGiggleColor = GIGGLE[color] ? color : 'green';
    super(parentNode, flipped);
    this.checkLeadingFoot = true;
  }
  get traits() { return GIGGLE[this.color]; }
  createSprite() {
    this.color = pendingGiggleColor;
    const container = new Sprite('transparent.png');
    this.snout = container.addChild(new Sprite(`${GIGGLE[this.color][4]}1.png`));
    this.snout.anchorX = 0; this.snout.anchorY = 0;
    container.width = this.snout.width; container.height = this.snout.height;
    return container;
  }
  createAnimations() {
    const t = 10;
    this.snout.runAction(new RepeatForever(new Spawn(
      new Sequence(new Animate(animFrames(this.traits[4], 6, 1), 0.11), new Call(() => this.floatCycleComplete())),
      new Sequence(new MoveBy(0.8, 0, t), new MoveBy(0.6, 0, -t)))));
  }
  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 10, yToMiddle: 0, yToBottom: -20, xToMiddleRight: 15, xToBottomRight: 7 });
  }
  setInitialState() {
    this.pointValue = POINTS.GIGGLESNOUT;
    this.patrolAnchorX = 0;
    this.giggleTimer = null;
    this.beginPatrol();
  }
  shouldContinueAfterLeadingFootHitEdge() {
    this.currentVelocity.x = -this.currentVelocity.x;
    return false;
  }
  beginPatrol() {
    this.currentVelocity.x = this.sprite.flipX ? this.traits[3] : -this.traits[3];
    this.giggleState = 'patrol';
  }
  floatCycleComplete() {
    if (!this.gameScene || !this.isActive) return;
    const tp = this.gameScene.timmy.position, p = this.position;
    if (this.giggleState === 'patrol') {
      if (Math.abs(tp.x - p.x) + Math.abs(tp.y - p.y) < this.traits[0]) { this.beginFollow(); return; }
      const dist = this.traits[2];
      if (this.currentVelocity.x > 0 && p.x > this.patrolAnchorX + dist) this.currentVelocity.x = -this.currentVelocity.x;
      else if (this.currentVelocity.x < 0 && this.sprite.x < this.patrolAnchorX - dist) this.currentVelocity.x = -this.currentVelocity.x;
    } else if (this.giggleState === 'follow') {
      this.currentVelocity.x = tp.x > p.x ? this.traits[1] : -this.traits[1];
    }
  }
  beginFollow() {
    this.currentVelocity.x = this.gameScene.timmy.position.x > this.position.x ? this.traits[1] : -this.traits[1];
    this.giggleState = 'follow';
    this.giggleTimer = 0;
    this.giggle = audio.playEffect('gigglesnout_giggle');
  }
  didBecomeActive() { super.didBecomeActive(); this.giggleTimer = 0; }
  didBecomeInactive() { super.didBecomeInactive(); this.giggleTimer = null; }
  update(dt) {
    super.update(dt);
    this.snout.flipX = this.sprite.flipX;
    if (this.giggleTimer !== null && !this.shouldUnschedule) {
      this.giggleTimer += dt;
      if (this.giggleTimer >= 5) {
        this.giggleTimer -= 5;
        if (!game.gameplayIsPaused && Math.floor(Math.random() * 5) <= 3) this.giggle = audio.playEffect('gigglesnout_giggle');
      }
    }
  }
  handleEnemyWasKilled() {
    super.handleEnemyWasKilled();
    this.snout.stopAllActions();
    this.giggleTimer = null;
  }
  removeWithPoofButNotPoints() {
    this.snout.stopAllActions();
    this.cleanup();
    super.removeWithPoofButNotPoints();
  }
  cleanup() { this.giggleTimer = null; if (this.giggle) this.giggle.stop(); }
  playDeathSound() {
    if (this.giggle) this.giggle.stop();
    audio.playEffect(`gigglesnout_death_${this.color}`);
  }
}
