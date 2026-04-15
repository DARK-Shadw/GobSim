import { GOBLIN_DEFAULTS } from '@shared/constants.js';

/**
 * Sleep at camp to recover fatigue. This is a real commitment —
 * goblin walks to camp and sleeps until fatigue drops below 0.1.
 */
export const SleepAction = {
  name: 'sleep',

  score(goblin, ctx) {
    const fatigue = goblin.drives.fatigue;
    if (fatigue < 0.3) return 0;

    const urgency = goblin.getFatigueUrgency();

    // Night boost — strongly prefer sleeping at night
    let nightMult = 1.0;
    if (ctx.dayNight) {
      if (ctx.dayNight.isNight) nightMult = 1.5;
      else if (ctx.dayNight.phase === 'dusk') nightMult = 1.2;
    }

    // Very tired — almost always sleep
    if (fatigue > 0.8) return Math.min(0.95, 0.85 * nightMult);

    // Moderately tired — score based on proximity to camp
    if (fatigue > GOBLIN_DEFAULTS.FATIGUE_SLEEP_THRESHOLD && ctx.camp) {
      const dist = Math.abs(ctx.camp.col - goblin.col) + Math.abs(ctx.camp.row - goblin.row);
      if (dist <= 2) return urgency * 0.75 * nightMult;
      return urgency * 0.5 * nightMult;
    }

    return urgency * 0.3 * nightMult;
  },

  execute(goblin, ctx) {
    // Walk to camp first
    if (ctx.camp && !goblin.path && !goblin._pathPending) {
      const dist = Math.abs(ctx.camp.col - goblin.col) + Math.abs(ctx.camp.row - goblin.row);

      if (dist > 2) {
        goblin._pathPending = true;
        ctx.pathfinder.request(goblin, ctx.camp.col, ctx.camp.row, (path) => {
          goblin._pathPending = false;
          if (path && path.length > 1) {
            goblin.path = path;
            goblin.pathIndex = 1;
          }
        });
        return;
      }
    }

    // Sleeping at camp (or in place if no camp)
    if (!goblin.path) {
      ctx.manager._setAnimation(goblin, 'idle', goblin.carry);

      // Keep actionTimer > 0 so the decision system doesn't interrupt sleep
      goblin.actionTimer = 0.01;

      // Fatigue recovery happens in _tickDrives when action === 'sleep' && isStationary
      if (goblin.drives.fatigue < 0.1) {
        goblin.actionTimer = 0;
        goblin.currentAction = null;
        console.log(`[Goblin #${goblin.id}] Woke up — fatigue: ${goblin.drives.fatigue.toFixed(2)}, stamina: ${goblin.drives.stamina.toFixed(2)}`);
      }
    }
  },
};
