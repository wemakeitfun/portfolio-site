// HUDNode port: score, high score, health hearts, level title and the pause button.
import { Node, Sprite, Label, FadeOut, ScaleTo, EaseBackIn, WIN_W, WIN_H, frameFromImage, assets } from './engine.js';
import { game, savedGame } from './model.js';

const POINTS_ANIMATION_TIME = 0.5;

export class HUD extends Node {
  constructor(onPause) {
    super();
    this.onPause = onPause;

    // Pause button (top-left)
    const up = assets.images['assets/ui/btn-pause-up.png'];
    const down = assets.images['assets/ui/btn-pause-down.png'];
    this.pauseUp = frameFromImage(up, 0.5);
    this.pauseDown = frameFromImage(down, 0.5);
    this.pauseBtn = this.addChild(new Sprite(this.pauseUp));
    this.pauseBtn.x = 32; this.pauseBtn.y = WIN_H - 30;

    // Score cluster (top-right)
    const score = this.addChild(new Node());
    score.x = WIN_W * 0.98; score.y = WIN_H * 0.98;
    const header = score.addChild(new Sprite('scoreLabel.png'));
    header.anchorX = 1; header.anchorY = 1;
    this.lblPoints = score.addChild(new Label('0', 'currentScoreFont'));
    this.lblPoints.anchorX = 1; this.lblPoints.anchorY = 1; this.lblPoints.y = -7;
    const high = savedGame.highScore(game.currentChapter, game.currentLevel);
    if (high > 0) {
      const hh = score.addChild(new Sprite('highScoreLabel.png'));
      hh.anchorX = 1; hh.anchorY = 1; hh.y = -35;
      const hp = score.addChild(new Label(String(high), 'currentScoreFont'));
      hp.anchorX = 1; hp.anchorY = 1; hp.y = -43;
    }

    // Health cluster (top-center)
    const health = this.addChild(new Node());
    health.x = WIN_W * 0.5; health.y = WIN_H - 30;
    const lbl = health.addChild(new Sprite('healthLabel.png'));
    lbl.anchorX = 0.5; lbl.anchorY = 1; lbl.y = 30 - lbl.height;
    const group = health.addChild(new Node());
    group.x = -32; group.y = 3;
    this.hearts = [];
    for (let i = 0; i < 3; i++) {
      const empty = group.addChild(new Sprite('heartEmpty.png'));
      empty.anchorX = 0; empty.anchorY = 0.5; empty.x = i * 22;
      const full = empty.addChild(new Sprite('heartFull.png'));
      full.anchorX = 0; full.anchorY = 0;
      this.hearts.push(full);
    }

    this.pointsShown = game.points;
    this.pointsStart = game.points;
    this.pointsTarget = game.points;
    this.pointsElapsed = POINTS_ANIMATION_TIME;
    this.onPoints = v => { this.pointsStart = this.pointsShown; this.pointsTarget = v; this.pointsElapsed = 0; };
    game.on('points', this.onPoints);
  }

  destroy() { game.off('points', this.onPoints); }

  addLevelNumberString() {
    const text = game.currentChapter === 5 ? 'RUN KITTY RUN!' : `LEVEL ${game.currentChapter}-${game.currentLevel}`;
    const l = this.addChild(new Label(text, 'currentScoreFont'));
    l.x = WIN_W * 0.5; l.y = WIN_H * 0.75;
    this.levelTitle = l;
    this.titleTimer = 0.75;
  }

  hitPause(x, y) {
    return Math.abs(x - this.pauseBtn.x) < 26 && Math.abs(y - this.pauseBtn.y) < 26;
  }
  setPausePressed(p) { this.pauseBtn.setFrame(p ? this.pauseDown : this.pauseUp); }

  step(dt) {
    if (this.titleTimer !== undefined && this.titleTimer > 0) {
      this.titleTimer -= dt;
      if (this.titleTimer <= 0) {
        this.levelTitle.runAction(FadeOut(0.5));
        this.levelTitle.runAction(new EaseBackIn(new ScaleTo(0.5, 2)));
      }
    }
    if (this.pointsElapsed < POINTS_ANIMATION_TIME) {
      this.pointsElapsed += dt;
      const p = Math.min(1, this.pointsElapsed / POINTS_ANIMATION_TIME);
      this.pointsShown = Math.round(this.pointsStart + (this.pointsTarget - this.pointsStart) * p);
    } else {
      this.pointsShown = game.points;
    }
    if (this.lblPoints.text !== String(this.pointsShown)) this.lblPoints.setString(String(this.pointsShown));
    for (let i = 0; i < 3; i++) this.hearts[i].visible = game.health > i;
  }
}
