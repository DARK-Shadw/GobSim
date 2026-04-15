import { AnimatedSprite, Container, Sprite } from 'pixi.js';
import { ResourceEntity } from './ResourceEntity.js';
import { SeededRandom } from '@/utils/SeededRandom.js';
import { tileAtlas } from '@/world/TileAtlas.js';
import { TILE_SIZE, ANIM_SPEED } from '@shared/constants.js';

/**
 * Central resource management system.
 * Tracks all interactive entities (sheep, bushes, trees, gold, drops)
 * with state machines, spawning/despawning, and spatial queries.
 */
export class ResourceManager {
  constructor(app, world, renderContainer) {
    this.app = app;
    this.world = world;
    this.textures = app.textures;
    this.container = renderContainer;
    this.rng = new SeededRandom(world.seed + 1500);

    this._nextId = 1;
    this._entities = new Map();       // id → ResourceEntity
    this._typeRegistry = new Map();   // type string → typeDef
    this._spatial = new Map();        // "col,row" → Set<id>
    this._counts = {};                // type → { current, initial }

    this._pendingRemovals = [];
    this._pendingSpawns = [];

    // Particle one-shot effects
    this._particles = [];
  }

  // ── Type Registration ──

  registerType(typeDef) {
    this._typeRegistry.set(typeDef.type, typeDef);
    this._counts[typeDef.type] = { current: 0, initial: 0 };
  }

  // ── Entity Lifecycle ──

  spawn(type, col, row, variant, extraData) {
    const typeDef = this._typeRegistry.get(type);
    if (!typeDef) return null;

    const id = this._nextId++;
    const entity = new ResourceEntity(id, typeDef, col, row, variant);
    if (extraData) Object.assign(entity.data, extraData);

    const sprite = typeDef.createSprite(entity, this);
    entity.sprite = sprite;
    sprite.zIndex = entity.py;
    this.container.addChild(sprite);

    this._entities.set(id, entity);
    this._counts[type].current++;
    this._spatialInsert(entity);

    // Fire initial state enter
    if (typeDef.onStateEnter) {
      typeDef.onStateEnter(entity, entity.state, this._makeContext(0));
    }

    return entity;
  }

  remove(id) {
    this._pendingRemovals.push(id);
  }

  queueSpawn(type, col, row, variant, data) {
    this._pendingSpawns.push({ type, col, row, variant, data });
  }

  _processRemovals() {
    for (const id of this._pendingRemovals) {
      const entity = this._entities.get(id);
      if (!entity) continue;
      this._spatialRemove(entity);
      entity.destroy();
      this._entities.delete(id);
      if (this._counts[entity.type]) this._counts[entity.type].current--;
    }
    this._pendingRemovals.length = 0;
  }

  _processSpawns() {
    for (const s of this._pendingSpawns) {
      this.spawn(s.type, s.col, s.row, s.variant, s.data);
    }
    this._pendingSpawns.length = 0;
  }

  // ── Main Update Loop ──

  update(delta, viewBounds) {
    const ctx = this._makeContext(delta);

    for (const entity of this._entities.values()) {
      entity.update(delta, ctx);
    }

    this._processRemovals();
    this._processSpawns();
    this._updateVisibility(viewBounds);
    this._updateParticles(delta);
  }

  _makeContext(delta) {
    return {
      world: this.world,
      manager: this,
      rng: this.rng,
      textures: this.textures,
      delta,
    };
  }

  // ── Queries ──

  getEntity(id) {
    return this._entities.get(id) || null;
  }

  getResourceAt(col, row, type) {
    const key = `${col},${row}`;
    const ids = this._spatial.get(key);
    if (!ids) return null;
    for (const id of ids) {
      const e = this._entities.get(id);
      if (e && e.alive && (!type || e.type === type)) return e;
    }
    return null;
  }

  getResourcesInRadius(col, row, radius, type) {
    const results = [];
    const r2 = radius * radius;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (dr * dr + dc * dc > r2) continue;
        const key = `${col + dc},${row + dr}`;
        const ids = this._spatial.get(key);
        if (!ids) continue;
        for (const id of ids) {
          const e = this._entities.get(id);
          if (e && e.alive && (!type || e.type === type)) results.push(e);
        }
      }
    }
    return results;
  }

  getCount(type) {
    return this._counts[type] || { current: 0, initial: 0 };
  }

  getAllCounts() {
    return this._counts;
  }

  // ── Spatial Index ──

  _spatialInsert(entity) {
    const key = `${entity.col},${entity.row}`;
    let set = this._spatial.get(key);
    if (!set) { set = new Set(); this._spatial.set(key, set); }
    set.add(entity.id);
  }

  _spatialRemove(entity) {
    const key = `${entity.col},${entity.row}`;
    const set = this._spatial.get(key);
    if (set) {
      set.delete(entity.id);
      if (set.size === 0) this._spatial.delete(key);
    }
  }

  spatialMove(entity, oldCol, oldRow) {
    const oldKey = `${oldCol},${oldRow}`;
    const oldSet = this._spatial.get(oldKey);
    if (oldSet) {
      oldSet.delete(entity.id);
      if (oldSet.size === 0) this._spatial.delete(oldKey);
    }
    this._spatialInsert(entity);
  }

  // ── Viewport Culling ──

  _updateVisibility(viewBounds) {
    if (!viewBounds) return;
    const margin = 256;
    const left = viewBounds.x - margin;
    const right = viewBounds.x + viewBounds.width + margin;
    const top = viewBounds.y - margin;
    const bottom = viewBounds.y + viewBounds.height + margin;

    for (const entity of this._entities.values()) {
      if (entity.sprite) {
        entity.sprite.visible = (
          entity.px > left && entity.px < right &&
          entity.py > top && entity.py < bottom
        );
      }
    }
  }

  // ── Particles (one-shot effects) ──

  spawnParticle(type, x, y) {
    const config = PARTICLE_CONFIG[type];
    if (!config) return;
    const tex = this.textures[config.textureKey];
    if (!tex) return;
    const frames = tileAtlas.extractFrames(tex, config.w, config.h, config.count);
    const sprite = new AnimatedSprite(frames);
    sprite.anchor.set(0.5, 0.5);
    sprite.x = x;
    sprite.y = y;
    sprite.zIndex = y + 1000; // particles above everything
    sprite.animationSpeed = config.speed;
    sprite.loop = false;
    sprite.play();
    sprite.onComplete = () => {
      this.container.removeChild(sprite);
      sprite.destroy();
    };
    this.container.addChild(sprite);
    this._particles.push(sprite);
  }

  _updateParticles() {
    this._particles = this._particles.filter(s => !s.destroyed);
  }

  // ── Initialization from WorldGenerator ──

  initFromWorld() {
    // Bushes and trees from decorations
    for (const dec of this.world.decorations) {
      if (dec.type === 'bush' || dec.type === 'tree') {
        const entity = this.spawn(dec.type, dec.col, dec.row, dec.variant);
        if (entity) {
          this._counts[dec.type].initial++;
          // Scarce food at start — 65% of bushes start depleted
          if (dec.type === 'bush' && this.rng.next() > 0.35) {
            const ctx = this._makeContext(0);
            entity.setState('DEPLETED', ctx);
            // Stagger regrow times so they don't all come back at once
            entity.stateTimer = Math.floor(this.rng.next() * 1200);
          }
        }
      }
    }
    // Sheep and gold from resources
    for (const res of this.world.resources) {
      if (this._typeRegistry.has(res.type)) {
        const entity = this.spawn(res.type, res.col, res.row, res.variant);
        if (entity) this._counts[res.type].initial++;
      }
    }

    console.log('[ResourceManager] Initialized:', Object.entries(this._counts)
      .map(([t, c]) => `${t}: ${c.current}`).join(', '));
  }

  // ── Trigger sheep flee (Phase 2 API) ──

  triggerFlee(col, row, radius) {
    const sheep = this.getResourcesInRadius(col, row, radius, 'sheep');
    for (const s of sheep) {
      if (s.typeDef.flee) s.typeDef.flee(s, col, row, this._makeContext(0));
    }
  }
}

const PARTICLE_CONFIG = {
  dust: { textureKey: 'dust1', w: 64, h: 64, count: 8, speed: ANIM_SPEED.DUST },
  explosion: { textureKey: 'explosion1', w: 192, h: 192, count: 8, speed: ANIM_SPEED.EXPLOSION },
};
