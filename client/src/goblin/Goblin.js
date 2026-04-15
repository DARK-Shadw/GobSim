import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, GOBLIN_DEFAULTS } from '@shared/constants.js';
import { getGoblinName } from '@/utils/GoblinNames.js';

/**
 * Core goblin entity. Holds all state — traits, drives, inventory, memory, fog-of-war, action state.
 * Behavior is driven externally by GoblinManager and Action objects.
 */
export class Goblin {
  constructor(id, col, row) {
    this.id = id;
    this.name = getGoblinName(id);
    this.col = col;
    this.row = row;
    this.px = col * TILE_SIZE + TILE_SIZE / 2;
    this.py = row * TILE_SIZE + TILE_SIZE;
    this.alive = true;

    // ── Traits (Phase 3: genome floats) ──
    this.traits = {
      speed:            GOBLIN_DEFAULTS.SPEED,
      sense_range:      GOBLIN_DEFAULTS.SENSE_RANGE,
      metabolism:        GOBLIN_DEFAULTS.METABOLISM,
      curiosity_rise:   GOBLIN_DEFAULTS.CURIOSITY_RISE,
      gather_time:      GOBLIN_DEFAULTS.GATHER_TIME,
      eat_time:         GOBLIN_DEFAULTS.EAT_TIME,
      carry_capacity:   GOBLIN_DEFAULTS.CARRY_CAPACITY,
      stamina_decay:    GOBLIN_DEFAULTS.STAMINA_DECAY,
      stamina_sprint_drain: GOBLIN_DEFAULTS.STAMINA_SPRINT_DRAIN,
      stamina_labor_drain:  GOBLIN_DEFAULTS.STAMINA_LABOR_DRAIN,
      stamina_regen:    GOBLIN_DEFAULTS.STAMINA_REGEN,
      fatigue_rise:     GOBLIN_DEFAULTS.FATIGUE_RISE,
      fatigue_sleep_rate: GOBLIN_DEFAULTS.FATIGUE_SLEEP_RATE,
    };

    // ── Drives ──
    // hunger/stamina: 1 = full, 0 = empty
    // fatigue: 0 = rested, 1 = exhausted
    // curiosity: 0 = content, 1 = bored
    this.drives = {
      hunger: 1.0,
      stamina: 1.0,
      fatigue: 0.0,
      curiosity: 0.4,
    };

    // ── Inventory ──
    this.inventory = { meat: 0, wood: 0, gold: 0 };

    // ── Spatial Memory: Map<entityId → MemoryEntry> ──
    this.memory = new Map();

    // ── Fog of War: 0 = unexplored, 1 = explored ──
    this.explored = new Uint8Array(WORLD_COLS * WORLD_ROWS);

    // ── Action State ──
    this.currentAction = null;
    this.actionTimer = 0;
    this.path = null;
    this.pathIndex = 0;
    this._pathPending = false;

    // ── Sprite State ──
    this.sprite = null;
    this._currentAnim = null;
    this.carry = 'none';

    // ── Internal Counters ──
    this._decisionCooldown = 0;
    this._tickCount = 0;
    this._lastGatherType = null;
    this._gatherStreak = 0;

    // ── Survival ──
    this._starvationTimer = 0;
  }

  getHungerUrgency() { return 1.0 - this.drives.hunger; }
  getStaminaUrgency() { return 1.0 - this.drives.stamina; }
  getFatigueUrgency() { return this.drives.fatigue; }
  getCuriosityUrgency() { return this.drives.curiosity; }

  getEffectiveMaxStamina() {
    return 1.0 - this.drives.fatigue * GOBLIN_DEFAULTS.FATIGUE_MAX_STAMINA_PENALTY;
  }

  getEffectiveSpeed() {
    const fatigueMult = 1.0 - this.drives.fatigue * GOBLIN_DEFAULTS.FATIGUE_SPEED_PENALTY;
    const staminaMult = this.drives.stamina < GOBLIN_DEFAULTS.STAMINA_LOW_THRESHOLD ? 0.6 : 1.0;
    return this.traits.speed * fatigueMult * staminaMult;
  }

  getEffectiveGatherTime() {
    return this.traits.gather_time * (1.0 + this.drives.fatigue * GOBLIN_DEFAULTS.FATIGUE_GATHER_PENALTY);
  }

  getInventoryTotal() {
    return this.inventory.meat + this.inventory.wood + this.inventory.gold;
  }

  getDriveTint() {
    if (this._starvationTimer > 0) return 0xcc0000;
    if (this.drives.hunger < 0.15) return 0xff6666;
    if (this.drives.fatigue > 0.8) return 0x8888aa;
    if (this.drives.stamina < 0.15) return 0x8888ff;
    return 0xffffff;
  }

  checkDeath() {
    if (this.drives.hunger <= 0) {
      this._starvationTimer++;
      if (this._starvationTimer >= 300) return 'starvation';
    } else {
      this._starvationTimer = 0;
    }
    return null;
  }

  destroy() {
    this.alive = false;
    if (this.sprite) {
      if (this.sprite.parent) this.sprite.parent.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
