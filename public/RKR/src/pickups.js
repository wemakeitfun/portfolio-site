// Coins, hearts, lollipops (the polaroid photos) and checkpoints — ports of the BaseManagedObject family.
import { Sprite, Animate, Sequence, Delay, RepeatForever, animFrames, frame, frameFromImage, assets } from './engine.js';
import { pointsLabel } from './effects.js';
import { game, POINTS, achievements } from './model.js';
import * as audio from './audio.js';

class ManagedObject {
  constructor(parentNode) {
    this.parentNode = parentNode;
    this.sprite = this.createSprite();
    this.isActive = false;
    this.gameScene = null;
  }
  didBecomeActive() {
    this.repeat = this.createRepeatAction();
    if (this.repeat) this.sprite.runAction(this.repeat);
    this.parentNode.addChild(this.sprite);
  }
  didBecomeInactive() {
    if (this.repeat) this.sprite.stopAction(this.repeat);
    this.parentNode.removeChild(this.sprite);
  }
  createRepeatAction() { return null; }
}

let lastCoinSound = 0;

export class Coin extends ManagedObject {
  createSprite() { return new Sprite('coin1.png'); }
  createRepeatAction() {
    const n = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2].map(i => frame(`coin${i}.png`));
    return new RepeatForever(new Animate(n, 0.06));
  }
  collected() {
    game.addPoints(POINTS.COIN);
    game.coinsCollectedCount += 1;
    this.isActive = false;
    this.didBecomeInactive();
    audio.playEffectAt('coin', lastCoinSound);
    lastCoinSound = (lastCoinSound + 1) % Math.max(1, audio.effectsCount('coin'));
    pointsLabel(this.gameScene.gameLayer, POINTS.COIN, this.sprite.x, this.sprite.y);
    const total = achievements.addToStat('totalCoins');
    if (total % 25 === 0) {
      achievements.report('RKR_32', total / 1000);
      achievements.report('RKR_33', total / 2500);
      achievements.report('RKR_34', total / 10000);
    }
  }
}

export class Heart extends ManagedObject {
  createSprite() { return new Sprite('heart1.png'); }
  createRepeatAction() { return new RepeatForever(new Animate(animFrames('heart', 11, 1), 0.06)); }
  collected() {
    if (game.health < 3) {
      game.set('health', game.health + 1);
    } else {
      game.addPoints(POINTS.EXTRA_HEART);
      pointsLabel(this.gameScene.gameLayer, POINTS.EXTRA_HEART, this.sprite.x, this.sprite.y);
      game.bonusHeartsCount += 1;
    }
    audio.playRandomEffect('heart');
    this.isActive = false;
    this.didBecomeInactive();
  }
}

export class Lollipop extends ManagedObject {
  constructor(parentNode) { super(parentNode); this.wasCollected = false; }
  createSprite() { return new Sprite('pollaroid1.png'); }
  createRepeatAction() {
    return new RepeatForever(new Sequence(new Animate(animFrames('pollaroid', 6, 1), 0.1), new Delay(2)));
  }
  collected() {
    this.wasCollected = true;
    game.addPoints(POINTS.LOLLIPOP);
    game.lollipopCollected = true;
    this.isActive = false;
    this.didBecomeInactive();
    audio.playEffect('tim_grab_lollipop');
    pointsLabel(this.gameScene.gameLayer, POINTS.LOLLIPOP, this.sprite.x, this.sprite.y);
  }
}

export class Checkpoint extends ManagedObject {
  createSprite() {
    const img = assets.images['assets/ui/checkPointOff.png'];
    return new Sprite(img ? frameFromImage(img, 0.5) : frame('transparent.png'));
  }
  checkpointWasReached() {
    if (this.reached) return;
    this.reached = true;
    const img = assets.images['assets/ui/checkPointOn.png'];
    if (img) this.sprite.setFrame(frameFromImage(img, 0.5));
  }
}
