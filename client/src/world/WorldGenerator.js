import { createNoise2D } from 'simplex-noise';
import { SeededRandom } from '@/utils/SeededRandom.js';
import {
  WORLD_COLS, WORLD_ROWS, ELEVATION,
  FLAT_THRESHOLD, ELEVATED_THRESHOLD,
} from '@shared/constants.js';

/**
 * Generates the world terrain from a seed using multi-octave Simplex noise.
 *
 * Output grids (WORLD_COLS × WORLD_ROWS):
 *   elevation[row][col]  — WATER / FLAT / ELEVATED
 *   surfaceBitmask[r][c] — 4-bit cardinal bitmask for flat surface auto-tiling
 *   elevatedBitmask[r][c] — 4-bit cardinal bitmask for elevated surface auto-tiling
 *   decorations[]        — { type, col, row, variant }
 *   resources[]          — { type, col, row, variant }
 *   coastline[]          — { col, row } cells adjacent to water
 *   ramps[]              — { col, row } cells that are walkable transitions flat↔elevated
 */
export class WorldGenerator {
  constructor(seed) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);

    this._terrainNoise = createNoise2D(() => this.rng.next());
    this._forestNoise = createNoise2D(() => this.rng.next());
    this._goldNoise = createNoise2D(() => this.rng.next());

    this.elevation = [];
    this.surfaceBitmask = [];
    this.elevatedBitmask = [];
    this.diagonals = [];
    this.elevatedDiagonals = [];
    this.decorations = [];
    this.resources = [];
    this.coastline = [];
    this.ramps = [];

    this._generate();
  }

  _generate() {
    this._generateElevation();
    this._smoothCoastline();
    this._computeAutoTile();
    this._findCoastline();
    this._placeDecorations();
    this._placeResources();
    this._logStats();
  }

  /**
   * Multi-octave Simplex noise → island-masked elevation grid.
   * Uses lower frequency for elevation to create larger, smoother elevated regions.
   */
  _generateElevation() {
    const { WATER, FLAT, ELEVATED } = ELEVATION;
    const cols = WORLD_COLS;
    const rows = WORLD_ROWS;
    const noise = this._terrainNoise;

    const islands = [
      { cx: 0.5, cy: 0.5, rx: 0.38, ry: 0.38, weight: 1.0 },
    ];
    const numSecondary = this.rng.nextInt(2, 4);
    for (let i = 0; i < numSecondary; i++) {
      islands.push({
        cx: this.rng.nextFloat(0.15, 0.85),
        cy: this.rng.nextFloat(0.15, 0.85),
        rx: this.rng.nextFloat(0.08, 0.18),
        ry: this.rng.nextFloat(0.08, 0.18),
        weight: this.rng.nextFloat(0.5, 0.8),
      });
    }

    this.elevation = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const nx = c / cols;
        const ny = r / rows;

        // Multi-octave noise (lower freq for smoother terrain)
        let n = 0;
        n += 1.0  * noise(nx * 4, ny * 4);
        n += 0.5  * noise(nx * 8, ny * 8);
        n += 0.25 * noise(nx * 16, ny * 16);
        n /= 1.75;

        // Island mask
        let mask = 0;
        for (const island of islands) {
          const dx = (nx - island.cx) / island.rx;
          const dy = (ny - island.cy) / island.ry;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const falloff = Math.max(0, 1 - dist * dist);
          mask = Math.max(mask, falloff * island.weight);
        }

        const landValue = n * 0.6 + mask * 0.8 - 0.35;

        if (landValue > FLAT_THRESHOLD) {
          row.push(FLAT);
        } else {
          row.push(WATER);
        }
      }
      this.elevation.push(row);
    }
  }

  /**
   * Post-process elevation grid: remove thin elevated strips.
   * Morphological erosion then dilation — eliminates 1-2 tile wide peninsulas
   * while preserving large elevated regions.
   */
  _smoothElevation() {
    const { WATER, FLAT, ELEVATED } = ELEVATION;
    const rows = WORLD_ROWS;
    const cols = WORLD_COLS;

    // Pass 1: Erode — any elevated cell with fewer than 3 elevated cardinal neighbors → FLAT
    for (let pass = 0; pass < 2; pass++) {
      const changes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.elevation[r][c] !== ELEVATED) continue;

          let elevNeighbors = 0;
          if (r > 0 && this.elevation[r - 1][c] === ELEVATED) elevNeighbors++;
          if (r < rows - 1 && this.elevation[r + 1][c] === ELEVATED) elevNeighbors++;
          if (c > 0 && this.elevation[r][c - 1] === ELEVATED) elevNeighbors++;
          if (c < cols - 1 && this.elevation[r][c + 1] === ELEVATED) elevNeighbors++;

          if (elevNeighbors < 2) {
            changes.push([r, c]);
          }
        }
      }
      for (const [r, c] of changes) {
        this.elevation[r][c] = FLAT;
      }
    }

    // Pass 2: Also erode thin land strips — land cells with fewer than 2 land neighbors
    for (let pass = 0; pass < 1; pass++) {
      const changes = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.elevation[r][c] === WATER) continue;

          let landNeighbors = 0;
          if (r > 0 && this.elevation[r - 1][c] >= FLAT) landNeighbors++;
          if (r < rows - 1 && this.elevation[r + 1][c] >= FLAT) landNeighbors++;
          if (c > 0 && this.elevation[r][c - 1] >= FLAT) landNeighbors++;
          if (c < cols - 1 && this.elevation[r][c + 1] >= FLAT) landNeighbors++;

          if (landNeighbors < 2) {
            changes.push([r, c]);
          }
        }
      }
      for (const [r, c] of changes) {
        this.elevation[r][c] = WATER;
      }
    }
  }

  /**
   * Smooth coastline by removing isolated water holes inside land
   * and isolated land specks in water.
   */
  _smoothCoastline() {
    const { WATER, FLAT } = ELEVATION;
    const rows = WORLD_ROWS;
    const cols = WORLD_COLS;

    // Fill isolated water holes (water surrounded by 4 land neighbors)
    const changes = [];
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (this.elevation[r][c] !== WATER) continue;

        const allLand =
          this.elevation[r - 1][c] >= FLAT &&
          this.elevation[r + 1][c] >= FLAT &&
          this.elevation[r][c - 1] >= FLAT &&
          this.elevation[r][c + 1] >= FLAT;

        if (allLand) {
          changes.push([r, c, FLAT]);
        }
      }
    }
    for (const [r, c, val] of changes) {
      this.elevation[r][c] = val;
    }
  }

  /**
   * Place ramps: walkable transitions between FLAT and ELEVATED.
   * Each elevated region gets at least one ramp on its north side
   * (where cliffs don't render). Ramps are marked so pathfinding
   * knows goblins can walk between levels.
   */
  _placeRamps() {
    const { FLAT, ELEVATED } = ELEVATION;
    const rows = WORLD_ROWS;
    const cols = WORLD_COLS;

    // Find elevated regions via flood fill and place ramps
    const visited = Array.from({ length: rows }, () => new Uint8Array(cols));
    this.ramps = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.elevation[r][c] !== ELEVATED || visited[r][c]) continue;

        // Flood fill to find this elevated region
        const region = [];
        const stack = [[r, c]];
        while (stack.length > 0) {
          const [cr, cc] = stack.pop();
          if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
          if (visited[cr][cc] || this.elevation[cr][cc] !== ELEVATED) continue;
          visited[cr][cc] = 1;
          region.push([cr, cc]);
          stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
        }

        // Find south-edge cells (cells with FLAT to the south) — these are where
        // cliff faces render, so ramps here create visible gaps in the cliff wall
        const rampCandidates = [];
        for (const [er, ec] of region) {
          if (er < rows - 1 && this.elevation[er + 1][ec] === FLAT) {
            // Prefer cells that also have an elevated neighbor to the left or right
            // (avoids placing ramps at narrow peninsula tips)
            const hasHorizNeighbor =
              (ec > 0 && this.elevation[er][ec - 1] === ELEVATED) ||
              (ec < cols - 1 && this.elevation[er][ec + 1] === ELEVATED);
            if (hasHorizNeighbor) {
              rampCandidates.push({ col: ec, row: er });
            }
          }
        }

        // Fallback: any south-edge cell
        if (rampCandidates.length === 0) {
          for (const [er, ec] of region) {
            if (er < rows - 1 && this.elevation[er + 1][ec] === FLAT) {
              rampCandidates.push({ col: ec, row: er });
            }
          }
        }

        // Mark 1-2 ramps per region, each 2 tiles wide for a visible opening
        if (rampCandidates.length > 0) {
          const rng = new SeededRandom(this.seed + r * 1000 + c);
          const count = Math.min(rampCandidates.length, Math.max(1, Math.floor(region.length / 20)));
          rng.shuffle(rampCandidates);
          for (let i = 0; i < count; i++) {
            const ramp = rampCandidates[i];
            this.ramps.push(ramp);
            // Widen ramp: also mark the right neighbor if it's a valid south-edge cell
            const rc = ramp.col + 1;
            if (rc < cols && this.elevation[ramp.row][rc] === ELEVATED
                && ramp.row + 1 < rows && this.elevation[ramp.row + 1][rc] === FLAT) {
              this.ramps.push({ col: rc, row: ramp.row });
            }
          }
        }
      }
    }
  }

  /**
   * For each land cell, compute 4-bit cardinal bitmask and diagonal data.
   * N=1, E=2, S=4, W=8
   */
  _computeAutoTile() {
    const { WATER, FLAT, ELEVATED } = ELEVATION;
    const rows = WORLD_ROWS;
    const cols = WORLD_COLS;

    this.surfaceBitmask = [];
    this.elevatedBitmask = [];
    this.diagonals = [];
    this.elevatedDiagonals = [];

    for (let r = 0; r < rows; r++) {
      const sBits = [];
      const eBits = [];
      const sDiag = [];
      const eDiag = [];

      for (let c = 0; c < cols; c++) {
        const elev = this.elevation[r][c];

        // Surface bitmask: cell is FLAT or ELEVATED, check neighbors ≥ FLAT
        if (elev >= FLAT) {
          let cardinal = 0;
          if (r > 0 && this.elevation[r - 1][c] >= FLAT) cardinal |= 1;
          if (c < cols - 1 && this.elevation[r][c + 1] >= FLAT) cardinal |= 2;
          if (r < rows - 1 && this.elevation[r + 1][c] >= FLAT) cardinal |= 4;
          if (c > 0 && this.elevation[r][c - 1] >= FLAT) cardinal |= 8;
          sBits.push(cardinal);

          let diag = 0;
          if (r > 0 && c < cols - 1 && this.elevation[r - 1][c + 1] >= FLAT) diag |= 1;
          if (r < rows - 1 && c < cols - 1 && this.elevation[r + 1][c + 1] >= FLAT) diag |= 2;
          if (r < rows - 1 && c > 0 && this.elevation[r + 1][c - 1] >= FLAT) diag |= 4;
          if (r > 0 && c > 0 && this.elevation[r - 1][c - 1] >= FLAT) diag |= 8;
          sDiag.push(diag);
        } else {
          sBits.push(0);
          sDiag.push(0);
        }

        // Elevated bitmask: strict check — only ELEVATED neighbors count as "same".
        // This produces proper edge/corner tiles on all sides of elevated plateaus.
        // Ramp walkability is handled in game logic (Phase 2+), not visually.
        if (elev === ELEVATED) {
          let cardinal = 0;
          if (r > 0 && this.elevation[r - 1][c] === ELEVATED) cardinal |= 1;       // N
          if (c < cols - 1 && this.elevation[r][c + 1] === ELEVATED) cardinal |= 2; // E
          if (r < rows - 1 && this.elevation[r + 1][c] === ELEVATED) cardinal |= 4; // S
          if (c > 0 && this.elevation[r][c - 1] === ELEVATED) cardinal |= 8;        // W
          eBits.push(cardinal);

          // Diagonals not needed (inner corners removed)
          eDiag.push(15);
        } else {
          eBits.push(0);
          eDiag.push(0);
        }
      }

      this.surfaceBitmask.push(sBits);
      this.elevatedBitmask.push(eBits);
      this.diagonals.push(sDiag);
      this.elevatedDiagonals.push(eDiag);
    }
  }

  _findCoastline() {
    const { WATER } = ELEVATION;
    this.coastline = [];

    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        if (this.elevation[r][c] === WATER) continue;

        const hasWaterNeighbor =
          (r > 0 && this.elevation[r - 1][c] === WATER) ||
          (r < WORLD_ROWS - 1 && this.elevation[r + 1][c] === WATER) ||
          (c > 0 && this.elevation[r][c - 1] === WATER) ||
          (c < WORLD_COLS - 1 && this.elevation[r][c + 1] === WATER);

        if (hasWaterNeighbor) {
          this.coastline.push({ col: c, row: r });
        }
      }
    }
  }

  _placeDecorations() {
    const noise = this._forestNoise;
    this.decorations = [];

    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        if (this.elevation[r][c] === ELEVATION.WATER) continue;

        const nx = c / WORLD_COLS;
        const ny = r / WORLD_ROWS;
        const val = noise(nx * 6, ny * 6);

        if (val > 0.55) {
          const variant = ((c * 7 + r * 13) % 4) + 1;
          this.decorations.push({ type: 'tree', col: c, row: r, variant });
        } else if (val > 0.3 && val < 0.4) {
          const variant = ((c * 3 + r * 11) % 4) + 1;
          this.decorations.push({ type: 'bush', col: c, row: r, variant });
        }
      }
    }

    // Rocks near coastline
    for (const cell of this.coastline) {
      if (this.rng.next() < 0.15) {
        const variant = this.rng.nextInt(1, 5);
        this.decorations.push({ type: 'rock', col: cell.col, row: cell.row, variant });
      }
    }

    // Water rocks
    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        if (this.elevation[r][c] !== ELEVATION.WATER) continue;

        const hasLandNeighbor =
          (r > 0 && this.elevation[r - 1][c] !== ELEVATION.WATER) ||
          (r < WORLD_ROWS - 1 && this.elevation[r + 1][c] !== ELEVATION.WATER) ||
          (c > 0 && this.elevation[r][c - 1] !== ELEVATION.WATER) ||
          (c < WORLD_COLS - 1 && this.elevation[r][c + 1] !== ELEVATION.WATER);

        if (hasLandNeighbor && this.rng.next() < 0.08) {
          const variant = this.rng.nextInt(1, 5);
          this.decorations.push({ type: 'water_rock', col: c, row: r, variant });
        }
      }
    }

    // Rubber ducks
    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        if (this.elevation[r][c] === ELEVATION.WATER && this.rng.next() < 0.002) {
          this.decorations.push({ type: 'duck', col: c, row: r, variant: 1 });
        }
      }
    }
  }

  _placeResources() {
    const noise = this._goldNoise;
    this.resources = [];

    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        const elev = this.elevation[r][c];
        if (elev === ELEVATION.WATER) continue;

        const nx = c / WORLD_COLS;
        const ny = r / WORLD_ROWS;
        const val = noise(nx * 5, ny * 5);

        if (elev >= ELEVATION.FLAT && val > 0.7) {
          const hasTree = this.decorations.some(
            d => d.col === c && d.row === r && d.type === 'tree'
          );
          if (!hasTree) {
            const variant = this.rng.nextInt(1, 7);
            this.resources.push({ type: 'gold', col: c, row: r, variant });
          }
        }

        if (elev === ELEVATION.FLAT && val < -0.5) {
          const hasDecor = this.decorations.some(
            d => d.col === c && d.row === r
          );
          if (!hasDecor && this.rng.next() < 0.3) {
            this.resources.push({ type: 'sheep', col: c, row: r, variant: 1 });
          }
        }
      }
    }
  }

  _logStats() {
    let water = 0, flat = 0, elevated = 0;
    for (let r = 0; r < WORLD_ROWS; r++) {
      for (let c = 0; c < WORLD_COLS; c++) {
        const e = this.elevation[r][c];
        if (e === ELEVATION.WATER) water++;
        else if (e === ELEVATION.FLAT) flat++;
        else elevated++;
      }
    }

    const trees = this.decorations.filter(d => d.type === 'tree').length;
    const bushes = this.decorations.filter(d => d.type === 'bush').length;
    const sheep = this.resources.filter(r => r.type === 'sheep').length;
    const gold = this.resources.filter(r => r.type === 'gold').length;

    console.log(
      `[WorldGen] Seed: ${this.seed} | ` +
      `Water: ${water} | Flat: ${flat} | Elevated: ${elevated} | ` +
      `Coastline: ${this.coastline.length} | Ramps: ${this.ramps.length} | ` +
      `Trees: ${trees} | Bushes: ${bushes} | Sheep: ${sheep} | Gold: ${gold}`
    );
  }

  findScenicSpot() {
    const treeCells = new Set(
      this.decorations
        .filter(d => d.type === 'tree')
        .map(d => `${d.col},${d.row}`)
    );

    for (let r = Math.floor(WORLD_ROWS * 0.3); r < WORLD_ROWS * 0.7; r++) {
      for (let c = Math.floor(WORLD_COLS * 0.3); c < WORLD_COLS * 0.7; c++) {
        if (this.elevation[r][c] >= ELEVATION.FLAT) {
          let nearTree = false;
          for (let dr = -3; dr <= 3 && !nearTree; dr++) {
            for (let dc = -3; dc <= 3 && !nearTree; dc++) {
              if (treeCells.has(`${c + dc},${r + dr}`)) nearTree = true;
            }
          }
          if (nearTree) return { col: c, row: r };
        }
      }
    }

    return { col: Math.floor(WORLD_COLS / 2), row: Math.floor(WORLD_ROWS / 2) };
  }

  /** Check if a cell is a designated ramp (for pathfinding in Phase 2+). */
  isRamp(col, row) {
    return this.ramps.some(r => r.col === col && r.row === row);
  }
}
