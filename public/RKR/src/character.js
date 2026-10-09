// Port of BaseCharacter.m — sensor-based tile physics with slope maps, pass-through and wall tiles.
import { bool } from './tilemap.js';
import { rectIntersects, rectContains } from './engine.js';
import { game } from './model.js';

export const CHARACTER_COLLISION_SINK = 1;
export const CHARACTER_PASS_THROUGH_POP_UP = 5;
export const CHARACTER_GRAVITY_CONSTANT = 700;
export const CHARACTER_MAX_SPEED_Y = 300;
const CHARACTER_SNAP_COLLISION_LOCKED_Y = 7;
const CHARACTER_SNAP_CENTER_MOVING_DOWN = 7;
const CHARACTER_HEAD_BONK_ELASTICITY_CONSTANT = 0.1;
export const TILE_SIZE_26 = 26;

export const Dir = { Right: 0, Left: 1, Up: 2, Down: 3 };

export const FootSound = {
  Grass: 0, Block: 1, Fence: 2, Cinder: 3, Swamp: 4, Platform: 5, Rope: 6, Bridge: 7,
  Cage: 8, Crate: 9, MetalFence: 10, Pipe: 11, Tree: 12, Bench: 13, Chair: 14,
};

const isSolid = p => !!p && bool(p.solid);
const isPassThrough = p => !!p && bool(p.passThrough);
const isDamage = p => !!p && bool(p.damage);
const isTimmyBlock = p => !!p && bool(p.timmyBlocker);
const isCeiling = p => !!p && bool(p.isCeiling);
const hasSlopeMap = p => !!p && p.slopeMap !== undefined;
export const isWallSlide = p => !!p && bool(p.wallSlide);
export const isInstaDeath = p => !!p && bool(p.instaDeath);

const cMod = (a, b) => Math.trunc(a) % b;   // C integer modulo after (int) cast

export class BaseCharacter {
  constructor(startsFlippedX) {
    this.gameScene = null;
    this.currentVelocity = { x: 0, y: 0 };
    this.sensorOffsets = { yToTop: 0, xToMiddleRight: 0, yToMiddle: 0, xToBottomRight: 0, yToBottom: 0 };
    this.sensors = {};
    this.movingPlatform = null;
    this.collisionLockedRight = false;
    this.collisionLockedLeft = false;
    this.collisionLockedBottom = false;
    this.checkLeadingFoot = false;
    this.defaultFootSound = FootSound.Grass;
    this._footSound = FootSound.Grass;
    this.ignoreGravity = false;
    this.ignoreBlockers = false;
    this.dT = 0; this.dY = 0;
    this.previousPosition = { x: 0, y: 0 };
    this.newPosition = { x: 0, y: 0 };
    this.tileSize = 26;
    this.timmyBlock = false;
    this.hitFlamingPlatform = false;
    // (sprite.flipX == false) means facing right for Timmy. For enemies it's reversed.
    this.extraSpriteFlip = this.initialExtraSpriteFlip();

    this.setSensorOffsets();
    this.sprite = this.createSprite();
    this.sprite.flipX = this.extraSpriteFlip ? !startsFlippedX : startsFlippedX;
    this.createAnimations();
    this.setInitialState();
  }

  initialExtraSpriteFlip() { return false; }
  createSprite() { return null; }
  setSensorOffsets() {}
  createAnimations() {}
  setInitialState() {}

  get footSound() { return this._footSound; }
  set footSound(v) { this._footSound = v; this.onFootSoundSet(); }
  onFootSoundSet() {}

  // ---------------------------------------------------------------- scheduling
  scheduleUpdates() {
    this.tileSize = this.gameScene.tileSize;
    this.gameScene.schedule(this);
  }
  unscheduleUpdates() { if (this.gameScene) this.gameScene.unschedule(this); }
  unscheduleUpdatesWithCleanup() { this.unscheduleUpdates(); }

  update(delta) {
    if (delta > 0.10) return;
    if (game.gameplayIsPaused) return;
    if (!this.shouldUpdate()) return;
    this.dT = delta;

    this.adjustVelocityX();
    this.adjustVelocityY();

    this.previousPosition = this.position;
    const dX = delta * this.currentVelocity.x;
    this.dY = delta * this.currentVelocity.y;
    if (this.ignoreGravity) this.dY = 0;
    this.newPosition = { x: this.previousPosition.x + dX, y: this.previousPosition.y + this.dY };

    this.applySensorOffsetsFromPoint(this.newPosition);
    this.checkForStaticCollisions();
    this.checkForMovingPlatforms();

    if (this.ignoreGravity) this.newPosition.y = this.previousPosition.y;
    this.position = this.newPosition;
    this.handleNewPositionSet();

    if (this.currentVelocity.x > 0) this.sprite.flipX = !!this.extraSpriteFlip;
    else if (this.currentVelocity.x < 0) this.sprite.flipX = !this.extraSpriteFlip;

    this.syncCharacterState();
  }

  // ---------------------------------------------------------------- position
  get position() {
    if (this.movingPlatform) return this.movingPlatform.worldPositionOfRider(this);
    return { x: this.sprite.x, y: this.sprite.y };
  }
  set position(p) {
    if (this.movingPlatform) {
      // Riders are children of the platform sprite (origin at the platform's bottom-left)
      const pl = this.movingPlatform;
      this.sprite.x = p.x - pl.sprite.x + pl.halfPlatform.x;
      this.sprite.y = p.y - pl.sprite.y + pl.halfPlatform.y;
    } else {
      this.sprite.x = p.x; this.sprite.y = p.y;
    }
  }

  applySensorOffsetsFromPoint(p) {
    const o = this.sensorOffsets, s = this.sensors;
    s.center = { x: p.x, y: p.y };
    s.topCenter = { x: p.x, y: p.y + o.yToTop };
    s.topLeft = { x: p.x - (o.xToBottomRight + 1), y: p.y + o.yToTop };
    s.topRight = { x: p.x + (o.xToBottomRight + 1), y: p.y + o.yToTop };
    const midY = p.y + o.yToMiddle;
    s.middleLeft = { x: p.x - o.xToMiddleRight, y: midY };
    s.middleRight = { x: p.x + o.xToMiddleRight, y: midY };
    const botY = p.y + o.yToBottom;
    s.bottomLeft = { x: p.x - o.xToBottomRight, y: botY };
    s.bottomCenter = { x: p.x, y: botY };
    s.bottomRight = { x: p.x + o.xToBottomRight, y: botY };
  }

  collisionRect() {
    const s = this.sensors;
    return { x: s.middleLeft.x, y: s.bottomLeft.y, w: s.middleRight.x - s.middleLeft.x, h: s.topCenter.y - s.bottomLeft.y };
  }
  collisionRectTop() {
    const s = this.sensors;
    return { x: s.middleLeft.x, y: s.middleLeft.y, w: s.middleRight.x - s.middleLeft.x, h: s.topCenter.y - s.middleLeft.y };
  }
  collisionRectBottom() {
    const s = this.sensors;
    return { x: s.middleLeft.x, y: s.bottomLeft.y, w: s.middleRight.x - s.middleLeft.x, h: s.middleLeft.y - s.bottomLeft.y };
  }

  applyVelocity(v) { this.currentVelocity = { x: v.x, y: v.y }; }

  // ---------------------------------------------------------------- static collisions
  checkForStaticCollisions() {
    const gs = this.gameScene, s = this.sensors, v = this.currentVelocity;
    const out = { v: 0 };
    const movingRight = v.x > 0, movingLeft = v.x < 0, movingUp = v.y > 0, movingDown = v.y < 0;
    const onPlatform = !!this.movingPlatform;

    if (movingRight || onPlatform) {
      if (s.middleRight.x > gs.worldWidth) {
        this.handleWorldEdgeCollision(s.middleRight.x - gs.worldWidth);
      } else if (this.checkAt(s.middleRight, Dir.Right, out)) {
        this.handleXCollision(true, out.v);
      } else {
        this.collisionLockedRight = false;
      }
    }
    if (movingLeft || onPlatform) {
      if (s.middleLeft.x < 0) {
        this.handleWorldEdgeCollision(s.middleLeft.x);
      } else if (this.checkAt(s.middleLeft, Dir.Left, out)) {
        this.handleXCollision(false, out.v);
      } else {
        this.collisionLockedLeft = false;
      }
    }

    if (movingUp || onPlatform) {
      if (s.topCenter.y >= gs.worldHeight ||
          this.checkAt(s.topCenter, Dir.Up, out) ||
          this.checkAt(s.topLeft, Dir.Up, out) ||
          this.checkAt(s.topRight, Dir.Up, out)) {
        this.newPosition.y -= (out.v * 1.0 + CHARACTER_HEAD_BONK_ELASTICITY_CONSTANT);
        this.currentVelocity.y = -(this.currentVelocity.y * CHARACTER_HEAD_BONK_ELASTICITY_CONSTANT);
      }
    }
    if (movingDown || onPlatform) {
      if (s.bottomCenter.y < 0) {
        this.handleLoseLife();
        return;
      }
      if (this.checkAt(s.bottomCenter, Dir.Down, out)) {
        if (this.collisionLockedBottom) {
          this.newPosition.y = this.previousPosition.y;
        } else {
          this.newPosition.y += (out.v - CHARACTER_COLLISION_SINK);
          this.collisionLockedBottom = true;
          this.currentVelocity.y = 0;
          this.handleLanded();
        }
      } else if (this.checkAt(s.bottomLeft, Dir.Down, out) || this.checkAt(s.bottomRight, Dir.Down, out)) {
        const below = { x: s.bottomCenter.x, y: s.bottomCenter.y - CHARACTER_SNAP_CENTER_MOVING_DOWN };
        const snap = { v: 0 };
        if (this.checkAt(below, Dir.Down, snap)) {
          this.newPosition.y -= (CHARACTER_SNAP_CENTER_MOVING_DOWN - snap.v);
        } else {
          this.newPosition.y += (out.v - CHARACTER_COLLISION_SINK);
        }
        this.collisionLockedBottom = true;
        this.currentVelocity.y = 0;
        this.handleLanded();
      }
    }
    if (!movingUp && !movingDown && !onPlatform) {
      if (this.checkLeadingFoot) {
        const mr = this.currentVelocity.x > 0, ml = this.currentVelocity.x < 0;
        if (mr || ml) {
          const lead = mr ? s.bottomRight : s.bottomLeft;
          const belowLead = { x: lead.x, y: lead.y - CHARACTER_SNAP_COLLISION_LOCKED_Y };
          if (!this.checkAt(lead, Dir.Down, out) && !this.checkAt(belowLead, Dir.Down, out)) {
            if (!this.shouldContinueAfterLeadingFootHitEdge()) return;
          }
        }
      }
      if (this.checkAt(s.bottomCenter, Dir.Down, out)) {
        if (out.v > CHARACTER_COLLISION_SINK) {
          this.newPosition.y = this.previousPosition.y + (out.v - CHARACTER_COLLISION_SINK);
        }
      } else {
        const below = { x: s.bottomCenter.x, y: s.bottomCenter.y - CHARACTER_SNAP_COLLISION_LOCKED_Y };
        if (this.checkAt(below, Dir.Down, out)) {
          this.newPosition.y += -CHARACTER_SNAP_COLLISION_LOCKED_Y + out.v - CHARACTER_COLLISION_SINK;
          this.collisionLockedBottom = true;
        } else if (this.checkAt(s.bottomLeft, Dir.Down, out) || this.checkAt(s.bottomRight, Dir.Down, out)) {
          this.newPosition.y += (out.v - CHARACTER_COLLISION_SINK);
          this.collisionLockedBottom = true;
        } else {
          this.collisionLockedBottom = false;
        }
      }
    }
  }

  handleWorldEdgeCollision(overrun) {
    this.currentVelocity.x = -this.currentVelocity.x;
    this.newPosition.x -= 2 * overrun;
  }

  // checkForStaticCollisionAtWorldLocation:direction:overrun:
  checkAt(loc, dir, out) {
    const gs = this.gameScene, ts = this.tileSize, s = this.sensors;
    let staticCollision = false;
    const tc = gs.tileCoordinatesFromWorldLocation(loc);
    let x = cMod(loc.x, ts);
    let y = cMod(loc.y, ts);
    const props = gs.propertiesForTileWithCoordinates(tc);

    if (loc === s.bottomCenter) {
      if (this.movingPlatform) this.footSound = FootSound.Platform;
      else if (props && props.footSound !== undefined) this.footSound = parseInt(props.footSound, 10);
      else {
        const lp = gs.propertiesForTileWithCoordinates(gs.tileCoordinatesFromWorldLocation(s.bottomLeft));
        const rp = gs.propertiesForTileWithCoordinates(gs.tileCoordinatesFromWorldLocation(s.bottomRight));
        if (lp && lp.footSound !== undefined) this.footSound = parseInt(lp.footSound, 10);
        else if (rp && rp.footSound !== undefined) this.footSound = parseInt(rp.footSound, 10);
        else this.footSound = this.defaultFootSound;
      }
    }

    const passThrough = isPassThrough(props);
    const damage = isDamage(props);
    let solid = isSolid(props) || (!passThrough && hasSlopeMap(props));
    this.timmyBlock = isTimmyBlock(props);
    if (this.ignoreBlockers && this.timmyBlock) solid = false;

    if (solid || passThrough || damage) {
      const edge = { v: false };
      if (this.collisionInTile(x, y, props, dir, out, edge)) {
        if (damage) this.handleDamage(1);
        if (passThrough) {
          if (dir !== Dir.Down) return false;
          if (out.v > Math.abs(this.dY) + CHARACTER_COLLISION_SINK + CHARACTER_PASS_THROUGH_POP_UP) return false;
        }
        if (solid || passThrough) staticCollision = true;

        if (edge.v) {
          const next = { x: loc.x, y: loc.y };
          switch (dir) {
            case Dir.Up: next.y -= ts; y = ts - 1; break;
            case Dir.Down: next.y += ts; y = 0; break;
            case Dir.Left: next.x += ts; x = 0; break;
            case Dir.Right: next.x -= ts; x = ts - 1; break;
          }
          const np = gs.propertiesForTileAtWorldLocation(next);
          const nSolid = isSolid(np) || (hasSlopeMap(np) && !isPassThrough(np));
          const nPass = isPassThrough(np);
          if (nSolid || nPass) {
            const add = { v: 0 };
            if (this.collisionInTile(x, y, np, dir, add, edge)) {
              if (nSolid || (nPass && add.v <= CHARACTER_SNAP_CENTER_MOVING_DOWN)) out.v += add.v;
            }
          }
        }
      }
    }
    return staticCollision;
  }

  // checkForCollisionAtX:y:withProperties:fromDirection:overrun:filledToEdge:
  collisionInTile(x, y, props, dir, out, edge) {
    const ts = this.tileSize;
    const slope = props ? props.slopeMap : undefined;
    if (slope !== undefined) {
      const vals = String(slope).split(',');
      const h = this.heightForSlopeMap(vals, x);
      const ceiling = isCeiling(props);
      if (ceiling) {
        if (y > h) {
          switch (dir) {
            case Dir.Up: out.v = y - h; edge.v = false; break;
            case Dir.Down: out.v = ts - y; edge.v = true; break;
            default: this.horizontalOverrun(x, y, vals, dir === Dir.Right, true, out, edge);
          }
          return true;
        }
        return false;
      }
      if (y < h) {
        switch (dir) {
          case Dir.Up: out.v = y; edge.v = true; break;
          case Dir.Down: out.v = h - y; edge.v = (h === TILE_SIZE_26); break;
          default: this.horizontalOverrun(x, y, vals, dir === Dir.Right, false, out, edge);
        }
        return true;
      }
      return false;
    }
    switch (dir) {
      case Dir.Up: out.v = y; break;
      case Dir.Down: out.v = ts - y; break;
      case Dir.Left: out.v = ts - x; break;
      case Dir.Right: out.v = x; break;
    }
    edge.v = true;
    return true;
  }

  horizontalOverrun(x, y, vals, isRight, ceiling, out, edge) {
    const ts = this.tileSize;
    if (ceiling) y = ts - y;
    if (isRight) {
      for (let col = x - 1; col >= 0; col--) {
        let mh = this.heightForSlopeMap(vals, col);
        if (ceiling) mh = ts - mh;
        if (!(mh > y)) { out.v = x - col; edge.v = false; return; }
      }
      out.v = x; edge.v = true;
    } else {
      for (let col = x + 1; col < ts; col++) {
        let mh = this.heightForSlopeMap(vals, col);
        if (ceiling) mh = ts - mh;
        if (!(mh > y)) { out.v = col - x; edge.v = false; return; }
      }
      out.v = ts - x; edge.v = true;
    }
  }

  heightForSlopeMap(vals, index) {
    switch (vals.length) {
      case 1: return parseInt(vals[0], 10);
      case 2: {
        const l = parseInt(vals[0], 10), r = parseInt(vals[1], 10);
        const slope = (r - l) / (this.tileSize - 1);
        return Math.trunc(l + index * slope + 0.5);
      }
      default: return parseInt(vals[index], 10) || 0;
    }
  }

  // ---------------------------------------------------------------- moving platforms
  checkForMovingPlatforms() {
    if (this.movingPlatform) this.checkForLeavingPlatform();
    if (!this.checkPlatformSet(this.gameScene.movingPlatforms)) this.checkPlatformSet(this.gameScene.movingWalls);
  }

  checkPlatformSet(set) {
    const rect = this.collisionRect();
    const s = this.sensors;
    for (const platform of set) {
      if (platform === this.movingPlatform) continue;
      const bbox = platform.boundingBox();
      if (!rectIntersects(rect, bbox)) continue;
      if (platform.isFlaming) {
        this.hitFlamingPlatform = true;
        this.handleDamage(3);
        return true;
      }
      if (platform.causesDamage) {
        if (rectIntersects(rect, platform.damageBox())) this.handleDamage(1);
        return true;
      }
      if (!platform.isAcceptingRiders) continue;
      if (platform.isSolid) {
        this.pushWithSolidPlatform(platform);
        return true;
      }
      const footCollision = rectContains(bbox, s.bottomLeft.x, s.bottomLeft.y) || rectContains(bbox, s.bottomRight.x, s.bottomRight.y);
      if (footCollision) {
        const footY = s.bottomLeft.y;
        const top = bbox.y + bbox.h;
        let shouldLand = false;
        if (this.currentVelocity.y < 0) {
          shouldLand = footY >= top - CHARACTER_PASS_THROUGH_POP_UP + this.dY;
        }
        if (shouldLand) {
          this.dropOffPlatform();
          this.movingPlatform = platform;
          platform.addRider(this);
          this.currentVelocity.y = 0;
          this.collisionLockedBottom = true;
          this.handleLanded();
          this.newPosition.y += (top - CHARACTER_COLLISION_SINK) - footY;
          this.sprite.removeFromParent();
          platform.sprite.addChild(this.sprite);
          this.footSound = FootSound.Platform;
          this.handleLanded();
          return true;
        }
        continue;
      }
    }
    return false;
  }

  pushWithSolidPlatform(platform) {
    const b = platform.boundingBox(), s = this.sensors;
    let ox = 0, oy = 0;
    if (rectContains(b, s.middleRight.x, s.middleRight.y)) ox = b.x - s.middleRight.x;
    else if (rectContains(b, s.middleLeft.x, s.middleLeft.y)) ox = b.x + b.w - s.middleLeft.x;
    else if (rectContains(b, s.topCenter.x, s.topCenter.y)) {
      oy = b.y - s.topCenter.y;
      this.currentVelocity.y = -CHARACTER_HEAD_BONK_ELASTICITY_CONSTANT * this.currentVelocity.y;
    }
    this.newPosition.x += ox; this.newPosition.y += oy;
  }

  checkForLeavingPlatform() {
    const pl = this.movingPlatform;
    let leaving = false;
    if (this.currentVelocity.y > 0) leaving = true;
    else if (this.currentVelocity.x > 0) {
      if (this.sprite.x - this.sensorOffsets.xToBottomRight > pl.sprite.width) leaving = true;
    } else if (this.currentVelocity.x < 0) {
      if (this.sprite.x + this.sensorOffsets.xToBottomRight < 0) leaving = true;
    }
    if (leaving) this.dropOffPlatform();
  }

  dropOffPlatform() {
    if (!this.movingPlatform) return;
    const p = this.position;
    this.sprite.removeFromParent();
    this.gameScene.gameLayer.addChild(this.sprite, this.gameLayerZ || 0);
    this.sprite.x = p.x; this.sprite.y = p.y;
    this.movingPlatform.removeRider(this);
    this.movingPlatform = null;
    this.collisionLockedBottom = false;
  }

  // ---------------------------------------------------------------- callbacks
  shouldUpdate() { return true; }
  adjustVelocityX() {}
  adjustVelocityY() {
    if (!this.collisionLockedBottom && this.currentVelocity.y > -CHARACTER_MAX_SPEED_Y) {
      this.currentVelocity.y -= this.dT * CHARACTER_GRAVITY_CONSTANT;
    }
  }
  handleDamage() {}
  handleLoseLife() {}
  handleLanded() {}
  handleXCollision() {}
  shouldContinueAfterLeadingFootHitEdge() { return false; }
  handleNewPositionSet() {}
  syncCharacterState() {}
  playDeathSound() {}
}
