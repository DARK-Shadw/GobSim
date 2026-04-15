import { RESOURCE, RELATIONSHIP } from '@shared/constants.js';
import * as Rel from '../Relationship.js';

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

    const sheep = ctx.manager.findInMemory(goblin, 'sheep', null);
    if (!sheep) return 0;

    const dist = Math.abs(sheep.col - goblin.col) + Math.abs(sheep.row - goblin.row);
    const proximity = Math.max(0.1, 1 - dist / 30);

    // Relationship modifier — avoid rival's target
    let relMod = 0;
    if (Rel.isRivalTargeting(goblin, sheep.col, sheep.row, ctx.allGoblins))
      relMod -= RELATIONSHIP.RIVAL_RESOURCE_PENALTY;

    // When critically hungry, hunt aggressively regardless of bush knowledge
    if (goblin.drives.hunger < 0.21) {
      return Math.max(0, urgency * 0.6 * proximity + relMod);
    }

    // If bushes are known, prefer eating over hunting
    const bush = ctx.manager.findInMemory(goblin, 'bush', 'FULL');
    if (bush) return Math.max(0, urgency * 0.3 + relMod);

    return Math.max(0, urgency * 0.6 * proximity + relMod);
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
          // Sheep gone — check if there's dropped meat at our feet to pick up
          const meatMem = ctx.manager.findInMemory(goblin, 'drop_meat', 'GROUND');
          if (meatMem && goblin.col === meatMem.col && goblin.row === meatMem.row) {
            const meat = ctx.manager.verifyMemory(goblin, meatMem);
            if (meat && meat.typeDef.pickup) {
              meat.typeDef.pickup(meat, ctx.resources._makeContext(ctx.delta));
              goblin.inventory.meat++;
              goblin.carry = 'meat';
              ctx.manager.showFloat(goblin, '+1 meat', 0xff6644);
              console.log(`[Goblin #${goblin.id}] Picked up meat from kill (total: ${goblin.inventory.meat})`);
            }
          }
          goblin.actionTimer = 0;
          goblin.currentAction = null;
          return;
        }

        goblin.actionTimer += ctx.delta;
        ctx.manager._setAnimation(goblin, 'interact', 'knife');

        if (goblin.actionTimer >= goblin.traits.eat_time) {
          ctx.resources.triggerFlee(goblin.col, goblin.row, RESOURCE.SHEEP_FLEE_RADIUS);
          if (entity.typeDef.kill) {
            entity.typeDef.kill(entity, ctx.resources._makeContext(ctx.delta));
            ctx.manager._recordHarvest(entity.id, goblin.id);
          }
          goblin.actionTimer = 0.01; // Stay committed — flow into pickup phase
          ctx.manager._scanResources(goblin); // Discover dropped meat
          const levelUp = goblin.addSkillXP('hunting');
          if (levelUp) {
            ctx.manager.showFloat(goblin, `\u2B06 Hunting ${['I','II','III','IV','V'][levelUp-1]}`, 0xff6644);
            if (ctx.manager.narrator) ctx.manager.narrator.log(`${goblin.name} reached Hunting ${['I','II','III','IV','V'][levelUp-1]}!`, 0xff6644);
          }
          console.log(`[Goblin #${goblin.id}] Killed sheep at (${sheepMem.col},${sheepMem.row})`);
        }
        return;
      }

      // Pathfind to sheep
      goblin._pathPending = true;
      const targetId = sheepMem.entityId;
      ctx.pathfinder.request(goblin, sheepMem.col, sheepMem.row, (path) => {
        goblin._pathPending = false;
        if (path && path.length > 1) {
          goblin.path = path;
          goblin.pathIndex = 1;
        } else {
          goblin.memory.delete(targetId);
          goblin.setActionCooldown('hunt', goblin.drives.hunger < 0.21 ? 15 : 60);
          goblin.currentAction = null;
        }
      });
    }
  },
};
