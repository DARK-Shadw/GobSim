import { Texture, Rectangle } from 'pixi.js';
import { TILE_SIZE } from '@shared/constants.js';

/**
 * Tiny Swords Tilemap Layout (576×384 = 9 cols × 6 rows of 64px tiles)
 *
 * LEFT SECTION (cols 0-4): Surface grass auto-tiles
 *   4×4 island template (cols 0-3, rows 0-3):
 *     (0,0) TL corner  (1,0) T edge  (2,0) T edge  (3,0) TR corner
 *     (0,1) L edge     (1,1) Center  (2,1) Center  (3,1) R edge
 *     (0,2) L edge     (1,2) Center  (2,2) Center  (3,2) R edge
 *     (0,3) BL corner  (1,3) B edge  (2,3) B edge  (3,3) BR corner
 *
 *   Inner corners (rows 4-5, cols 0-1):
 *     (0,4) IC notch at NW   (1,4) IC notch at NE
 *     (0,5) IC notch at SW   (1,5) IC notch at SE
 *
 * RIGHT SECTION (cols 5-8): Elevated surface + cliff faces
 *   Surface (rows 0-1):
 *     (5,0) TL  (6,0) T   (7,0) T   (8,0) TR
 *     (5,1) L   (6,1) C   (7,1) C   (8,1) R
 *
 *   Cliff tops (row 2):
 *     (5,2) CL-top-L  (6,2) CL-top-C  (7,2) CL-top-C  (8,2) CL-top-R
 *
 *   Cliff faces (rows 3-5):
 *     (5,3) CL-L  (6,3) CL-C  (7,3) CL-C  (8,3) CL-R
 *     (5,4) CL-L  (6,4) CL-C  (7,4) CL-C  (8,4) CL-R
 *     (5,5) CL-BL (6,5) CL-BC (7,5) CL-BC (8,5) CL-BR
 */

// Cardinal bitmask: N=1, E=2, S=4, W=8
// A cell with bitmask B has land neighbors on each flagged side.

// Surface tile positions: bitmask → [col, row]
const SURFACE_MAP = [];

// Standard tiles (present in the 4×4 template)
SURFACE_MAP[15] = [1, 1];   // Center — all 4 neighbors
SURFACE_MAP[14] = [1, 0];   // E+S+W → missing N → top edge
SURFACE_MAP[13] = [3, 1];   // N+S+W → missing E → right edge
SURFACE_MAP[11] = [1, 3];   // N+E+W → missing S → bottom edge
SURFACE_MAP[7]  = [0, 1];   // N+E+S → missing W → left edge
SURFACE_MAP[6]  = [0, 0];   // E+S   → missing N,W → TL outer corner
SURFACE_MAP[12] = [3, 0];   // S+W   → missing N,E → TR outer corner
SURFACE_MAP[3]  = [0, 3];   // N+E   → missing S,W → BL outer corner
SURFACE_MAP[9]  = [3, 3];   // N+W   → missing S,E → BR outer corner

// Rare configurations — use center tile as safe fallback.
// The smoothing pass in WorldGenerator eliminates most of these,
// and center tile looks acceptable since adjacent water/empty creates the visual edge.
SURFACE_MAP[0]  = [1, 1];   // Isolated
SURFACE_MAP[1]  = [1, 1];   // N only
SURFACE_MAP[2]  = [1, 1];   // E only
SURFACE_MAP[4]  = [1, 1];   // S only
SURFACE_MAP[5]  = [1, 1];   // N+S vertical strip
SURFACE_MAP[8]  = [1, 1];   // W only
SURFACE_MAP[10] = [1, 1];   // E+W horizontal strip

// Inner corner overlay positions (placed on top of center tile)
// Each tile is mostly transparent with a concave grass notch in one corner.
// Used when bitmask=15 but a specific diagonal neighbor is missing.
const INNER_CORNER = {
  NW: [0, 4],   // Notch/concave at NW corner
  NE: [1, 4],   // Notch at NE corner
  SW: [0, 5],   // Notch at SW corner
  SE: [1, 5],   // Notch at SE corner
};

// Cliff face tile positions (right section)
const CLIFF_TOP = {
  LEFT:   [5, 2],
  CENTER: [6, 2],
  RIGHT:  [8, 2],
};

const CLIFF_FACE = {
  TOP_LEFT:   [5, 3],
  TOP_CENTER: [6, 3],
  TOP_RIGHT:  [8, 3],
  MID_LEFT:   [5, 4],
  MID_CENTER: [6, 4],
  MID_RIGHT:  [8, 4],
  BOT_LEFT:   [5, 5],
  BOT_CENTER: [6, 5],
  BOT_RIGHT:  [8, 5],
};

// Elevated surface tiles (right section rows 0-1)
// Layout: (5,0)TL (6,0)T (7,0)T (8,0)TR / (5,1)L (6,1)C (7,1)C (8,1)R
// Only 2 rows available — bottom edge/corners use center fallback
// (cliff top tiles handle the visual transition below elevated terrain)
const ELEVATED_SURFACE_MAP = [];
ELEVATED_SURFACE_MAP[15] = [6, 1];   // Center
ELEVATED_SURFACE_MAP[14] = [6, 0];   // Top edge
ELEVATED_SURFACE_MAP[13] = [8, 1];   // Right edge
ELEVATED_SURFACE_MAP[11] = [6, 1];   // Bottom edge → center (cliff handles visual)
ELEVATED_SURFACE_MAP[7]  = [5, 1];   // Left edge
ELEVATED_SURFACE_MAP[6]  = [5, 0];   // TL outer corner
ELEVATED_SURFACE_MAP[12] = [8, 0];   // TR outer corner
ELEVATED_SURFACE_MAP[3]  = [5, 1];   // BL → left edge fallback
ELEVATED_SURFACE_MAP[9]  = [8, 1];   // BR → right edge fallback
// Rare configs → center
ELEVATED_SURFACE_MAP[0]  = [6, 1];
ELEVATED_SURFACE_MAP[1]  = [6, 1];
ELEVATED_SURFACE_MAP[2]  = [6, 1];
ELEVATED_SURFACE_MAP[4]  = [6, 1];
ELEVATED_SURFACE_MAP[5]  = [6, 1];
ELEVATED_SURFACE_MAP[8]  = [6, 1];
ELEVATED_SURFACE_MAP[10] = [6, 1];

export class TileAtlas {
  constructor() {
    this._cache = new Map();
  }

  getTile(tilemapTexture, col, row) {
    const key = `${tilemapTexture.uid}_${col}_${row}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const frame = new Rectangle(
      col * TILE_SIZE,
      row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE
    );
    const tex = new Texture({ source: tilemapTexture.source, frame });
    this._cache.set(key, tex);
    return tex;
  }

  getSurfaceTile(tilemapTexture, bitmask) {
    const [col, row] = SURFACE_MAP[bitmask & 0xF];
    return this.getTile(tilemapTexture, col, row);
  }

  getElevatedSurfaceTile(tilemapTexture, bitmask) {
    const [col, row] = ELEVATED_SURFACE_MAP[bitmask & 0xF];
    return this.getTile(tilemapTexture, col, row);
  }

  getInnerCorner(tilemapTexture, corner) {
    const [col, row] = INNER_CORNER[corner];
    return this.getTile(tilemapTexture, col, row);
  }

  getCliffTop(tilemapTexture, position) {
    const [col, row] = CLIFF_TOP[position];
    return this.getTile(tilemapTexture, col, row);
  }

  getCliffFace(tilemapTexture, position) {
    const [col, row] = CLIFF_FACE[position];
    return this.getTile(tilemapTexture, col, row);
  }

  extractFrames(sheetTexture, frameW, frameH, count) {
    const key = `frames_${sheetTexture.uid}_${frameW}_${frameH}_${count}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const frames = [];
    for (let i = 0; i < count; i++) {
      const frame = new Rectangle(i * frameW, 0, frameW, frameH);
      frames.push(new Texture({ source: sheetTexture.source, frame }));
    }
    this._cache.set(key, frames);
    return frames;
  }
}

export const tileAtlas = new TileAtlas();
