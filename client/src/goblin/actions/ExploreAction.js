import { WORLD_COLS, WORLD_ROWS } from '@shared/constants.js';

/**
 * Seek nearest unexplored tile using BFS from goblin's position.
 * Scores higher than wander, gated by energy.
 */
export const ExploreAction = {
  name: 'explore',

  score(goblin, ctx) {
    // Count known food sources
    let foodCount = 0;
    for (const entry of goblin.memory.values()) {
      if (entry.type === 'bush' && entry.state === 'FULL') foodCount++;
      if (entry.type === 'drop_meat' && entry.state === 'GROUND') foodCount++;
      if (entry.type === 'sheep') foodCount++;
    }
    const hasMeat = goblin.inventory.meat > 0;

    // Proactive scouting: know fewer than 2 food sources → explore early
    // This prevents the "ate everything nearby, now starving" death spiral
    if (foodCount < 2 && !hasMeat) {
      // Starts high even when well-fed, scales with how little they know
      const scarcityBonus = foodCount === 0 ? 0.55 : 0.35;
      return scarcityBonus * goblin.drives.stamina;
    }

    // Normal exploration — gated by hunger and driven by curiosity
    if (goblin.drives.hunger < 0.3) return 0;
    return goblin.drives.curiosity * 0.6 * goblin.drives.stamina;
  },

  execute(goblin, ctx) {
    if (goblin.path || goblin._pathPending) return;

    // Already made one trip — exploration complete, let decision system choose next
    if (goblin.actionTimer > 0) {
      goblin.actionTimer = 0;
      goblin.currentAction = null;
      return;
    }

    const target = _findExplorationTarget(goblin, ctx.world);
    if (!target) { goblin.currentAction = null; return; }

    goblin.actionTimer = 0.01; // Mark trip started
    goblin._pathPending = true;
    ctx.pathfinder.request(goblin, target.col, target.row, (path) => {
      goblin._pathPending = false;
      if (path && path.length > 1) {
        goblin.path = path;
        goblin.pathIndex = 1;
      } else {
        goblin.actionTimer = 0;
        goblin.setActionCooldown('explore', 60);
        goblin.currentAction = null;
      }
    });
  },
};

/**
 * BFS outward from goblin to find the nearest explored walkable tile
 * that borders at least one unexplored tile (the frontier).
 */
function _findExplorationTarget(goblin, world) {
  const COLS = WORLD_COLS;
  const ROWS = WORLD_ROWS;
  const visited = new Uint8Array(COLS * ROWS);
  const queue = [];

  const startIdx = goblin.row * COLS + goblin.col;
  visited[startIdx] = 1;
  queue.push({ col: goblin.col, row: goblin.row });

  const DIRS = [
    { dc: 0, dr: -1 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
  ];

  let head = 0;
  const maxSearch = 1500;

  while (head < queue.length && head < maxSearch) {
    const { col, row } = queue[head++];

    let hasFrontier = false;
    for (const dir of DIRS) {
      const nc = col + dir.dc;
      const nr = row + dir.dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const nIdx = nr * COLS + nc;
      if (!goblin.explored[nIdx]) {
        hasFrontier = true;
        break;
      }
    }

    if (hasFrontier && (col !== goblin.col || row !== goblin.row)) {
      return { col, row };
    }

    for (const dir of DIRS) {
      const nc = col + dir.dc;
      const nr = row + dir.dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const nIdx = nr * COLS + nc;
      if (visited[nIdx]) continue;
      if (!goblin.explored[nIdx]) continue;
      if (world.elevation[nr][nc] < 1) continue;
      visited[nIdx] = 1;
      queue.push({ col: nc, row: nr });
    }
  }

  return null;
}
