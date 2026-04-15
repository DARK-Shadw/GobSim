import { Container, Sprite, Graphics, Texture } from 'pixi.js';
import {
  WORLD_COLS, WORLD_ROWS, TILE_SIZE, ELEVATION,
} from '@shared/constants.js';

const MAP_W = 200;
const MAP_H = 160;
const SCALE_X = MAP_W / WORLD_COLS;
const SCALE_Y = MAP_H / WORLD_ROWS;

const COLORS = {
  [ELEVATION.WATER]: [98, 155, 158],    // Teal water
  [ELEVATION.FLAT]: [120, 180, 80],     // Green grass
  [ELEVATION.ELEVATED]: [85, 140, 60],  // Darker green
};

/**
 * Small overview map in the bottom-right corner.
 * Shows terrain overview and current viewport rectangle.
 * Click to jump camera to location.
 */
export class Minimap {
  constructor(app, world, camera) {
    this.app = app;
    this.camera = camera;
    this.container = new Container({ label: 'minimap' });

    // Background frame
    const frame = new Graphics();
    frame.roundRect(-4, -4, MAP_W + 8, MAP_H + 8, 4);
    frame.fill({ color: 0x000000, alpha: 0.6 });
    frame.stroke({ color: 0x886644, width: 2 });
    this.container.addChild(frame);

    // Render world to a small canvas and create a sprite
    this._mapSprite = this._renderMapTexture(world);
    this.container.addChild(this._mapSprite);

    // Viewport rectangle
    this._viewRect = new Graphics();
    this.container.addChild(this._viewRect);

    // Position in bottom-right
    app.uiContainer.addChild(this.container);
    this._onResize();
    window.addEventListener('resize', () => this._onResize());

    // Click to move camera
    this.container.eventMode = 'static';
    this.container.on('pointerdown', (e) => {
      const local = this.container.toLocal(e.global);
      const worldX = (local.x / MAP_W) * WORLD_COLS * TILE_SIZE;
      const worldY = (local.y / MAP_H) * WORLD_ROWS * TILE_SIZE;
      camera.moveTo(worldX, worldY);
    });
  }

  _renderMapTexture(world) {
    const canvas = document.createElement('canvas');
    canvas.width = WORLD_COLS;
    canvas.height = WORLD_ROWS;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(WORLD_COLS, WORLD_ROWS);
    const data = imageData.data;

    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        const idx = (r * WORLD_COLS + c) * 4;
        const elev = world.elevation[r][c];
        const [red, green, blue] = COLORS[elev];
        data[idx] = red;
        data[idx + 1] = green;
        data[idx + 2] = blue;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const sprite = Sprite.from(canvas);
    sprite.width = MAP_W;
    sprite.height = MAP_H;
    sprite.texture.source.scaleMode = 'nearest';
    return sprite;
  }

  _onResize() {
    const screen = this.app.pixi.screen;
    this.container.x = screen.width - MAP_W - 20;
    this.container.y = screen.height - MAP_H - 20;
  }

  /**
   * Update the viewport rectangle. Call each frame.
   */
  update(viewBounds) {
    this._viewRect.clear();
    const x = (viewBounds.x / (WORLD_COLS * TILE_SIZE)) * MAP_W;
    const y = (viewBounds.y / (WORLD_ROWS * TILE_SIZE)) * MAP_H;
    const w = (viewBounds.width / (WORLD_COLS * TILE_SIZE)) * MAP_W;
    const h = (viewBounds.height / (WORLD_ROWS * TILE_SIZE)) * MAP_H;

    this._viewRect.rect(x, y, w, h);
    this._viewRect.stroke({ color: 0xffffff, width: 1.5 });
  }
}
