export const TILE_SIZE = 64;
export const WORLD_COLS = 150;
export const WORLD_ROWS = 120;

export const WATER_BG_COLOR = 0x629b9e;

// Elevation levels
export const ELEVATION = {
  WATER: 0,
  FLAT: 1,
  ELEVATED: 2,
};

// Camera
export const CAMERA_MIN_ZOOM = 0.25;
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_EASE = 0.1;
export const CAMERA_DEFAULT_ZOOM = 0.5;

// Animation speeds (frames per tick)
export const ANIM_SPEED = {
  FOAM: 0.15,
  TREE: 0.08,
  BUSH: 0.08,
  SHEEP: 0.1,
  SHEEP_WALK: 0.12,
  SHEEP_GRAZE: 0.08,
  WATER_ROCK: 0.12,
  DUCK: 0.1,
  DUST: 0.25,
  EXPLOSION: 0.2,
};

// Resource system configuration
export const RESOURCE = {
  // Sheep behavior
  SHEEP_IDLE_MIN: 120,         // ticks (~2s at 60fps)
  SHEEP_IDLE_MAX: 240,         // ticks (~4s)
  SHEEP_GRAZE_MIN: 180,        // ticks (~3s)
  SHEEP_GRAZE_MAX: 300,        // ticks (~5s)
  SHEEP_WANDER_RADIUS: 8,      // tiles from home
  SHEEP_FLEE_RADIUS: 3,        // tiles — trigger distance
  SHEEP_FLEE_DISTANCE: 5,      // tiles — run distance
  SHEEP_SPEED: 0.8,            // pixels per tick (at delta=1)
  SHEEP_FLEE_SPEED: 1.6,       // pixels per tick (at delta=1)
  SHEEP_REPRO_THRESHOLD: 0.6,  // reproduce when count < 60% of initial
  SHEEP_REPRO_CHANCE: 0.0005,  // per-tick chance when conditions met
  SHEEP_REPRO_CHECK_INTERVAL: 60, // only check every N ticks

  // Bush (berry) regrowth
  BUSH_REGROW_TICKS: 3600,     // ~60s depleted → regrowing
  BUSH_REGROW2_TICKS: 1800,    // ~30s regrowing → full

  // Tree lifecycle
  TREE_STUMP_TICKS: 1800,      // ~30s stump → sapling
  TREE_SAPLING_TICKS: 3600,    // ~60s sapling → grown

  // Gold
  GOLD_RESPAWN: false,         // non-renewable

  // Dropped resources
  DROP_DESPAWN_TICKS: 18000,   // ~5 minutes
  DROP_FADE_TICKS: 60,         // ~1s fade out
};

// Goblin animation speeds
export const GOBLIN_ANIM = {
  IDLE: 0.1,
  RUN: 0.15,
  INTERACT: 0.12,
};

// Goblin sprite frame info
export const GOBLIN_FRAME = {
  W: 192,
  H: 192,
  IDLE_COUNT: 8,
  RUN_COUNT: 6,
  INTERACT_AXE_COUNT: 6,
  INTERACT_HAMMER_COUNT: 3,
  INTERACT_KNIFE_COUNT: 4,
  INTERACT_PICKAXE_COUNT: 6,
};

// Fire sprite info
export const FIRE_FRAME = {
  W: 64,
  H: 64,
  COUNT: 10,
};

// Goblin default traits (Phase 3: genome floats)
export const GOBLIN_DEFAULTS = {
  SPEED: 1.2,
  SENSE_RANGE: 4,
  METABOLISM: 0.00012,
  CURIOSITY_RISE: 0.0001,
  GATHER_TIME: 120,
  EAT_TIME: 90,
  CARRY_CAPACITY: 3,

  // Stamina (short-term energy, recovers anywhere)
  STAMINA_DECAY: 0.0001,            // idle drain (barely noticeable)
  STAMINA_SPRINT_DRAIN: 0.0003,     // walking drain (halved — walking shouldn't exhaust)
  STAMINA_LABOR_DRAIN: 0.0006,      // chopping/mining drain (real work is tiring)
  STAMINA_REGEN: 0.003,             // recover faster when resting (less time wasted)
  STAMINA_LOW_THRESHOLD: 0.2,

  // Fatigue (long-term, only recovers during camp sleep)
  FATIGUE_RISE: 0.00004,            // slower buildup — more productive time before sleep needed
  FATIGUE_SLEEP_RATE: 0.002,        // recover faster during sleep (less boring to watch)
  FATIGUE_MAX_STAMINA_PENALTY: 0.5,
  FATIGUE_SPEED_PENALTY: 0.4,
  FATIGUE_GATHER_PENALTY: 0.5,
  FATIGUE_SLEEP_THRESHOLD: 0.4,
};

// Genome (DNA) system — per-goblin trait multipliers
export const GENOME = {
  KEYS: ['speed', 'metabolism', 'sense_range', 'carry_capacity',
         'gather_time', 'stamina_pool', 'fatigue_resist', 'curiosity'],
  MIN: 0.7,
  MAX: 1.3,
};

// Age system
export const AGE = {
  TICKS_PER_YEAR: 10800,    // 1 year = 1 day/night cycle (~3 min)
  YOUTH_END: 2,              // years 0-2: youth
  PRIME_END: 8,              // years 2-8: prime (8+: elder)
  YOUTH_SPEED: 0.8,
  YOUTH_GATHER: 0.8,
  YOUTH_CURIOSITY: 1.2,
  ELDER_SPEED: 0.75,
  ELDER_GATHER: 0.85,        // experience compensates
  ELDER_STAMINA_REGEN: 0.8,
};

// Skill leveling
export const SKILLS = {
  XP_THRESHOLDS: [0, 5, 15, 30, 50],       // Level 1-5
  GATHER_MULT: [1.0, 0.9, 0.8, 0.7, 0.6],  // faster at higher levels
  TYPES: ['woodcutting', 'mining', 'foraging', 'hunting'],
  LEVEL_NAMES: ['I', 'II', 'III', 'IV', 'V'],
};

// Relationship system
export const RELATIONSHIP = {
  UPDATE_INTERVAL: 60,           // ticks between relationship updates (~1s)
  PROXIMITY_RANGE: 3,            // Manhattan tiles for proximity bonding

  // Familiarity rates (per update tick)
  FAMILIARITY_RATE: 0.002,
  FAMILIARITY_DECAY: 0.0002,

  // Opinion deltas (per event)
  MEMORY_SHARE_OPINION: 0.02,
  MEMORY_SHARE_TRUST: 0.015,
  RESOURCE_STOLEN_OPINION: -0.08,
  DEPOSIT_OBSERVED_OPINION: 0.01,
  FOOD_SHARED_OPINION: 0.12,
  FOOD_SHARED_TRUST: 0.08,

  // Family bonus (initial values for same-family goblins)
  SAME_FAMILY_BASE_OPINION: 0.3,
  SAME_FAMILY_BASE_TRUST: 0.2,

  // Tag thresholds
  FRIEND_THRESHOLD: 0.5,
  RIVAL_THRESHOLD: -0.4,
  MENTOR_MIN_AGE_DIFF: 3,       // years
  MENTOR_FAMILIARITY: 0.4,

  // Action scoring modifiers
  FRIEND_PROXIMITY_BONUS: 0.03,
  RIVAL_RESOURCE_PENALTY: 0.15,

  // Food sharing gates
  FOOD_SHARE_TRUST_THRESHOLD: 0.6,
  FOOD_SHARE_HUNGER_THRESHOLD: 0.15,
  FOOD_SHARE_DONOR_MIN_HUNGER: 0.5,
  FOOD_SHARE_COOLDOWN: 300,

  // Clamps
  OPINION_MIN: -1.0, OPINION_MAX: 1.0,
  TRUST_MIN: 0.0,   TRUST_MAX: 1.0,

  // Future phase hooks
  CONFRONTATION_THRESHOLD: -0.7, // Phase 8: triggers fight
};

// Founding colony
export const FOUNDING_GOBLINS = 4;

// A* pathfinding
export const PATHFINDING = {
  MAX_PER_FRAME: 5,
  MAX_OPEN_SET: 4000,
  REPATH_INTERVAL: 120,
};

// Day/Night cycle
export const DAY_NIGHT = {
  CYCLE_TICKS: 10800,          // ~3 minutes per full day at 60fps
  DAWN_START: 0.0,
  DAY_START: 0.15,
  DUSK_START: 0.6,
  NIGHT_START: 0.75,

  NIGHT_VISION_MULT: 0.5,
  NIGHT_FATIGUE_MULT: 2.0,
  NIGHT_HUNGER_MULT: 1.3,

  TINT_DAWN:  0xffd4a0,
  TINT_DAY:   0xffffff,
  TINT_DUSK:  0xd4a0ff,
  TINT_NIGHT: 0x4466aa,
};

// World generation
export const NOISE_FREQ = 4;
export const NOISE_OCTAVES = 3;
export const FLAT_THRESHOLD = -0.05;
export const ELEVATED_THRESHOLD = 0.35;

// Asset base path (relative to public/Assets)
export const ASSET_BASE = 'Tiny Swords (Free Pack)/Tiny Swords (Free Pack)';
