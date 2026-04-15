import { Container, Sprite } from 'pixi.js';
import { SeededRandom } from '@/utils/SeededRandom.js';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS } from '@shared/constants.js';

const WORLD_W = WORLD_COLS * TILE_SIZE;
const WORLD_H = WORLD_ROWS * TILE_SIZE;
const CLOUD_COUNT = 10;
const CLOUD_W = 576;
const CLOUD_H = 256;

/**
 * Drifting clouds with ground shadow effect.
 * Clouds float above everything; shadows sit between terrain and decorations.
 */
export class CloudLayer {
  constructor(app, world) {
    this.cloudContainer = new Container({ label: 'clouds' });
    this.shadowContainer = new Container({ label: 'cloud-shadows' });
    this.clouds = [];

    const rng = new SeededRandom(world.seed + 555);
    const textures = app.textures;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const variant = rng.nextInt(1, 9); // cloud1 through cloud8
      const tex = textures[`cloud${variant}`];
      if (!tex) continue;

      const x = rng.nextFloat(-CLOUD_W, WORLD_W);
      const y = rng.nextFloat(0, WORLD_H);
      const speed = rng.nextFloat(0.15, 0.4);
      const scale = rng.nextFloat(0.6, 1.2);

      // Cloud sprite
      const cloud = new Sprite(tex);
      cloud.x = x;
      cloud.y = y;
      cloud.scale.set(scale);
      cloud.alpha = 0.85;
      this.cloudContainer.addChild(cloud);

      // Shadow on ground
      const shadow = new Sprite(tex);
      shadow.x = x + 40;  // Slight offset for parallax
      shadow.y = y + 60;
      shadow.scale.set(scale);
      shadow.alpha = 0.12;
      shadow.tint = 0x000000;
      this.shadowContainer.addChild(shadow);

      this.clouds.push({ cloud, shadow, speed });
    }

    // Shadow layer goes between flat ground and decorations
    // Cloud layer goes on top of everything
    const wc = app.worldContainer;
    // Insert shadow after tilemap layers but before decorations
    // The worldContainer children at this point: [foam, flat, shadows, elevated]
    // We want cloud shadows after elevated but before decoration layer
    wc.addChild(this.shadowContainer);
    wc.addChild(this.cloudContainer);
  }

  /**
   * Move clouds and shadows. Call each frame.
   * @param {number} delta - Frame delta from ticker
   */
  update(delta) {
    for (const { cloud, shadow, speed } of this.clouds) {
      cloud.x += speed * delta;
      shadow.x += speed * delta;

      // Wrap around
      if (cloud.x > WORLD_W + CLOUD_W) {
        cloud.x = -CLOUD_W * cloud.scale.x;
        shadow.x = cloud.x + 40;
      }
    }
  }
}
