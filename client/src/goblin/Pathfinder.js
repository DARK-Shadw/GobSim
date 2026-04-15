import { WORLD_COLS, WORLD_ROWS, ELEVATION, PATHFINDING } from '@shared/constants.js';

/**
 * A* pathfinder with binary heap, fog-of-war constraint, and request queue.
 * 4-directional movement, Manhattan heuristic.
 */
export class Pathfinder {
  constructor(world) {
    this.world = world;
    this._queue = [];
  }

  /**
   * Queue a path request. Callback receives path array or null.
   * @param {Goblin} goblin
   * @param {number} goalCol
   * @param {number} goalRow
   * @param {function} callback - (path: [{col,row}]|null) => void
   */
  /**
   * @param {object} [options]
   * @param {boolean} [options.ignoreFog] - Skip fog-of-war check (for camp homing)
   */
  request(goblin, goalCol, goalRow, callback, options) {
    this._queue.push({ goblin, goalCol, goalRow, callback, ignoreFog: options?.ignoreFog });
  }

  /** Process up to MAX_PER_FRAME requests per frame. */
  processQueue() {
    let processed = 0;
    while (this._queue.length > 0 && processed < PATHFINDING.MAX_PER_FRAME) {
      const req = this._queue.shift();
      const path = this._solve(req.goblin, req.goalCol, req.goalRow, req.ignoreFog);
      req.callback(path);
      processed++;
    }
  }

  _solve(goblin, goalCol, goalRow, ignoreFog = false) {
    const COLS = WORLD_COLS;
    const ROWS = WORLD_ROWS;
    const startCol = goblin.col;
    const startRow = goblin.row;
    const startIdx = startRow * COLS + startCol;
    const goalIdx = goalRow * COLS + goalCol;

    if (startIdx === goalIdx) return [{ col: goalCol, row: goalRow }];

    // Validate goal
    if (goalCol < 0 || goalCol >= COLS || goalRow < 0 || goalRow >= ROWS) return null;
    if (this.world.elevation[goalRow][goalCol] < ELEVATION.FLAT) return null;
    if (!ignoreFog && !goblin.explored[goalIdx]) return null;

    const size = COLS * ROWS;
    const gScore = new Uint16Array(size).fill(0xFFFF);
    const cameFrom = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);

    gScore[startIdx] = 0;
    const heap = new BinaryHeap();
    heap.push(startIdx, this._h(startCol, startRow, goalCol, goalRow));

    const DIRS = [
      { dc: 0, dr: -1 }, // N
      { dc: 1, dr: 0 },  // E
      { dc: 0, dr: 1 },  // S
      { dc: -1, dr: 0 }, // W
    ];

    let iterations = 0;
    while (heap.size > 0 && iterations < PATHFINDING.MAX_OPEN_SET) {
      iterations++;
      const currentIdx = heap.pop();

      if (currentIdx === goalIdx) {
        return this._reconstruct(cameFrom, goalIdx, COLS);
      }

      if (closed[currentIdx]) continue;
      closed[currentIdx] = 1;

      const cr = Math.floor(currentIdx / COLS);
      const cc = currentIdx % COLS;
      const currentG = gScore[currentIdx];

      for (const dir of DIRS) {
        const nc = cc + dir.dc;
        const nr = cr + dir.dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const nIdx = nr * COLS + nc;
        if (closed[nIdx]) continue;
        if (this.world.elevation[nr][nc] < ELEVATION.FLAT) continue;
        if (!ignoreFog && !goblin.explored[nIdx]) continue; // Fog of war

        const tentativeG = currentG + 1;
        if (tentativeG < gScore[nIdx]) {
          gScore[nIdx] = tentativeG;
          cameFrom[nIdx] = currentIdx;
          const f = tentativeG + this._h(nc, nr, goalCol, goalRow);
          heap.push(nIdx, f);
        }
      }
    }

    return null; // No path found
  }

  _h(c1, r1, c2, r2) {
    return Math.abs(c1 - c2) + Math.abs(r1 - r2);
  }

  _reconstruct(cameFrom, goalIdx, cols) {
    const path = [];
    let idx = goalIdx;
    while (idx !== -1) {
      path.push({ col: idx % cols, row: Math.floor(idx / cols) });
      idx = cameFrom[idx];
    }
    path.reverse();
    return path;
  }
}

/**
 * Min-heap keyed by f-score.
 */
class BinaryHeap {
  constructor() {
    this._data = []; // { idx, f }
    this.size = 0;
  }

  push(idx, f) {
    this._data.push({ idx, f });
    this.size++;
    this._bubbleUp(this.size - 1);
  }

  pop() {
    if (this.size === 0) return -1;
    const top = this._data[0];
    this.size--;
    if (this.size > 0) {
      this._data[0] = this._data.pop();
      this._sinkDown(0);
    } else {
      this._data.pop();
    }
    return top.idx;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._data[i].f >= this._data[parent].f) break;
      [this._data[i], this._data[parent]] = [this._data[parent], this._data[i]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.size;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._data[l].f < this._data[smallest].f) smallest = l;
      if (r < n && this._data[r].f < this._data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this._data[i], this._data[smallest]] = [this._data[smallest], this._data[i]];
      i = smallest;
    }
  }
}
