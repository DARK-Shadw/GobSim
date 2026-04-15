import { TILE_SIZE, WORLD_COLS, WORLD_ROWS, GOBLIN_DEFAULTS, AGE, SKILLS } from '@shared/constants.js';
import { getGoblinName, FAMILY_COLORS } from '@/utils/GoblinNames.js';

/**
 * Core goblin entity. Holds all state — genome, traits, drives, skills,
 * age, lineage, inventory, memory, fog-of-war, action state.
 * Behavior is driven externally by GoblinManager and Action objects.
 */
export class Goblin {
  constructor(id, col, row, genome) {
    this.id = id;
    this.col = col;
    this.row = row;
    this.px = col * TILE_SIZE + TILE_SIZE / 2;
    this.py = row * TILE_SIZE + TILE_SIZE;
    this.alive = true;

    // ── Identity (set fully by GoblinManager after construction) ──
    this.firstName = getGoblinName(id);
    this.familyName = '';
    this.name = this.firstName;
    this.familyIndex = 0;

    // ── Lineage ──
    this.lineage = { parentIds: [], familyName: '', generation: 0 };

    // ── Genome (DNA) ──
    this.genome = genome;

    // ── Traits (derived from GOBLIN_DEFAULTS × genome) ──
    this.traits = {
      speed:              GOBLIN_DEFAULTS.SPEED * genome.speed,
      sense_range:        Math.round(GOBLIN_DEFAULTS.SENSE_RANGE * genome.sense_range),
      metabolism:          GOBLIN_DEFAULTS.METABOLISM * genome.metabolism,
      curiosity_rise:     GOBLIN_DEFAULTS.CURIOSITY_RISE * genome.curiosity,
      gather_time:        GOBLIN_DEFAULTS.GATHER_TIME * genome.gather_time,
      eat_time:           GOBLIN_DEFAULTS.EAT_TIME,
      carry_capacity:     Math.max(1, Math.round(GOBLIN_DEFAULTS.CARRY_CAPACITY * genome.carry_capacity)),
      stamina_decay:      GOBLIN_DEFAULTS.STAMINA_DECAY,
      stamina_sprint_drain: GOBLIN_DEFAULTS.STAMINA_SPRINT_DRAIN,
      stamina_labor_drain:  GOBLIN_DEFAULTS.STAMINA_LABOR_DRAIN,
      stamina_regen:      GOBLIN_DEFAULTS.STAMINA_REGEN * genome.stamina_pool,
      fatigue_rise:       GOBLIN_DEFAULTS.FATIGUE_RISE * (2.0 - genome.fatigue_resist),
      fatigue_sleep_rate: GOBLIN_DEFAULTS.FATIGUE_SLEEP_RATE,
    };

    // ── Age ──
    this.age = 0;            // ticks
    this.ageYears = 0;       // computed from age / TICKS_PER_YEAR
    this.ageStage = 'youth'; // 'youth', 'prime', 'elder'

    // ── Skills ──
    this.skills = { woodcutting: 0, mining: 0, foraging: 0, hunting: 0 };

    // ── Drives ──
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
    this._nameLabel = null;

    // ── Internal Counters ──
    this._decisionCooldown = 0;
    this._tickCount = 0;
    this._lastGatherType = null;
    this._gatherStreak = 0;

    // ── Action Cooldowns (prevents tight pathfinding failure loops) ──
    this._actionCooldowns = new Map(); // actionName → tick when cooldown expires

    // ── Survival ──
    this._starvationTimer = 0;
  }

  // ── Age ──

  updateAge(delta) {
    this.age += delta;
    this.ageYears = this.age / AGE.TICKS_PER_YEAR;
    if (this.ageYears < AGE.YOUTH_END) {
      this.ageStage = 'youth';
    } else if (this.ageYears < AGE.PRIME_END) {
      this.ageStage = 'prime';
    } else {
      this.ageStage = 'elder';
    }
  }

  getAgeMultiplier(stat) {
    if (this.ageStage === 'youth') {
      if (stat === 'speed') return AGE.YOUTH_SPEED;
      if (stat === 'gather') return AGE.YOUTH_GATHER;
      if (stat === 'curiosity') return AGE.YOUTH_CURIOSITY;
    } else if (this.ageStage === 'elder') {
      if (stat === 'speed') return AGE.ELDER_SPEED;
      if (stat === 'gather') return AGE.ELDER_GATHER;
      if (stat === 'stamina_regen') return AGE.ELDER_STAMINA_REGEN;
    }
    return 1.0;
  }

  // ── Skills ──

  getSkillLevel(type) {
    const xp = this.skills[type] || 0;
    const thresholds = SKILLS.XP_THRESHOLDS;
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) {
      if (xp >= thresholds[i]) level = i + 1;
    }
    return level;
  }

  getSkillGatherMult(type) {
    const level = this.getSkillLevel(type);
    return SKILLS.GATHER_MULT[level - 1];
  }

  /**
   * Add XP to a skill. Returns new level number if leveled up, else null.
   */
  addSkillXP(type, amount = 1) {
    const prevLevel = this.getSkillLevel(type);
    this.skills[type] = (this.skills[type] || 0) + amount;
    const newLevel = this.getSkillLevel(type);
    return newLevel > prevLevel ? newLevel : null;
  }

  // ── Drive Queries ──

  getHungerUrgency() { return 1.0 - this.drives.hunger; }
  getStaminaUrgency() { return 1.0 - this.drives.stamina; }
  getFatigueUrgency() { return this.drives.fatigue; }
  getCuriosityUrgency() { return this.drives.curiosity; }

  // ── Effective Stats (genome × age × fatigue × skill) ──

  getEffectiveMaxStamina() {
    return 1.0 - this.drives.fatigue * GOBLIN_DEFAULTS.FATIGUE_MAX_STAMINA_PENALTY;
  }

  getEffectiveSpeed() {
    const fatigueMult = 1.0 - this.drives.fatigue * GOBLIN_DEFAULTS.FATIGUE_SPEED_PENALTY;
    const staminaMult = this.drives.stamina < GOBLIN_DEFAULTS.STAMINA_LOW_THRESHOLD ? 0.6 : 1.0;
    const ageMult = this.getAgeMultiplier('speed');
    return this.traits.speed * fatigueMult * staminaMult * ageMult;
  }

  getEffectiveGatherTime(skillType) {
    const ageMult = this.getAgeMultiplier('gather');
    const skillMult = skillType ? this.getSkillGatherMult(skillType) : 1.0;
    return this.traits.gather_time
      * (1.0 + this.drives.fatigue * GOBLIN_DEFAULTS.FATIGUE_GATHER_PENALTY)
      * ageMult
      * skillMult;
  }

  getInventoryTotal() {
    return this.inventory.meat + this.inventory.wood + this.inventory.gold;
  }

  getDriveTint() {
    if (this._starvationTimer > 0) return 0xcc0000;
    if (this.drives.hunger < 0.15) return 0xff6666;
    if (this.drives.fatigue > 0.8) return 0x8888aa;
    if (this.drives.stamina < 0.15) return 0x8888ff;
    return FAMILY_COLORS[this.familyIndex % FAMILY_COLORS.length];
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

  // ── Action Cooldowns ──

  isActionOnCooldown(name) {
    const until = this._actionCooldowns.get(name);
    return until !== undefined && this._tickCount < until;
  }

  setActionCooldown(name, ticks = 90) {
    this._actionCooldowns.set(name, this._tickCount + ticks);
  }

  destroy() {
    this.alive = false;
    if (this.sprite) {
      if (this.sprite.parent) this.sprite.parent.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    if (this._nameLabel) {
      if (this._nameLabel.parent) this._nameLabel.parent.removeChild(this._nameLabel);
      this._nameLabel.destroy();
      this._nameLabel = null;
    }
  }
}
