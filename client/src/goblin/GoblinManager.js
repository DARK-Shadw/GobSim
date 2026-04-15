import { AnimatedSprite, Text } from 'pixi.js';
import { Goblin } from './Goblin.js';
import { GoblinSpriteSet } from './GoblinSpriteSet.js';
import { Pathfinder } from './Pathfinder.js';
import { SeededRandom } from '@/utils/SeededRandom.js';
import { Camp } from './Camp.js';
import { createRandomGenome } from './Genome.js';
import { getGoblinName, getFamilyName } from '@/utils/GoblinNames.js';
import { IdleAction } from './actions/IdleAction.js';
import { WanderAction } from './actions/WanderAction.js';
import { ExploreAction } from './actions/ExploreAction.js';
import { EatAction } from './actions/EatAction.js';
import { GatherWoodAction } from './actions/GatherWoodAction.js';
import { GatherGoldAction } from './actions/GatherGoldAction.js';
import { HuntAction } from './actions/HuntAction.js';
import { RestAction } from './actions/RestAction.js';
import { SleepAction } from './actions/SleepAction.js';
import { DepositAction } from './actions/DepositAction.js';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, ELEVATION, GOBLIN_ANIM, SKILLS } from '@shared/constants.js';

const DECISION_INTERVAL = 30; // ticks between decision cycles (~0.5s at 60fps)

const THOUGHT_ICONS = {
  eat: '\uD83C\uDF56',         // 🍖
  gather_wood: '\uD83E\uDE93', // 🪓
  gather_gold: '\u26CF',       // ⛏
  explore: '\uD83D\uDC63',    // 👣
  wander: '\uD83D\uDC63',     // 👣
  sleep: '\uD83D\uDCA4',      // 💤
  rest: '\uD83D\uDCA8',       // 💨
  deposit: '\uD83D\uDCE6',    // 📦
  hunt: '\uD83D\uDDE1',       // 🗡
  idle: '\u2753',              // ❓
};

/**
 * Manages all goblins. Runs alongside ResourceManager, sharing the same
 * render container for correct Y-sorted depth.
 */
export class GoblinManager {
  constructor(app, world, resourceManager, renderContainer, dayNight, narrator, floatingText) {
    this.app = app;
    this.world = world;
    this.resources = resourceManager;
    this.container = renderContainer;
    this.textures = app.textures;
    this.dayNight = dayNight || null;
    this.narrator = narrator || null;
    this.floatingText = floatingText || null;
    this.rng = new SeededRandom(world.seed + Date.now());

    this.spriteSet = new GoblinSpriteSet(this.textures);
    this.pathfinder = new Pathfinder(world);
    this._goblins = new Map();
    this._nextId = 1;

    // Action registry — all 10 actions
    this._actions = [
      IdleAction, WanderAction, ExploreAction,
      EatAction, GatherWoodAction, GatherGoldAction,
      HuntAction, RestAction, SleepAction, DepositAction,
    ];

    // Camp (spawned alongside first goblin)
    this.camp = null;

    // Memory sharing timer
    this._shareTimer = 0;
  }

  // ── Spawning ──

  spawnGoblin(col, row, options = {}) {
    const id = this._nextId++;
    const genome = options.genome || createRandomGenome(this.rng);
    const goblin = new Goblin(id, col, row, genome);

    // Assign family identity
    const familyIndex = options.familyIndex !== undefined ? options.familyIndex : (id - 1);
    goblin.firstName = getGoblinName(id);
    goblin.familyName = getFamilyName(familyIndex);
    goblin.name = `${goblin.firstName} ${goblin.familyName}`;
    goblin.familyIndex = familyIndex;
    goblin.lineage = {
      parentIds: options.parentIds || [],
      familyName: goblin.familyName,
      generation: options.generation || 0,
    };

    // Create idle sprite
    const frames = this.spriteSet.getFrames('idle', 'none');
    const sprite = new AnimatedSprite(frames);
    sprite.animationSpeed = GOBLIN_ANIM.IDLE;
    sprite.play();
    sprite.anchor.set(0.5, 1);
    sprite.x = goblin.px;
    sprite.y = goblin.py;
    sprite.zIndex = goblin.py;
    goblin.sprite = sprite;
    goblin._currentAnim = 'idle:none';
    this.container.addChild(sprite);

    // Name label below sprite
    const nameLabel = new Text({
      text: goblin.firstName,
      style: { fontFamily: 'Georgia, serif', fontSize: 9, fill: 0xffffff,
               stroke: { color: 0x000000, width: 2 } },
    });
    nameLabel.anchor.set(0.5, 0);
    nameLabel.x = goblin.px;
    nameLabel.y = goblin.py + 4;
    nameLabel.zIndex = goblin.py + 1;
    goblin._nameLabel = nameLabel;
    this.container.addChild(nameLabel);

    // Reveal initial vision and scan for resources
    this._revealVision(goblin);
    this._scanResources(goblin);

    this._goblins.set(id, goblin);

    // Spawn camp near first goblin on a clear tile
    if (!this.camp) {
      const campSpot = this._findClearTile(col, row);
      this.camp = new Camp(campSpot.col, campSpot.row, this.textures, this.container);
      console.log(`[GoblinManager] Camp at (${campSpot.col}, ${campSpot.row})`);
    }

    console.log(`[GoblinManager] Spawned ${goblin.name} (#${id}) at (${col}, ${row}) | Speed:${goblin.traits.speed.toFixed(2)} Sense:${goblin.traits.sense_range} Gather:${goblin.traits.gather_time.toFixed(0)}`);
    return goblin;
  }

  // ── Main Update Loop ──

  update(delta, viewBounds) {
    // Process queued path requests
    this.pathfinder.processQueue();

    for (const goblin of this._goblins.values()) {
      if (!goblin.alive) continue;
      goblin._tickCount++;
      goblin.updateAge(delta);

      this._tickDrives(goblin, delta);

      // Path following
      if (goblin.path) {
        this._moveAlongPath(goblin, delta);
      }

      // Execute current action BEFORE deciding — so interactions start
      // (e.g., goblin arrives at tree, execute begins chopping, actionTimer > 0)
      if (goblin.currentAction) {
        goblin.currentAction.execute(goblin, this._makeActionContext(delta));
      }

      // Decision cycle — only when goblin is NOT mid-task
      // Committed = walking, waiting for path, or mid-interaction (chopping/mining/eating)
      goblin._decisionCooldown--;
      const committed = goblin.path || goblin._pathPending || goblin.actionTimer > 0;
      const currentActionName = goblin.currentAction?.name;
      const isFoodAction = currentActionName === 'eat' || currentActionName === 'hunt';
      const starvingOverride = goblin.drives.hunger < 0.21 && committed && !isFoodAction;
      if (goblin._decisionCooldown <= 0 && (!committed || starvingOverride)) {
        if (starvingOverride) {
          // Survival interrupt — drop everything to find food
          goblin.path = null;
          goblin.pathIndex = 0;
          goblin._pathPending = false;
          goblin.actionTimer = 0;
        }
        this._scanResources(goblin);
        this._decide(goblin, delta);
        goblin._decisionCooldown = DECISION_INTERVAL;
      }

      // Safety: check goblin isn't standing on water
      if (this.world.elevation[goblin.row]?.[goblin.col] < ELEVATION.FLAT) {
        console.warn(`[Goblin #${goblin.id}] ON WATER at tile (${goblin.col},${goblin.row})! Relocating.`);
        this._relocateToLand(goblin);
      }

      // Survival warnings (narrate once when thresholds crossed)
      if (goblin.drives.hunger < 0.15 && !goblin._warnedStarving) {
        goblin._warnedStarving = true;
        if (this.narrator) this.narrator.log(`${goblin.name} is starving!`, 0xff4444);
      } else if (goblin.drives.hunger >= 0.15) {
        goblin._warnedStarving = false;
      }

      // Death check — starvation
      const cause = goblin.checkDeath();
      if (cause) {
        this._killGoblin(goblin, cause);
        continue;
      }

      goblin.sprite.tint = goblin.getDriveTint();

      // Urgency VFX — sprite pulse when starving
      if (goblin.drives.hunger < 0.15 || goblin._starvationTimer > 0) {
        const pulse = 1.0 + 0.1 * Math.sin(goblin._tickCount * 0.15);
        goblin.sprite.scale.y = pulse;
        // Preserve direction on x
        goblin.sprite.scale.x = goblin.sprite.scale.x > 0 ? pulse : -pulse;
      }

      // Camera shake on critical hunger (once)
      if (goblin.drives.hunger < 0.1 && !goblin._warnedCritical) {
        goblin._warnedCritical = true;
        this._triggerCameraShake();
      } else if (goblin.drives.hunger >= 0.1) {
        goblin._warnedCritical = false;
      }

      // Thought bubble
      this._updateThoughtBubble(goblin);
    }

    // Memory sharing between nearby goblins
    this._shareTimer += delta;
    if (this._shareTimer >= 60) {
      this._tickMemorySharing();
      this._shareTimer = 0;
    }

    // Viewport culling
    this._updateVisibility(viewBounds);
  }

  // ── Death ──

  _killGoblin(goblin, cause) {
    console.log(
      `%c[Goblin #${goblin.id}] DIED of ${cause}!` +
      ` | Survived ${goblin._tickCount} ticks` +
      ` | Explored ${goblin.explored.reduce((a, b) => a + b, 0)} tiles`,
      'color: red; font-weight: bold; font-size: 14px'
    );

    if (this.narrator) {
      const alive = [...this._goblins.values()].filter(g => g.alive && g !== goblin).length;
      this.narrator.log(`${goblin.name} has perished from ${cause}. ${alive} goblin${alive !== 1 ? 's' : ''} remain.`, 0xff0000);
    }

    // Cinematic slow-mo on death
    this._triggerDeathSlowMo();

    // Drop inventory on the ground
    if (goblin.getInventoryTotal() > 0) {
      console.log(`[Goblin #${goblin.id}] Dropped inventory: M${goblin.inventory.meat} W${goblin.inventory.wood} G${goblin.inventory.gold}`);
    }

    // Remove thought bubble and name label
    if (goblin._bubble) {
      if (goblin._bubble.parent) goblin._bubble.parent.removeChild(goblin._bubble);
      goblin._bubble.destroy();
      goblin._bubble = null;
    }
    if (goblin._nameLabel) {
      if (goblin._nameLabel.parent) goblin._nameLabel.parent.removeChild(goblin._nameLabel);
      goblin._nameLabel.destroy();
      goblin._nameLabel = null;
    }

    // Fade out sprite
    if (goblin.sprite) {
      goblin.sprite.tint = 0x444444;
      goblin.sprite.alpha = 0.5;
      // Fade to nothing over 2 seconds
      const fadeInterval = setInterval(() => {
        if (!goblin.sprite) { clearInterval(fadeInterval); return; }
        goblin.sprite.alpha -= 0.02;
        if (goblin.sprite.alpha <= 0) {
          clearInterval(fadeInterval);
          goblin.destroy();
        }
      }, 33);
    }

    goblin.alive = false;
  }

  // ── Queries ──

  getGoblin(id) { return this._goblins.get(id) || null; }

  getGoblinAt(col, row) {
    for (const g of this._goblins.values()) {
      if (g.alive && g.col === col && g.row === row) return g;
    }
    return null;
  }

  getAllGoblins() { return this._goblins; }

  // ── Urgency VFX ──

  _triggerCameraShake() {
    if (!this.app.camera) return;
    const cam = this.app.camera;
    let frame = 0;
    const shake = () => {
      if (frame >= 20) {
        cam._shakeOffsetX = 0;
        cam._shakeOffsetY = 0;
        return;
      }
      cam._shakeOffsetX = (Math.random() - 0.5) * 6;
      cam._shakeOffsetY = (Math.random() - 0.5) * 6;
      frame++;
      requestAnimationFrame(shake);
    };
    shake();
  }

  _triggerDeathSlowMo() {
    const ticker = this.app.pixi.ticker;
    const prevSpeed = ticker.speed;
    ticker.speed = 0.3;
    let frame = 0;
    const restore = () => {
      frame++;
      if (frame >= 120) {
        ticker.speed = this.app.gameSpeed || prevSpeed;
        return;
      }
      requestAnimationFrame(restore);
    };
    requestAnimationFrame(restore);
  }

  // ── Floating Text ──

  showFloat(goblin, text, color) {
    if (this.floatingText) {
      this.floatingText.spawn(text, goblin.px, goblin.py - 120, color);
    }
  }

  // ── Thought Bubbles ──

  _updateThoughtBubble(goblin) {
    const action = goblin.currentAction?.name || 'idle';
    const icon = THOUGHT_ICONS[action] || '\u2753'; // ❓

    if (!goblin._bubble) {
      goblin._bubble = new Text({
        text: icon,
        style: { fontSize: 16, fill: 0xffffff },
      });
      goblin._bubble.anchor.set(0.5, 1);
      this.container.addChild(goblin._bubble);
    }

    goblin._bubble.text = icon;
    goblin._bubble.x = goblin.px;
    goblin._bubble.y = goblin.py - 140;
    goblin._bubble.zIndex = goblin.py + 1;
    goblin._bubble.visible = goblin.sprite.visible;
  }

  // ── Animation ──

  _setAnimation(goblin, action, carry) {
    const key = `${action}:${carry}`;
    if (goblin._currentAnim === key) return;
    goblin._currentAnim = key;

    const frames = this.spriteSet.getFrames(action, carry);
    const speed = action === 'run' ? GOBLIN_ANIM.RUN
      : action === 'interact' ? GOBLIN_ANIM.INTERACT
      : GOBLIN_ANIM.IDLE;

    goblin.sprite.textures = frames;
    goblin.sprite.animationSpeed = speed;
    goblin.sprite.play();
  }

  // ── Vision ──

  _getEffectiveVisionRange(goblin) {
    const base = goblin.traits.sense_range;
    const mult = this.dayNight ? this.dayNight.getVisionMultiplier() : 1.0;
    return Math.max(1, Math.floor(base * mult));
  }

  _revealVision(goblin) {
    const range = this._getEffectiveVisionRange(goblin);
    const r2 = range * range;
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        if (dr * dr + dc * dc > r2) continue;
        const c = goblin.col + dc;
        const r = goblin.row + dr;
        if (c < 0 || c >= WORLD_COLS || r < 0 || r >= WORLD_ROWS) continue;
        goblin.explored[r * WORLD_COLS + c] = 1;
      }
    }
  }

  // ── Spatial Memory ──

  /** Scan visible tiles for resources and record/update memory entries. */
  _scanResources(goblin) {
    const range = this._getEffectiveVisionRange(goblin);

    // Get ALL entities in vision range (handles multiple per tile)
    const visible = this.resources.getResourcesInRadius(goblin.col, goblin.row, range);
    const seenIds = new Set();

    for (const entity of visible) {
      seenIds.add(entity.id);
      goblin.memory.set(entity.id, {
        type: entity.type,
        entityId: entity.id,
        state: entity.state,
        col: entity.col,
        row: entity.row,
        lastSeen: goblin._tickCount,
      });
    }

    // Clean stale entries — if entity was in vision range but no longer visible
    const r2 = range * range;
    for (const [key, entry] of goblin.memory) {
      const dc = entry.col - goblin.col;
      const dr = entry.row - goblin.row;
      if (dc * dc + dr * dr <= r2 && !seenIds.has(entry.entityId)) {
        goblin.memory.delete(key);
      }
    }
  }

  /**
   * Find nearest remembered resource matching type and optional state filter.
   * @param {Goblin} goblin
   * @param {string} type - e.g. 'bush', 'tree', 'gold', 'sheep', 'dropped_meat'
   * @param {string|null} stateFilter - if set, only match memories with this state
   * @returns {{ col, row, entityId, state, lastSeen }|null}
   */
  findInMemory(goblin, type, stateFilter) {
    let best = null;
    let bestDist = Infinity;

    for (const entry of goblin.memory.values()) {
      if (entry.type !== type) continue;
      if (stateFilter && entry.state !== stateFilter) continue;

      const dist = Math.abs(entry.col - goblin.col) + Math.abs(entry.row - goblin.row);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    }

    return best;
  }

  /**
   * Verify a memory entry is still valid. Call when goblin arrives at a remembered location.
   * Returns the live entity if still valid, or null (and deletes stale memory).
   * @param {Goblin} goblin
   * @param {object} memEntry - memory entry from findInMemory
   * @returns {ResourceEntity|null}
   */
  verifyMemory(goblin, memEntry) {
    const entity = this.resources.getEntity(memEntry.entityId);

    if (!entity || !entity.alive) {
      goblin.memory.delete(memEntry.entityId);
      return null;
    }

    // Update memory with fresh state
    memEntry.state = entity.state;
    memEntry.col = entity.col;
    memEntry.row = entity.row;
    memEntry.lastSeen = goblin._tickCount;
    return entity;
  }

  // ── Path Following ──

  _moveAlongPath(goblin, delta) {
    const path = goblin.path;
    if (!path || goblin.pathIndex >= path.length) {
      goblin.path = null;
      goblin.pathIndex = 0;
      this._setAnimation(goblin, 'idle', goblin.carry);
      return;
    }

    const target = path[goblin.pathIndex];

    // Safety: abort if next waypoint is water (should never happen — A* bug)
    if (this.world.elevation[target.row][target.col] < ELEVATION.FLAT) {
      console.warn(`[Goblin #${goblin.id}] Path waypoint on water at (${target.col},${target.row})! Aborting path.`);
      goblin.path = null;
      goblin.pathIndex = 0;
      this._setAnimation(goblin, 'idle', goblin.carry);
      return;
    }

    const targetPx = target.col * TILE_SIZE + TILE_SIZE / 2;
    const targetPy = target.row * TILE_SIZE + TILE_SIZE;

    const dx = targetPx - goblin.px;
    const dy = targetPy - goblin.py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const speed = goblin.getEffectiveSpeed() * delta;

    if (dist <= speed) {
      // Arrived at waypoint
      goblin.px = targetPx;
      goblin.py = targetPy;

      const prevCol = goblin.col;
      const prevRow = goblin.row;
      goblin.col = target.col;
      goblin.row = target.row;
      goblin.pathIndex++;

      // Tile changed — reveal vision
      if (goblin.col !== prevCol || goblin.row !== prevRow) {
        this._onTileChanged(goblin);
      }

      // Check if path complete
      if (goblin.pathIndex >= path.length) {
        goblin.path = null;
        goblin.pathIndex = 0;
        this._setAnimation(goblin, 'idle', goblin.carry);
      }
    } else {
      // Move towards waypoint
      const nx = dx / dist;
      const ny = dy / dist;
      goblin.px += nx * speed;
      goblin.py += ny * speed;

      // Flip sprite based on direction
      if (Math.abs(dx) > 0.5) {
        goblin.sprite.scale.x = dx < 0 ? -1 : 1;
      }

      // Run animation
      this._setAnimation(goblin, 'run', goblin.carry);
    }

    // Update sprite position and z-index
    goblin.sprite.x = goblin.px;
    goblin.sprite.y = goblin.py;
    goblin.sprite.zIndex = goblin.py;

    // Update name label position
    if (goblin._nameLabel) {
      goblin._nameLabel.x = goblin.px;
      goblin._nameLabel.y = goblin.py + 4;
      goblin._nameLabel.zIndex = goblin.py + 1;
    }
  }

  _onTileChanged(goblin) {
    this._revealVision(goblin);
    this._scanResources(goblin);
  }

  // ── Decision System ──

  /**
   * Boltzmann weighted random selection. Higher scores are more likely,
   * but not guaranteed — adds personality and variety.
   */
  _decide(goblin, delta) {
    const ctx = this._makeActionContext(delta);
    const TEMPERATURE = 0.12;
    const scored = [];

    for (const action of this._actions) {
      // Skip actions on cooldown (pathfinding failures, etc.)
      if (goblin.isActionOnCooldown(action.name)) continue;

      let s = action.score(goblin, ctx);
      // Inertia: current action gets a small bonus to prevent oscillation
      if (goblin.currentAction === action) s += 0.04;
      // Variety: penalize repeating the same gather type
      if (goblin._gatherStreak >= 2 && action.name === `gather_${goblin._lastGatherType}`) {
        s *= 0.6;
      }
      if (s > 0.01) scored.push({ action, score: s });
    }

    if (scored.length === 0) return;

    // Boltzmann weighted random
    const weights = scored.map(e => Math.exp(e.score / TEMPERATURE));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = this.rng.next() * totalWeight;

    let picked = scored[0];
    for (let i = 0; i < scored.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { picked = scored[i]; break; }
    }

    if (picked.action !== goblin.currentAction) {
      const prev = goblin.currentAction?.name || 'none';
      goblin.currentAction = picked.action;
      goblin.actionTimer = 0;
      goblin._pathPending = false;

      // Track gather streaks
      const name = picked.action.name;
      if (name.startsWith('gather_')) {
        const type = name.replace('gather_', '');
        if (type === goblin._lastGatherType) {
          goblin._gatherStreak++;
        } else {
          goblin._lastGatherType = type;
          goblin._gatherStreak = 1;
        }
      } else if (name !== 'deposit') {
        goblin._gatherStreak = 0;
      }

      console.log(
        `[Goblin #${goblin.id}] ${prev} → ${name} (score: ${picked.score.toFixed(3)})` +
        ` | H:${goblin.drives.hunger.toFixed(2)} S:${goblin.drives.stamina.toFixed(2)} F:${goblin.drives.fatigue.toFixed(2)} C:${goblin.drives.curiosity.toFixed(2)}` +
        ` | Inv: M${goblin.inventory.meat} W${goblin.inventory.wood} G${goblin.inventory.gold}` +
        ` | Mem: ${goblin.memory.size}`
      );

    }
  }

  _makeActionContext(delta) {
    return {
      world: this.world,
      manager: this,
      resources: this.resources,
      pathfinder: this.pathfinder,
      rng: this.rng,
      camp: this.camp,
      dayNight: this.dayNight,
      delta,
    };
  }

  /** Find a walkable tile near (col,row) with no resources on it. */
  _findClearTile(col, row) {
    for (let radius = 1; radius < 10; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || c >= WORLD_COLS || r < 0 || r >= WORLD_ROWS) continue;
          if (this.world.elevation[r][c] < ELEVATION.FLAT) continue;
          if (this.resources.getResourceAt(c, r)) continue;
          return { col: c, row: r };
        }
      }
    }
    return { col, row }; // Fallback
  }

  /** Emergency: move goblin to nearest walkable tile. */
  _relocateToLand(goblin) {
    goblin.path = null;
    goblin.pathIndex = 0;

    // BFS outward from current position to find nearest land tile
    for (let radius = 1; radius < 20; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const c = goblin.col + dc;
          const r = goblin.row + dr;
          if (c < 0 || c >= WORLD_COLS || r < 0 || r >= WORLD_ROWS) continue;
          if (this.world.elevation[r][c] >= ELEVATION.FLAT) {
            goblin.col = c;
            goblin.row = r;
            goblin.px = c * TILE_SIZE + TILE_SIZE / 2;
            goblin.py = r * TILE_SIZE + TILE_SIZE;
            goblin.sprite.x = goblin.px;
            goblin.sprite.y = goblin.py;
            goblin.sprite.zIndex = goblin.py;
            this._revealVision(goblin);
            return;
          }
        }
      }
    }
  }

  // ── Drives ──

  _tickDrives(goblin, delta) {
    const t = goblin.traits;
    const d = goblin.drives;
    const action = goblin.currentAction?.name;

    // Day/night multipliers
    const dnHungerMult = this.dayNight ? this.dayNight.getHungerMultiplier() : 1.0;
    const dnFatigueMult = this.dayNight ? this.dayNight.getFatigueMultiplier() : 1.0;

    // ── Hunger ──
    let hungerMult = 1.0;
    if (goblin.path) hungerMult = 1.5;
    if (action === 'gather_wood' || action === 'gather_gold' || action === 'hunt') hungerMult = 2.0;
    if (action === 'rest' || action === 'sleep') hungerMult = 0.5;
    d.hunger = Math.max(0, d.hunger - t.metabolism * hungerMult * dnHungerMult * delta);

    // Cross-drive: high fatigue accelerates hunger
    if (d.fatigue > 0.5) {
      d.hunger = Math.max(0, d.hunger - t.metabolism * 0.5 * delta);
    }

    // ── Stamina (short-term, recovers anywhere when idle/stationary) ──
    const maxStamina = goblin.getEffectiveMaxStamina();
    const isStationary = !goblin.path;
    const ageStaminaMult = goblin.getAgeMultiplier('stamina_regen');
    if (isStationary && (action === 'rest' || action === 'sleep' || action === 'idle' || !action)) {
      d.stamina = Math.min(maxStamina, d.stamina + t.stamina_regen * ageStaminaMult * delta);
    } else if (goblin.path) {
      d.stamina = Math.max(0, d.stamina - t.stamina_sprint_drain * delta);
    } else if (action === 'gather_wood' || action === 'gather_gold' || action === 'hunt') {
      d.stamina = Math.max(0, d.stamina - t.stamina_labor_drain * delta);
    } else {
      d.stamina = Math.max(0, d.stamina - t.stamina_decay * delta);
    }
    if (d.stamina > maxStamina) d.stamina = maxStamina;

    // ── Fatigue (long-term, only recovers during sleep AT camp, not while walking there) ──
    if (action === 'sleep' && isStationary) {
      d.fatigue = Math.max(0, d.fatigue - t.fatigue_sleep_rate * delta);
    } else if (action !== 'rest' && action !== 'idle' && action) {
      d.fatigue = Math.min(1, d.fatigue + t.fatigue_rise * dnFatigueMult * delta);
    }
    if (goblin.path) {
      d.fatigue = Math.min(1, d.fatigue + t.fatigue_rise * 0.5 * dnFatigueMult * delta);
    }

    // ── Curiosity (age affects rise rate, suppressed by hunger) ──
    const ageCuriosityMult = goblin.getAgeMultiplier('curiosity');
    if (d.hunger < 0.3) {
      // Starving goblins lose curiosity — survival focus overrides wanderlust
      d.curiosity = Math.max(0.05, d.curiosity - t.curiosity_rise * 2.0 * delta);
    } else if (!action || action === 'idle') {
      d.curiosity = Math.min(1, d.curiosity + t.curiosity_rise * ageCuriosityMult * delta);
    } else if (action === 'rest' || action === 'sleep') {
      d.curiosity = Math.min(1, d.curiosity + t.curiosity_rise * ageCuriosityMult * 0.7 * delta);
    } else {
      d.curiosity = Math.max(0.05, d.curiosity - t.curiosity_rise * 0.3 * delta);
    }
  }

  // ── Viewport Culling ──

  _updateVisibility(viewBounds) {
    if (!viewBounds) return;
    const margin = 256;
    const left = viewBounds.x - margin;
    const right = viewBounds.x + viewBounds.width + margin;
    const top = viewBounds.y - margin;
    const bottom = viewBounds.y + viewBounds.height + margin;

    for (const goblin of this._goblins.values()) {
      if (goblin.sprite) {
        const vis = goblin.px > left && goblin.px < right &&
                    goblin.py > top && goblin.py < bottom;
        goblin.sprite.visible = vis;
        if (goblin._nameLabel) goblin._nameLabel.visible = vis;
      }
    }
  }

  // ── Memory Sharing ──

  _tickMemorySharing() {
    const gobs = [...this._goblins.values()].filter(g => g.alive);
    for (let i = 0; i < gobs.length; i++) {
      for (let j = i + 1; j < gobs.length; j++) {
        const a = gobs[i], b = gobs[j];
        const dist = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
        if (dist > 2) continue;

        let shared = 0;
        for (const [key, entry] of a.memory) {
          if (!b.memory.has(key)) { b.memory.set(key, { ...entry }); shared++; }
        }
        for (const [key, entry] of b.memory) {
          if (!a.memory.has(key)) { a.memory.set(key, { ...entry }); shared++; }
        }
        if (shared > 0 && this.narrator) {
          this.narrator.log(`${a.firstName} shared knowledge with ${b.firstName}`, 0xaaddff);
        }
      }
    }
  }
}
