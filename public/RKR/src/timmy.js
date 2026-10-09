// Port of Timmy.m + TimmySprite.m — the player.
import {
  Sprite, Animate, Sequence, Repeat, RepeatForever, Delay, Call, FadeTo, FadeIn, FadeOut, frame, animFrames, rectIntersects, vibrate,
} from './engine.js';
import { BaseCharacter, FootSound, CHARACTER_GRAVITY_CONSTANT, CHARACTER_MAX_SPEED_Y, CHARACTER_COLLISION_SINK, isWallSlide, isInstaDeath } from './character.js';
import { DustEmitter } from './effects.js';
import { game, achievements } from './model.js';
import * as audio from './audio.js';

const TIMMY_SLOWDOWN_CONSTANT = 700;
const TIMMY_SLOW_TO_MAX_SPEED_CONSTANT = 100;
const TIMMY_ACCELERATION_CONSTANT = 800;
const TIMMY_ACCELERATION_TURN_AROUND_CONSTANT = 2000;
const TIMMY_MIN_SPEED_X = 30;
const TIMMY_MAX_SPEED_X = 200;
export const TIMMY_JUMP_SPEED = 325;
export const TIMMY_JUMP_SPEED_MIN = 80;
const TIMMY_WALL_SLIDE_MAX_SPEED_Y = 150;
const TIMMY_WALL_SLIDE_GRAVITY_CONSTANT = 200;
const TIMMY_ENEMY_JUMP_TIME = 0.25;
// Web-only forgiveness: a wall jump still works this long after Timmy stops wall-sliding
// (the original only allowed it on the exact frame, which is very hard on a keyboard)
const WALL_JUMP_GRACE_TIME = 0.2;

export const TimmyState = {
  Unknown: 0, Idle: 1, Running: 2, InAirUp: 4, InAirDown: 8, WallSlide: 16, Skid: 32, Winning: 64, Dying: 128,
};

export const EnemyCollision = {
  None: 1, EnemyDamaged: 2, EnemyDied: 3, PlayerDamaged: 4, PlayerDamagedOnEnemySuicide: 5,
};

const RUN_SOUNDS = {
  [FootSound.Grass]: 'run_grass', [FootSound.Block]: 'run_letter_block', [FootSound.Fence]: 'run_fence',
  [FootSound.Cinder]: 'run_cinderblock', [FootSound.Swamp]: 'run_swamp', [FootSound.Platform]: 'run_tree',
  [FootSound.Rope]: 'run_vine', [FootSound.Bridge]: 'run_bridge', [FootSound.Cage]: 'run_cage',
  [FootSound.Crate]: 'run_crate', [FootSound.MetalFence]: 'run_metal_fence', [FootSound.Pipe]: 'run_pipe',
  [FootSound.Tree]: 'run_tree', [FootSound.Bench]: 'run_bench', [FootSound.Chair]: 'run_bench',
};
const LAND_SOUNDS = {
  [FootSound.Grass]: 'land_grass', [FootSound.Block]: 'land_letter_block', [FootSound.Fence]: 'land_fence',
  [FootSound.Cinder]: 'land_cinderblock', [FootSound.Swamp]: 'land_swamp', [FootSound.Platform]: 'land_tree',
  [FootSound.Rope]: 'land_vine', [FootSound.Bridge]: 'land_bridge', [FootSound.Cage]: 'land_cage',
  [FootSound.Crate]: 'land_crate', [FootSound.MetalFence]: 'land_metal_fence', [FootSound.Pipe]: 'land_pipe',
  [FootSound.Tree]: 'land_tree', [FootSound.Bench]: 'land_bench', [FootSound.Chair]: 'land_chair',
};

// ------------------------------------------------------------------ TimmySprite
class TimmySprite extends Sprite {
  constructor(listener) {
    super('idle_1.png');
    this.listener = listener;
    this.visualState = 0;
    this.sounds = {};
    this.currentRunSound = null;
    this.wallSlideSound = null;

    const idle = frame('idle_1.png');
    const f = n => frame(n);
    const rep = (fr, n) => Array(n).fill(fr);
    const blink1 = [f('idle_2.png'), f('idle_3.png'), ...rep(idle, 6)];
    const blink2 = [f('idle_2.png'), f('idle_3.png'), ...rep(idle, 12)];
    const w = [4, 5, 6, 7].map(i => f(`idle_${i}.png`));
    const blink3 = [
      w[0], w[0], w[1], w[1], w[2], w[2], w[3], w[3], w[2], w[2], w[3], w[3], w[2], w[2], w[3], w[3], w[2], w[2], w[3], w[3],
      f('idle_8.png'), f('idle_8.png'), f('idle_9.png'), f('idle_9.png'), f('idle_10.png'), f('idle_10.png'), ...rep(idle, 24),
    ];
    this.makeIdle = () => new RepeatForever(new Sequence(
      new Animate([idle], 2), new Animate(blink1, 0.05), new Animate(blink2, 0.05), new Animate(blink3, 0.05)));
    this.makeRun = () => new RepeatForever(new Animate(animFrames('run_', 13, 1), 0.035, false));
    this.makeStun = () => new Sequence(
      new Repeat(new Sequence(new FadeTo(0.125, 60), new FadeTo(0.125, 200)), 6),
      FadeIn(0), new Call(() => listener.stunActionDidFinish()));
    this.makeDeath = () => new Sequence(
      new Animate(animFrames('timmyPoof', 3, 1), 0.07), FadeOut(0), new Delay(0.5),
      new Call(() => listener.deathActionDidFinish()));
    this.makeInAirDownDelay = () => new Sequence(new Delay(0.25), new Call(() => this.inAirDownFlapArms()));
    this.makeFlap = () => new RepeatForever(new Animate(animFrames('jump_', 2, 2), 0.1));
    this.makeWallSlide = () => new Sequence(new Call(() => this.playWallSlideSound()), new Animate(['wall_1.png'], 0.15));
    this.makeWin = () => new Sequence(new Delay(0.88), new Call(() => listener.winActionDidFinish()));
    this.exclusive = [];

    this.footDust = this.addChild(new DustEmitter());
    this.dustPos = { x: this.width * 0.5, y: this.height * 0.5 - 18 };
    this.footDust.x = this.dustPos.x; this.footDust.y = this.dustPos.y;
    this.landDustActive = false;
  }

  initFootSounds(list) {
    if (list.length <= 1) list.push(0);
    for (const s of list) {
      const name = RUN_SOUNDS[s] || RUN_SOUNDS[FootSound.Grass];
      if (!this.sounds[name]) this.sounds[name] = new audio.SoundSource(name, true);
    }
    if (!this.sounds.run_grass) this.sounds.run_grass = new audio.SoundSource('run_grass', true);
  }

  startFootDust() {
    if (this.footDust.active) return;
    const offset = 15;
    if (this.flipX) { this.footDust.angle = 30; this.footDust.x = this.dustPos.x + offset; }
    else { this.footDust.angle = 150; this.footDust.x = this.dustPos.x - offset; }
    this.footDust.resetSystem();
  }
  stopFootDust() { if (!this.landDustActive) this.footDust.stopSystem(); }
  landPoof() {
    this.startFootDust();
    this.landDustActive = true;
    clearTimeout(this.landTimer);
    this.landTimer = setTimeout(() => { this.landDustActive = false; this.stopFootDust(); }, 150);
  }

  playRunSound() {
    if (!audio.settings.sfx || this.visualState !== TimmyState.Running) return;
    const c = this.listener;
    const want = RUN_SOUNDS[c.footSound] || RUN_SOUNDS[c.defaultFootSound] || 'run_grass';
    const next = this.sounds[want] || this.sounds[RUN_SOUNDS[c.defaultFootSound]] || this.sounds.run_grass;
    if (this.currentRunSound && this.currentRunSound !== next) this.currentRunSound.stop();
    this.currentRunSound = next;
    if (!next || next.isPlaying) return;
    next.play();
  }

  playWallSlideSound() {
    if (!audio.settings.sfx) return;
    if (!this.wallSlideSound) this.wallSlideSound = new audio.SoundSource('tim_wall_slide_loop', false);
    if (this.wallSlideSound.isPlaying) return;
    this.wallSlideSound.play();
  }

  stopAllSounds() {
    for (const s of Object.values(this.sounds)) s.stop();
    if (this.wallSlideSound) this.wallSlideSound.stop();
    this.currentRunSound = null;
  }

  run(action) { this.exclusive.push(action); return this.runAction(action); }
  stopAllMutuallyExclusiveActions() {
    for (const a of this.exclusive) this.stopAction(a);
    this.exclusive = [];
  }

  setVisualState(s) {
    if (s === this.visualState) return;
    this.visualState = s;
    this.syncWithState();
  }

  syncWithState() {
    this.stopAllMutuallyExclusiveActions();
    if (this.currentRunSound) this.currentRunSound.stop();
    if (this.wallSlideSound) this.wallSlideSound.stop();
    switch (this.visualState) {
      case TimmyState.Idle: this.setFrame(frame('idle_1.png')); this.run(this.makeIdle()); break;
      case TimmyState.Running:
        this.setFrame(frame('run_1.png')); this.run(this.makeRun());
        this.currentRunSound = null;
        this.playRunSound(); this.startFootDust();
        break;
      case TimmyState.Skid: this.setFrame(frame('run_1.png')); break;
      case TimmyState.InAirUp: this.setFrame(frame('jump_1.png')); break;
      case TimmyState.InAirDown: this.setFrame(frame('jump_2.png')); this.run(this.makeInAirDownDelay()); break;
      case TimmyState.WallSlide: this.setFrame(frame('wall_1.png')); this.run(this.makeWallSlide()); break;
      case TimmyState.Dying: this.stopAllActions(); this.setFrame(frame('timmyPoof1.png')); this.runAction(this.makeDeath()); break;
      case TimmyState.Winning: this.stopAllActions(); this.runAction(this.makeWin()); break;
    }
    if (this.visualState !== TimmyState.WallSlide && this.wallSlideSound) this.wallSlideSound.stop();
    if (this.visualState !== TimmyState.Running) this.stopFootDust();
  }

  inAirDownFlapArms() { this.run(this.makeFlap()); }
  stun() { this.stunAction = this.runAction(this.makeStun()); }
  get isStunAnimating() { return !!this.stunAction && this.actions.includes(this.stunAction); }
}

// ------------------------------------------------------------------ Timmy
export class Timmy extends BaseCharacter {
  constructor(parentNode, startsFlippedX) {
    super(startsFlippedX);
    parentNode.addChild(this.sprite);
    this.maxSpeedX = TIMMY_MAX_SPEED_X;
    this.landSoundsEnabled = false;
  }

  createSprite() { return new TimmySprite(this); }

  setSensorOffsets() {
    Object.assign(this.sensorOffsets, { yToTop: 15, xToMiddleRight: 13, yToMiddle: 0, xToBottomRight: 7, yToBottom: -18 });
  }

  setInitialState() {
    this.currentVelocity = { x: 0, y: 0 };
    this.timmyState = TimmyState.Idle;
    this.sprite.setVisualState(this.timmyState);
    this.hasWon = false;
    this.isStunned = false;
    this.jumpPressAlreadyServiced = false;
    this.enemyJumpTimer = 0;
    this.wallJumpTimer = 0;
    this.overrideUserInput = false;
    this.forcedUserInput = 0;
    this.inputX = 0;
    this.killedByBoss = false;
    audio.addEffectsList('timmyJump', [
      'tim_jump_solo1', 'tim_jump_solo2', 'tim_jump_solo3', 'tim_jump_solo4',
      'tim_jump_vox1', 'tim_jump_vox2', 'tim_jump_vox3', 'tim_jump_vox4']);
    audio.addEffectsList('timmyLoseHealth', ['tim_hurt_power_down_solo', 'tim_hurt_power_down_vox']);
    audio.addEffectsList('timmyDeathScream', ['tim_voice_death_1', 'tim_voice_death_2']);
  }

  initFootSounds(list) {
    this.defaultLandSound = LAND_SOUNDS[this.defaultFootSound] || 'land_grass';
    this.sprite.initFootSounds(list);
  }

  onFootSoundSet() { if (this.sprite && this.sprite.playRunSound) this.sprite.playRunSound(); }

  handleWorldEdgeCollision(overrun) {
    this.currentVelocity.x = 0;
    this.newPosition.x -= overrun;
  }

  // ---------------------------------------------------------------- enemies
  checkForEnemyCollisions() {
    const gs = this.gameScene;
    const rect = this.collisionRect();
    for (const fireball of [...gs.activeFireballs]) {
      if (rectIntersects(rect, fireball.boundingBox())) {
        this.loseHealth(1);
        fireball.hitTimmy();
      }
    }
    const killed = [];
    for (const enemy of [...gs.activeEnemies]) {
      const result = enemy.handleCollisionWithPlayerRect(rect);
      switch (result) {
        case EnemyCollision.None: break;
        case EnemyCollision.EnemyDied:
          killed.push(enemy);
          // falls through
        case EnemyCollision.EnemyDamaged:
          if (this.input.isJumpPressed && !this.jumpPressAlreadyServiced) {
            this.currentVelocity.y = TIMMY_JUMP_SPEED;
            this.jumpPressAlreadyServiced = true;
          } else if (enemy.isBoss) {
            this.currentVelocity.y = TIMMY_JUMP_SPEED * 0.9;
            this.enemyJumpTimer = TIMMY_ENEMY_JUMP_TIME;
          } else {
            this.currentVelocity.y = TIMMY_JUMP_SPEED_MIN * 2;
            this.enemyJumpTimer = TIMMY_ENEMY_JUMP_TIME;
          }
          game.enemyComboCount++;
          if (game.enemyComboCount >= achievements.stat('highestCombo')) {
            achievements.setStat('highestCombo', game.enemyComboCount);
            achievements.report('RKR_24', game.enemyComboCount / 21);
          }
          break;
        case EnemyCollision.PlayerDamagedOnEnemySuicide:
        case EnemyCollision.PlayerDamaged:
          if (this.enemyJumpTimer <= 0) this.loseHealth(1);
          break;
      }
    }
    for (const corpse of killed) {
      gs.activeEnemies.delete(corpse);
      gs.killedEnemies.add(corpse);
    }
  }

  checkForInstaDeath() {
    if (isInstaDeath(this.gameScene.metaPropertiesForTileAtWorldLocation(this.sensors.center)) || this.hitFlamingPlatform) {
      this.loseLife();
    }
  }

  // ---------------------------------------------------------------- sprite listener
  deathActionDidFinish() { this.gameScene.playerDidDie(); }
  stunActionDidFinish() { this.isStunned = false; }
  winActionDidFinish() {
    // In 1-9 Timmy walks into the tree; the "treeEntrance" trigger ends the level.
    if (!(game.currentChapter === 1 && game.currentLevel === 9)) this.gameScene.playerDidWin();
  }
  onTreeEntrance() {
    if (this.treeTriggerHandled) return;
    this.treeTriggerHandled = true;
    this.sprite.stopAllSounds();
    this.gameScene.playerDidWin();
  }

  // ---------------------------------------------------------------- BaseCharacter callbacks
  shouldUpdate() {
    // Safety net: never stay stunned (invulnerable) if the stun flash was interrupted
    if (this.isStunned && !this.sprite.isStunAnimating) this.isStunned = false;
    return this.timmyState !== TimmyState.Dying;
  }

  adjustVelocityX() {
    const v = this.currentVelocity, dT = this.dT, max = this.maxSpeedX;
    this.inputX = this.overrideUserInput ? this.forcedUserInput : this.input.xInput;
    const inputX = this.inputX;
    if (inputX > 0) {
      this.collisionLockedLeft = false;
      if (v.x < max) v.x += dT * (v.x < 0 ? TIMMY_ACCELERATION_TURN_AROUND_CONSTANT : TIMMY_ACCELERATION_CONSTANT);
      else if (v.x > max) v.x = Math.max(v.x - dT * TIMMY_SLOW_TO_MAX_SPEED_CONSTANT, max);
    } else if (inputX < 0) {
      this.collisionLockedRight = false;
      if (v.x > -max) v.x -= dT * (v.x > 0 ? TIMMY_ACCELERATION_TURN_AROUND_CONSTANT : TIMMY_ACCELERATION_CONSTANT);
      else if (v.x < -max) v.x = Math.min(v.x + dT * TIMMY_SLOW_TO_MAX_SPEED_CONSTANT, -max);
    } else {
      this.collisionLockedLeft = this.collisionLockedRight = false;
      if (Math.abs(v.x) < TIMMY_MIN_SPEED_X) v.x = 0;
      else if (v.x > 0) v.x -= dT * TIMMY_SLOWDOWN_CONSTANT;
      else if (v.x < 0) v.x += dT * TIMMY_SLOWDOWN_CONSTANT;
    }
  }

  adjustVelocityY() {
    const v = this.currentVelocity, dT = this.dT;
    const jumpPressed = this.hasWon ? false : this.input.isJumpPressed;
    let allowedToJump;
    if (jumpPressed) {
      allowedToJump = !this.jumpPressAlreadyServiced;
    } else {
      allowedToJump = false;
      if (this.jumpPressAlreadyServiced && v.y > 0) v.y = Math.min(v.y, TIMMY_JUMP_SPEED_MIN);
      this.jumpPressAlreadyServiced = false;
    }
    if (this.enemyJumpTimer > 0) this.enemyJumpTimer -= dT;
    if (this.wallJumpTimer > 0) this.wallJumpTimer -= dT;
    if (this.wallJumpGrace > 0) this.wallJumpGrace -= dT;

    if (this.collisionLockedBottom) {
      if (allowedToJump) {
        v.y = TIMMY_JUMP_SPEED;
        this.jumpPressAlreadyServiced = true;
        this.collisionLockedBottom = false;
        if (game.currentChapter === 4 && game.currentLevel === 1) this.onKittyJump();
        audio.playRandomEffect('timmyJump');
      }
    } else if (this.timmyState !== TimmyState.WallSlide) {
      if (allowedToJump && this.enemyJumpTimer > 0) {
        v.y = TIMMY_JUMP_SPEED;
        if (game.currentChapter === 4 && game.currentLevel === 1) this.onKittyJump();
        audio.playRandomEffect('timmyJump');
        this.jumpPressAlreadyServiced = true;
        this.enemyJumpTimer = 0;
      } else if (allowedToJump && this.wallJumpGrace > 0) {
        this.wallJump(this.wallJumpLaunchRight);
      } else if (v.y > -CHARACTER_MAX_SPEED_Y) {
        v.y -= dT * CHARACTER_GRAVITY_CONSTANT;
      }
    } else {
      if (allowedToJump && this.wallJumpTimer > 0) {
        // sprite.flipX: sliding down a wall that is to his left, so launch him to the right
        this.wallJump(this.sprite.flipX);
      } else if (v.y > -TIMMY_WALL_SLIDE_MAX_SPEED_Y) {
        v.y -= dT * TIMMY_WALL_SLIDE_GRAVITY_CONSTANT;
      }
    }
  }

  wallJump(launchRight) {
    const v = this.currentVelocity;
    this.collisionLockedRight = false;
    this.collisionLockedLeft = false;
    const pct = 1.6;
    v.x = launchRight ? this.maxSpeedX * pct : -this.maxSpeedX * pct;
    v.y = TIMMY_JUMP_SPEED;
    this.jumpPressAlreadyServiced = true;
    this.wallJumpGrace = 0;
    audio.playEffect('tim_jump_off_wall');
    achievements.report('RKR_35', 1);
  }

  onKittyJump() {
    if (this.alreadyYelled) return;
    this.alreadyYelled = true;
    audio.playEffect('tim_jump_kitty');
  }

  handleDamage(amount) { this.loseHealth(amount); }
  handleLoseLife() { this.loseLife(); }

  handleLanded() {
    const land = LAND_SOUNDS[this.footSound] || this.defaultLandSound;
    if (this.landSoundsEnabled) {
      audio.playEffect(land);
      this.sprite.landPoof();
    }
    this.jumpPressAlreadyServiced = true;
    game.enemyComboCount = 1;
  }

  handleXCollision(movingRight, overrun) {
    const v = this.currentVelocity;
    v.x = 0;
    if (movingRight) {
      this.sprite.flipX = false;
      if (this.collisionLockedRight) this.newPosition.x = this.previousPosition.x;
      else {
        this.newPosition.x -= (overrun - CHARACTER_COLLISION_SINK);
        if (v.y < 0) v.y = 0;
        this.collisionLockedRight = true;
      }
    } else {
      this.sprite.flipX = true;
      if (this.collisionLockedLeft) this.newPosition.x = this.previousPosition.x;
      else {
        this.newPosition.x += (overrun - CHARACTER_COLLISION_SINK);
        if (v.y < 0) v.y = 0;
        this.collisionLockedLeft = true;
      }
    }
  }

  handleNewPositionSet() {
    this.checkForEnemyCollisions();
    this.checkForInstaDeath();
  }

  syncCharacterState() {
    if (this.timmyState === TimmyState.Dying) return;
    const v = this.currentVelocity, inputX = this.inputX, gs = this.gameScene;
    let s;
    if (this.collisionLockedBottom) {
      if (v.x > 0) s = inputX < 0 ? TimmyState.Skid : TimmyState.Running;
      else if (v.x < 0) s = inputX > 0 ? TimmyState.Skid : TimmyState.Running;
      else s = TimmyState.Idle;
    } else if (v.y <= 0) {
      if (this.collisionLockedRight) {
        s = isWallSlide(gs.propertiesForTileAtWorldLocation(this.sensors.middleRight)) ? TimmyState.WallSlide : TimmyState.InAirDown;
      } else if (this.collisionLockedLeft) {
        s = isWallSlide(gs.propertiesForTileAtWorldLocation(this.sensors.middleLeft)) ? TimmyState.WallSlide : TimmyState.InAirDown;
      } else s = TimmyState.InAirDown;
    } else s = TimmyState.InAirUp;

    if (this.ignoreGravity) s = v.x !== 0 ? TimmyState.Running : TimmyState.Idle;
    if (this.timmyState !== TimmyState.WallSlide && s === TimmyState.WallSlide) game.enemyComboCount = 1;
    this.timmyState = s;
    if (s === TimmyState.WallSlide) {
      this.wallJumpTimer = 100;
      this.wallJumpGrace = WALL_JUMP_GRACE_TIME;
      this.wallJumpLaunchRight = this.sprite.flipX;
    } else if (this.collisionLockedBottom) {
      this.wallJumpGrace = 0;
    }
    this.sprite.setVisualState(s);
  }

  // ---------------------------------------------------------------- health
  loseHealth(amount) {
    if (this.isStunned || this.timmyState === TimmyState.Dying || game.playerIsInvincible) return;
    game.set('health', game.health - amount);
    if (game.health > 0) {
      this.startStunnedState();
      audio.playRandomEffect('timmyLoseHealth');
    } else {
      this.loseLife();
    }
    vibrate(80);
  }

  loseLife() {
    if (this.timmyState === TimmyState.Dying) return;
    if (this.killedByBoss) audio.playMusic('tim_dies_bad_guy.mp3', false);
    else audio.playRandomEffect('timmyDeathScream');
    this.gameScene.playerWillDie();
    const deaths = achievements.addToStat('timmyDeaths');
    achievements.report('RKR_10', deaths / 100);
    achievements.report('RKR_23', deaths / 9);
    if (game.currentChapter === 5 && game.currentLevel === 1) achievements.report('RKR_29', achievements.addToStat('level51deaths') / 40);
    this.dropOffPlatform();
    this.timmyState = TimmyState.Dying;
    this.sprite.setVisualState(this.timmyState);
    this.sprite.stopAllSounds();
  }

  startStunnedState() {
    if (this.isStunned) return;
    audio.playRandomEffect('timmyLoseHealth');
    const v = this.currentVelocity;
    this.currentVelocity = { x: v.x * -0.75, y: v.y * -0.75 };
    if (Math.abs(this.currentVelocity.x) < TIMMY_MIN_SPEED_X) this.currentVelocity.x = this.sprite.flipX ? 100 : -100;
    this.isStunned = true;
    this.sprite.stun();
  }

  startWinState() {
    this.gameScene.playerWillWin();
    this.hasWon = true;
    this.timmyState = TimmyState.Winning;
    this.sprite.setVisualState(this.timmyState);
    this.overrideUserInput = true;
    if (game.currentLevel === 9 && game.currentChapter === 1) {
      this.currentVelocity.x = this.maxSpeedX = 100;
      this.forcedUserInput = 1;
    } else {
      this.forcedUserInput = 0;
    }
  }

  unscheduleUpdates() {
    super.unscheduleUpdates();
    this.sprite.stopAllSounds();
  }
}
