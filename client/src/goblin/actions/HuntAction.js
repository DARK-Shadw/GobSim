import { RESOURCE } from '@shared/constants.js';

/**
 * Hunt sheep for meat. Last-resort food source (harder than bushes).
 * Phases: find sheep → pathfind nearby → kill → collect.
 */
export const HuntAction = {
  name: 'hunt',

  score(goblin, ctx) {
    const urgency = goblin.getHungerUrgency();
    if (urgency < 0.4) return 0;
    if (goblin.drives.stamina < 0.2) return 0;

    const bush = ctx.manager.findInMemory(goblin, 'bush', 'FULL');
    if (bush) return urgency * 0.3;

    const sheep = ctx.manager.findInMemory(goblin, 'sheep', null);
    if (sheep) {
      const dist = Math.abs(sheep.col - goblin.col) + Math.abs(sheep.row - goblin.row);
      const proximity = Math.max(0.1, 1 - dist / 30);
      return urgency * 0.6 * proximity;
    }

    return 0;
  },

  execute(goblin, ctx) {
    const sheepMem = ctx.manager.findInMemory(goblin, 'sheep', null);
    if (!sheepMem) {
      goblin.currentAction = null;
      return;
    }

    if (!goblin.path && !goblin._pathPending) {
      const dist = Math.abs(sheepMem.col - goblin.col) + Math.abs(sheepMem.row - goblin.row);

      if (dist <= 1) {
        // Adjacent to sheep — kill it
        const entity = ctx.manager.verifyMemory(goblin, sheepMem);
        if (!entity) {
          goblin.currentAction = null;
          return;
        }

        goblin.actionTimer += ctx.delta;
        ctx.manager._setAnimation(goblin, 'interact', 'knife');

        if (goblin.actionTimer >= goblin.traits.eat_time) {
          ctx.resources.triggerFlee(goblin.col, goblin.row, RESOURCE.SHEEP_FLEE_RADIUS);
          if (entity.typeDef.kill) {
            entity.typeDef.kill(entity, ctx.resources._makeContext(ctx.delta));
          }
          goblin.actionTimer = 0;
          goblin.currentAction = null;
          console.log(`[Goblin #${goblin.id}] Killed sheep at (${sheepMem.col},${sheepMem.row})`);
        }
        return;
      }

      // Pathfind to sheep
      goblin._pathPending = true;
      ctx.pathfinder.request(goblin, sheepMem.col, sheepMem.row, (path) => {
        goblin._pathPending = false;
        if (path && path.length > 1) {
          goblin.path = path;
          goblin.pathIndex = 1;
        } else {
          goblin.currentAction = null;
        }
      });
    }
  },
};
