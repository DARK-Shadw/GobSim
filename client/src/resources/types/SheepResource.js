import { AnimatedSprite } from 'pixi.js';
import { tileAtlas } from '@/world/TileAtlas.js';
import { TILE_SIZE, ANIM_SPEED, RESOURCE, ELEVATION } from '@shared/constants.js';
import { WORLD_COLS, WORLD_ROWS } from '@shared/constants.js';

/**
 * Sheep — mobile, renewable food source.
 * States: IDLE → WANDER → GRAZE → (FLEE in Phase 2)
 */
export const SheepTypeDef = {
  type: 'sheep',
  initialState: 'IDLE',

  states: {
    IDLE: {},
    WANDER: {},
    GRAZE: {},
    FLEE: {},
  },

  createSprite(entity, manager) {
    const tex = manager.textures.sheep_idle;
    const idleFrames = tileAtlas.extractFrames(tex, 128, 128, 6);
    const moveFrames = tileAtlas.extractFrames(manager.textures.sheep_move, 128, 128, 4);
    const grazeFrames = tileAtlas.extractFrames(manager.textures.sheep_grass, 128, 128, 12);

    // Cache frames on entity for animation swapping
    entity.data.frames = { idle: idleFrames, move: moveFrames, graze: grazeFrames };
    entity.data.reproCheck = 0;

    const sprite = new AnimatedSprite(idleFrames);
    sprite.animationSpeed = ANIM_SPEED.SHEEP;
    sprite.gotoAndPlay(manager.rng.nextInt(0, 6));
    sprite.anchor.set(0.5, 1);
    sprite.x = entity.px;
    sprite.y = entity.py;
    return sprite;
  },

  onStateEnter(entity, state, ctx) {
    const { rng } = ctx;
    switch (state) {
      case 'IDLE':
        _setAnimation(entity, 'idle', ANIM_SPEED.SHEEP);
        entity.stateTimer = rng.nextInt(RESOURCE.SHEEP_IDLE_MIN, RESOURCE.SHEEP_IDLE_MAX);
        break;

      case 'WANDER': {
        _setAnimation(entity, 'move', ANIM_SPEED.SHEEP_WALK);
        const target = _pickWanderTarget(entity, ctx);
        entity.data.targetPx = target.col * TILE_SIZE + TILE_SIZE / 2;
        entity.data.targetPy = target.row * TILE_SIZE + TILE_SIZE;
        break;
      }

      case 'GRAZE':
        _setAnimation(entity, 'graze', ANIM_SPEED.SHEEP_GRAZE);
        entity.stateTimer = rng.nextInt(RESOURCE.SHEEP_GRAZE_MIN, RESOURCE.SHEEP_GRAZE_MAX);
        break;

      case 'FLEE':
        _setAnimation(entity, 'move', ANIM_SPEED.SHEEP_WALK);
        break;
    }
  },

  update(entity, delta, ctx) {
    switch (entity.state) {
      case 'IDLE':
        if (entity.stateTimer <= 0) {
          // 60% wander, 40% graze
          entity.setState(ctx.rng.next() < 0.6 ? 'WANDER' : 'GRAZE', ctx);
        }
        break;

      case 'WANDER':
        _moveToward(entity, entity.data.targetPx, entity.data.targetPy, RESOURCE.SHEEP_SPEED, delta, ctx);
        break;

      case 'GRAZE':
        if (entity.stateTimer <= 0) {
          entity.setState('IDLE', ctx);
        }
        break;

      case 'FLEE':
        _moveToward(entity, entity.data.targetPx, entity.data.targetPy, RESOURCE.SHEEP_FLEE_SPEED, delta, ctx);
        break;
    }

    // Reproduction check (only every N ticks)
    entity.data.reproCheck = (entity.data.reproCheck || 0) + 1;
    if (entity.data.reproCheck >= RESOURCE.SHEEP_REPRO_CHECK_INTERVAL) {
      entity.data.reproCheck = 0;
      _checkReproduction(entity, ctx);
    }
  },

  // Phase 2 API: trigger flee from a threat position
  flee(entity, threatCol, threatRow, ctx) {
    if (entity.state === 'FLEE') return;
    const dx = entity.col - threatCol;
    const dy = entity.row - threatRow;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const fleeCol = Math.round(entity.col + (dx / dist) * RESOURCE.SHEEP_FLEE_DISTANCE);
    const fleeRow = Math.round(entity.row + (dy / dist) * RESOURCE.SHEEP_FLEE_DISTANCE);
    const clamped = _clampToLand(fleeCol, fleeRow, ctx.world);
    entity.data.targetPx = clamped.col * TILE_SIZE + TILE_SIZE / 2;
    entity.data.targetPy = clamped.row * TILE_SIZE + TILE_SIZE;
    entity.setState('FLEE', ctx);
  },

  // Phase 2 API: kill sheep
  kill(entity, ctx) {
    ctx.manager.spawnParticle('dust', entity.px, entity.py - TILE_SIZE / 2);
    ctx.manager.queueSpawn('drop_meat', entity.col, entity.row, 1);
    ctx.manager.remove(entity.id);
  },
};

// ── Helpers ──

function _setAnimation(entity, key, speed) {
  const frames = entity.data.frames[key];
  if (entity.sprite.textures !== frames) {
    entity.sprite.textures = frames;
    entity.sprite.animationSpeed = speed;
    entity.sprite.play();
  }
}

function _moveToward(entity, targetX, targetY, speed, delta, ctx) {
  const dx = targetX - entity.px;
  const dy = targetY - entity.py;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 2) {
    // Arrived
    entity.px = targetX;
    entity.py = targetY;
    const oldCol = entity.col;
    const oldRow = entity.row;
    entity.col = Math.floor(entity.px / TILE_SIZE);
    entity.row = Math.floor((entity.py - 1) / TILE_SIZE);
    if (entity.col !== oldCol || entity.row !== oldRow) {
      ctx.manager.spatialMove(entity, oldCol, oldRow);
    }
    entity.sprite.x = entity.px;
    entity.sprite.y = entity.py;
    entity.sprite.zIndex = entity.py;
    entity.setState('IDLE', ctx);
    return;
  }

  const step = speed * delta;
  const nextPx = entity.px + (dx / dist) * step;
  const nextPy = entity.py + (dy / dist) * step;

  // Check if next position is water — if so, stop and go idle
  const nextCol = Math.floor(nextPx / TILE_SIZE);
  const nextRow = Math.floor((nextPy - 1) / TILE_SIZE);
  if (nextCol < 0 || nextCol >= WORLD_COLS || nextRow < 0 || nextRow >= WORLD_ROWS
      || ctx.world.elevation[nextRow][nextCol] < ELEVATION.FLAT) {
    entity.setState('IDLE', ctx);
    return;
  }

  entity.px = nextPx;
  entity.py = nextPy;
  entity.sprite.x = entity.px;
  entity.sprite.y = entity.py;
  entity.sprite.zIndex = entity.py;

  // Flip sprite based on horizontal direction
  entity.sprite.scale.x = dx < 0 ? -1 : 1;

  // Update grid position if tile changed
  if (nextCol !== entity.col || nextRow !== entity.row) {
    const oldCol = entity.col;
    const oldRow = entity.row;
    entity.col = nextCol;
    entity.row = nextRow;
    ctx.manager.spatialMove(entity, oldCol, oldRow);
  }
}

function _pickWanderTarget(entity, ctx) {
  const { rng, world } = ctx;
  for (let attempt = 0; attempt < 10; attempt++) {
    const col = entity.homeCol + rng.nextInt(-RESOURCE.SHEEP_WANDER_RADIUS, RESOURCE.SHEEP_WANDER_RADIUS + 1);
    const row = entity.homeRow + rng.nextInt(-RESOURCE.SHEEP_WANDER_RADIUS, RESOURCE.SHEEP_WANDER_RADIUS + 1);
    if (col < 0 || col >= WORLD_COLS || row < 0 || row >= WORLD_ROWS) continue;
    if (world.elevation[row][col] < ELEVATION.FLAT) continue;
    return { col, row };
  }
  // Fallback: stay home
  return { col: entity.homeCol, row: entity.homeRow };
}

function _clampToLand(col, row, world) {
  col = Math.max(0, Math.min(WORLD_COLS - 1, col));
  row = Math.max(0, Math.min(WORLD_ROWS - 1, row));
  if (world.elevation[row][col] >= ELEVATION.FLAT) return { col, row };
  // Search outward for land
  for (let r = 1; r < 5; r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        const c2 = col + dc, r2 = row + dr;
        if (c2 >= 0 && c2 < WORLD_COLS && r2 >= 0 && r2 < WORLD_ROWS
            && world.elevation[r2][c2] >= ELEVATION.FLAT) {
          return { col: c2, row: r2 };
        }
      }
    }
  }
  return { col, row };
}

function _checkReproduction(entity, ctx) {
  if (entity.state !== 'IDLE' && entity.state !== 'GRAZE') return;
  const counts = ctx.manager.getCount('sheep');
  if (counts.current >= counts.initial * RESOURCE.SHEEP_REPRO_THRESHOLD) return;
  if (counts.current >= counts.initial) return;

  const neighbors = ctx.manager.getResourcesInRadius(entity.col, entity.row, 3, 'sheep');
  if (neighbors.length < 2) return;
  if (ctx.rng.next() >= RESOURCE.SHEEP_REPRO_CHANCE * RESOURCE.SHEEP_REPRO_CHECK_INTERVAL) return;

  ctx.manager.queueSpawn('sheep', entity.col, entity.row, 1);
}
