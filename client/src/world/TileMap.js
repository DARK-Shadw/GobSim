import { Container, Sprite, RenderTexture } from 'pixi.js';
import { tileAtlas } from './TileAtlas.js';
import {
  TILE_SIZE, WORLD_COLS, WORLD_ROWS, ELEVATION,
} from '@shared/constants.js';

const CHUNK_TILES = 16;
const CHUNK_PX = CHUNK_TILES * TILE_SIZE;

/**
 * Flat ground tilemap renderer.
 * Bakes static terrain into chunk-based RenderTextures for performance.
 */
export class TileMap {
  constructor(app, world) {
    this.app = app;
    this.world = world;
    this.renderer = app.pixi.renderer;

    this.flatContainer = new Container({ label: 'flat-ground' });
    app.worldContainer.addChild(this.flatContainer);

    this.chunksX = Math.ceil(WORLD_COLS / CHUNK_TILES);
    this.chunksY = Math.ceil(WORLD_ROWS / CHUNK_TILES);

    this._buildFlatLayer();
  }

  _buildFlatLayer() {
    const tilemap = this.app.textures.tilemap_color1;

    for (let cy = 0; cy < this.chunksY; cy++) {
      for (let cx = 0; cx < this.chunksX; cx++) {
        const chunk = this._renderChunk(cx, cy, (tempContainer, startCol, startRow, endCol, endRow) => {
          for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
              if (this.world.elevation[r][c] < ELEVATION.FLAT) continue;

              const bitmask = this.world.surfaceBitmask[r][c];
              const tex = tileAtlas.getSurfaceTile(tilemap, bitmask);
              const sprite = new Sprite(tex);
              sprite.x = (c - startCol) * TILE_SIZE;
              sprite.y = (r - startRow) * TILE_SIZE;
              tempContainer.addChild(sprite);
            }
          }
        });

        if (chunk) {
          chunk.x = cx * CHUNK_PX;
          chunk.y = cy * CHUNK_PX;
          this.flatContainer.addChild(chunk);
        }
      }
    }
  }

  _renderChunk(cx, cy, buildFn) {
    const startCol = cx * CHUNK_TILES;
    const startRow = cy * CHUNK_TILES;
    const endCol = Math.min(startCol + CHUNK_TILES, WORLD_COLS);
    const endRow = Math.min(startRow + CHUNK_TILES, WORLD_ROWS);

    const tempContainer = new Container();
    buildFn(tempContainer, startCol, startRow, endCol, endRow);

    if (tempContainer.children.length === 0) {
      tempContainer.destroy();
      return null;
    }

    const rt = RenderTexture.create({
      width: CHUNK_PX,
      height: CHUNK_PX,
      resolution: 1,
    });

    this.renderer.render({ container: tempContainer, target: rt });
    tempContainer.destroy({ children: true });

    return new Sprite(rt);
  }
}
