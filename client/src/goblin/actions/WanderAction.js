import { WORLD_COLS, WORLD_ROWS } from '@shared/constants.js';

/**
 * Short-range random movement within explored territory.
 * Scores based on curiosity, gated by basic needs.
 */
export const WanderAction = {
  name: 'wander',

  score(goblin, ctx) {
    const needGate = Math.min(goblin.drives.hunger, goblin.drives.stamina);
    return goblin.drives.curiosity * 0.3 * needGate;
  },

  execute(goblin, ctx) {
    if (goblin.path || goblin._pathPending) return;

    // Already made one trip — wander complete
    if (goblin.actionTimer > 0) {
      goblin.actionTimer = 0;
      goblin.currentAction = null;
      return;
    }

    const range = 8;
    const candidates = [];
    for (let dr = -range; dr <= range; dr++) {
      for (let dc = -range; dc <= range; dc++) {
        const c = goblin.col + dc;
        const r = goblin.row + dr;
        if (c < 0 || c >= WORLD_COLS || r < 0 || r >= WORLD_ROWS) continue;
        const idx = r * WORLD_COLS + c;
        if (!goblin.explored[idx]) continue;
        if (ctx.world.elevation[r][c] < 1) continue;
        if (c === goblin.col && r === goblin.row) continue;
        candidates.push({ col: c, row: r });
      }
    }

    if (candidates.length === 0) { goblin.currentAction = null; return; }

    goblin.actionTimer = 0.01; // Mark trip started
    const target = candidates[Math.floor(ctx.rng.next() * candidates.length)];
    goblin._pathPending = true;
    ctx.pathfinder.request(goblin, target.col, target.row, (path) => {
      goblin._pathPending = false;
      if (path && path.length > 1) {
        goblin.path = path;
        goblin.pathIndex = 1;
      } else {
        goblin.actionTimer = 0;
        goblin.setActionCooldown('wander', 45);
        goblin.currentAction = null;
      }
    });
  },
};
