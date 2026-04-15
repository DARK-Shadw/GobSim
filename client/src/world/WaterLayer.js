import { Container, AnimatedSprite } from 'pixi.js';
import { tileAtlas } from './TileAtlas.js';
import { SeededRandom } from '@/utils/SeededRandom.js';
import { TILE_SIZE, ANIM_SPEED } from '@shared/constants.js';

const FOAM_W = 192;
const FOAM_H = 192;
const FOAM_FRAMES = 16;

/**
 * Animated water foam at every coastline tile.
 * Each foam sprite is 192×192 centered on a 64×64 tile grid cell.
 * Start frames are staggered for natural look.
 */
export class WaterLayer {
  constructor(app, world) {
    this.container = new Container({ label: 'water-foam' });
    this.foamSprites = [];

    const foamTextures = tileAtlas.extractFrames(
      app.textures.water_foam, FOAM_W, FOAM_H, FOAM_FRAMES
    );

    const rng = new SeededRandom(world.seed + 999);

    for (const cell of world.coastline) {
      const foam = new AnimatedSprite(foamTextures);
      foam.animationSpeed = ANIM_SPEED.FOAM;
      foam.gotoAndPlay(rng.nextInt(0, FOAM_FRAMES));

      // Center the 192×192 foam on the 64×64 tile
      foam.x = cell.col * TILE_SIZE - (FOAM_W - TILE_SIZE) / 2;
      foam.y = cell.row * TILE_SIZE - (FOAM_H - TILE_SIZE) / 2;

      this.container.addChild(foam);
      this.foamSprites.push(foam);
    }

    // Insert foam layer between water background and flat ground
    // In the world container, foam should be below flat ground
    const worldContainer = app.worldContainer;
    if (worldContainer.children.length > 0) {
      worldContainer.addChildAt(this.container, 0);
    } else {
      worldContainer.addChild(this.container);
    }

    console.log(`[WaterLayer] ${this.foamSprites.length} foam sprites`);
  }

  /**
   * Toggle visibility of foam sprites based on camera viewport.
   * Call every frame for performance.
   */
  updateVisibility(viewBounds) {
    const margin = FOAM_W; // Extra margin for large foam sprites
    const left = viewBounds.x - margin;
    const right = viewBounds.x + viewBounds.width + margin;
    const top = viewBounds.y - margin;
    const bottom = viewBounds.y + viewBounds.height + margin;

    for (const foam of this.foamSprites) {
      foam.visible = (
        foam.x + FOAM_W > left &&
        foam.x < right &&
        foam.y + FOAM_H > top &&
        foam.y < bottom
      );
    }
  }
}
