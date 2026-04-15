import { Container, Sprite, AnimatedSprite } from 'pixi.js';
import { tileAtlas } from './TileAtlas.js';
import { SeededRandom } from '@/utils/SeededRandom.js';
import { TILE_SIZE, ANIM_SPEED } from '@shared/constants.js';

// Types now managed by ResourceManager (filtered out below)
const MANAGED_TYPES = new Set(['bush', 'tree', 'gold', 'sheep']);

// Sprite sheet frame dimensions (decorations only)
const FRAME_INFO = {
  water_rock1: { w: 64, h: 64, count: 16 },
  water_rock2: { w: 64, h: 64, count: 16 },
  water_rock3: { w: 64, h: 64, count: 16 },
  water_rock4: { w: 64, h: 64, count: 16 },
  rubber_duck: { w: 32, h: 32, count: 3 },
};

/**
 * Places all decoration and resource sprites in the world.
 * Sorted by Y for correct depth. Viewport culling on animated sprites.
 */
export class DecorationPlacer {
  constructor(app, world) {
    this.container = new Container({ label: 'decorations', sortableChildren: true });
    this.animatedSprites = [];
    this._frameCache = {};

    const rng = new SeededRandom(world.seed + 777);
    const textures = app.textures;

    // Combine decorations and resources, filter out types managed by ResourceManager
    const allItems = [
      ...world.decorations.map(d => ({ ...d, category: 'decor' })),
      ...world.resources.map(r => ({ ...r, category: 'resource' })),
    ].filter(item => !MANAGED_TYPES.has(item.type));
    allItems.sort((a, b) => a.row - b.row || a.col - b.col);

    for (const item of allItems) {
      const sprite = this._createSprite(item, textures, rng);
      if (!sprite) continue;

      sprite.zIndex = sprite.y;
      this.container.addChild(sprite);
    }

    // Add decoration container above tilemap layers in world
    app.worldContainer.addChild(this.container);

    console.log(`[Decorations] ${this.container.children.length} sprites (${this.animatedSprites.length} animated)`);
  }

  _getFrames(textures, key) {
    if (this._frameCache[key]) return this._frameCache[key];
    const info = FRAME_INFO[key];
    if (!info || !textures[key]) return null;
    const frames = tileAtlas.extractFrames(textures[key], info.w, info.h, info.count);
    this._frameCache[key] = frames;
    return frames;
  }

  _createSprite(item, textures, rng) {
    const { type, col, row, variant } = item;

    switch (type) {
      case 'rock': {
        const key = `rock${variant}`;
        if (!textures[key]) return null;
        const sprite = new Sprite(textures[key]);
        sprite.anchor.set(0.5, 0.5);
        sprite.x = col * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = row * TILE_SIZE + TILE_SIZE / 2;
        return sprite;
      }

      case 'water_rock': {
        const key = `water_rock${variant}`;
        const frames = this._getFrames(textures, key);
        if (!frames) return null;
        const info = FRAME_INFO[key];
        const sprite = new AnimatedSprite(frames);
        sprite.animationSpeed = ANIM_SPEED.WATER_ROCK;
        sprite.gotoAndPlay(rng.nextInt(0, info.count));
        sprite.anchor.set(0.5, 0.5);
        sprite.x = col * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = row * TILE_SIZE + TILE_SIZE / 2;
        this.animatedSprites.push(sprite);
        return sprite;
      }

      case 'duck': {
        const frames = this._getFrames(textures, 'rubber_duck');
        if (!frames) return null;
        const sprite = new AnimatedSprite(frames);
        sprite.animationSpeed = ANIM_SPEED.DUCK;
        sprite.gotoAndPlay(rng.nextInt(0, 3));
        sprite.anchor.set(0.5, 0.5);
        sprite.x = col * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = row * TILE_SIZE + TILE_SIZE / 2;
        this.animatedSprites.push(sprite);
        return sprite;
      }

      default:
        return null;
    }
  }

  /**
   * Toggle visibility of animated sprites based on camera viewport.
   */
  updateVisibility(viewBounds) {
    const margin = 256; // Largest sprite is 192×256
    const left = viewBounds.x - margin;
    const right = viewBounds.x + viewBounds.width + margin;
    const top = viewBounds.y - margin;
    const bottom = viewBounds.y + viewBounds.height + margin;

    for (const sprite of this.animatedSprites) {
      sprite.visible = (
        sprite.x > left && sprite.x < right &&
        sprite.y > top && sprite.y < bottom
      );
    }
  }
}
