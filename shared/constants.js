export const TILE_SIZE = 64;
export const WORLD_COLS = 100;
export const WORLD_ROWS = 80;

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
  BUSH_REGROW_TICKS: 600,      // ~10s depleted → regrowing
  BUSH_REGROW2_TICKS: 300,     // ~5s regrowing → full

  // Tree lifecycle
  TREE_STUMP_TICKS: 1800,      // ~30s stump → sapling
  TREE_SAPLING_TICKS: 3600,    // ~60s sapling → grown

  // Gold
  GOLD_RESPAWN: false,         // non-renewable

  // Dropped resources
  DROP_DESPAWN_TICKS: 18000,   // ~5 minutes
  DROP_FADE_TICKS: 60,         // ~1s fade out
};

// World generation
export const NOISE_FREQ = 4;
export const NOISE_OCTAVES = 3;
export const FLAT_THRESHOLD = -0.05;
export const ELEVATED_THRESHOLD = 0.35;

// Asset base path (relative to public/Assets)
export const ASSET_BASE = 'Tiny Swords (Free Pack)/Tiny Swords (Free Pack)';
