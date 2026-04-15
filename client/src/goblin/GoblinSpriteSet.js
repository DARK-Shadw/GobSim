import { tileAtlas } from '@/world/TileAtlas.js';
import { GOBLIN_FRAME } from '@shared/constants.js';

const { W, H, IDLE_COUNT, RUN_COUNT,
  INTERACT_AXE_COUNT, INTERACT_HAMMER_COUNT,
  INTERACT_KNIFE_COUNT, INTERACT_PICKAXE_COUNT } = GOBLIN_FRAME;

const CARRY_VARIANTS = ['none', 'axe', 'gold', 'hammer', 'knife', 'meat', 'pickaxe', 'wood'];

const INTERACT_COUNTS = {
  axe: INTERACT_AXE_COUNT,
  hammer: INTERACT_HAMMER_COUNT,
  knife: INTERACT_KNIFE_COUNT,
  pickaxe: INTERACT_PICKAXE_COUNT,
};

/**
 * Extracts and caches all goblin animation frames from loaded textures.
 * Provides getFrames(action, carry) → Texture[] for animation swapping.
 */
export class GoblinSpriteSet {
  constructor(textures) {
    this._frames = {
      idle: {},
      run: {},
      interact: {},
    };

    // Idle variants (8 frames each)
    for (const carry of CARRY_VARIANTS) {
      const key = carry === 'none' ? 'goblin_idle' : `goblin_idle_${carry}`;
      if (textures[key]) {
        this._frames.idle[carry] = tileAtlas.extractFrames(textures[key], W, H, IDLE_COUNT);
      }
    }

    // Run variants (6 frames each)
    for (const carry of CARRY_VARIANTS) {
      const key = carry === 'none' ? 'goblin_run' : `goblin_run_${carry}`;
      if (textures[key]) {
        this._frames.run[carry] = tileAtlas.extractFrames(textures[key], W, H, RUN_COUNT);
      }
    }

    // Interact variants (variable frame counts)
    for (const [tool, count] of Object.entries(INTERACT_COUNTS)) {
      const key = `goblin_interact_${tool}`;
      if (textures[key]) {
        this._frames.interact[tool] = tileAtlas.extractFrames(textures[key], W, H, count);
      }
    }
  }

  /**
   * @param {'idle'|'run'|'interact'} action
   * @param {string} carry - 'none', 'axe', 'wood', etc.
   * @returns {Texture[]}
   */
  getFrames(action, carry) {
    const actionFrames = this._frames[action];
    if (!actionFrames) return this._frames.idle.none;
    return actionFrames[carry] || actionFrames.none || this._frames.idle.none;
  }
}
