import * as Rel from '../Relationship.js';
import { RELATIONSHIP } from '@shared/constants.js';

/**
 * Chop a tree for wood, or pick up dropped wood.
 * Phases: find target → pathfind → interact animation → collect.
 */
export const GatherWoodAction = {
  name: 'gather_wood',

  score(goblin, ctx) {
    if (goblin.drives.hunger < 0.3 || goblin.drives.stamina < 0.2) return 0;
    if (goblin.getInventoryTotal() >= goblin.traits.carry_capacity) return 0;

    const drop = ctx.manager.findInMemory(goblin, 'drop_wood', 'GROUND');
    const tree = ctx.manager.findInMemory(goblin, 'tree', 'GROWN');
    const target = drop || tree;
    if (!target) return 0;

    const dist = Math.abs(target.col - goblin.col) + Math.abs(target.row - goblin.row);
    let baseScore = (drop ? 0.3 : 0.2) * Math.max(0.1, 1 - dist / 30);

    // Relationship modifiers
    let relMod = 0;
    if (Rel.isNearFriend(goblin, ctx.allGoblins, RELATIONSHIP.PROXIMITY_RANGE))
      relMod += RELATIONSHIP.FRIEND_PROXIMITY_BONUS;
    if (Rel.isRivalTargeting(goblin, target.col, target.row, ctx.allGoblins))
      relMod -= RELATIONSHIP.RIVAL_RESOURCE_PENALTY;

    return Math.max(0, baseScore + relMod);
  },

  execute(goblin, ctx) {
    // Pick up dropped wood at feet
    const dropMem = ctx.manager.findInMemory(goblin, 'drop_wood', 'GROUND');
    if (dropMem && !goblin.path && goblin.col === dropMem.col && goblin.row === dropMem.row) {
      const entity = ctx.manager.verifyMemory(goblin, dropMem);
      if (entity && entity.typeDef.pickup) {
        entity.typeDef.pickup(entity, ctx.resources._makeContext(ctx.delta));
        goblin.inventory.wood++;
        goblin.carry = 'wood';
        ctx.manager.showFloat(goblin, '+1 wood', 0xcc8844);
        console.log(`[Goblin #${goblin.id}] Picked up wood (total: ${goblin.inventory.wood})`);
      }
      goblin.actionTimer = 0;
      goblin.currentAction = null;
      return;
    }

    // Find target: prefer drops, then standing trees
    const target = dropMem || ctx.manager.findInMemory(goblin, 'tree', 'GROWN');
    if (!target) {
      goblin.currentAction = null;
      return;
    }

    // At target
    if (!goblin.path && !goblin._pathPending && goblin.col === target.col && goblin.row === target.row) {
      const entity = ctx.manager.verifyMemory(goblin, target);
      if (!entity) {
        goblin.currentAction = null;
        return;
      }

      // Resource consumed by another goblin — bail out
      if (entity.type === 'tree' && entity.state !== 'GROWN') {
        ctx.manager._onResourceContention(goblin, target.entityId);
        goblin.currentAction = null;
        return;
      }
      if (entity.type === 'drop_wood' && entity.state !== 'GROUND') {
        ctx.manager._onResourceContention(goblin, target.entityId);
        goblin.currentAction = null;
        return;
      }

      if (entity.type === 'tree' && entity.typeDef.chop) {
        goblin.actionTimer += ctx.delta;
        ctx.manager._setAnimation(goblin, 'interact', 'axe');
        goblin.carry = 'axe';
        if (goblin.actionTimer >= goblin.getEffectiveGatherTime('woodcutting')) {
          entity.typeDef.chop(entity, ctx.resources._makeContext(ctx.delta));
          ctx.manager._recordHarvest(entity.id, goblin.id);
          goblin.actionTimer = 0.01; // Stay committed — flow into pickup phase
          goblin.carry = 'none';
          ctx.manager._scanResources(goblin); // Discover the new drop
          const levelUp = goblin.addSkillXP('woodcutting');
          if (levelUp) {
            ctx.manager.showFloat(goblin, `\u2B06 Woodcutting ${['I','II','III','IV','V'][levelUp-1]}`, 0x44ff44);
            if (ctx.manager.narrator) ctx.manager.narrator.log(`${goblin.name} reached Woodcutting ${['I','II','III','IV','V'][levelUp-1]}!`, 0x44ff44);
          }
          console.log(`[Goblin #${goblin.id}] Chopped tree at (${entity.col},${entity.row})`);
        }
      } else if (entity.type === 'drop_wood' && entity.typeDef.pickup) {
        entity.typeDef.pickup(entity, ctx.resources._makeContext(ctx.delta));
        goblin.inventory.wood++;
        goblin.carry = 'wood';
        goblin.actionTimer = 0;
        goblin.currentAction = null;
        ctx.manager.showFloat(goblin, '+1 wood', 0xcc8844);
        console.log(`[Goblin #${goblin.id}] Picked up wood (total: ${goblin.inventory.wood})`);
      }
      return;
    }

    // Pathfind to target
    if (!goblin.path && !goblin._pathPending) {
      goblin._pathPending = true;
      const targetId = target.entityId;
      ctx.pathfinder.request(goblin, target.col, target.row, (path) => {
        goblin._pathPending = false;
        if (path && path.length > 1) {
          goblin.path = path;
          goblin.pathIndex = 1;
        } else {
          goblin.memory.delete(targetId);
          goblin.setActionCooldown('gather_wood', 60);
          goblin.currentAction = null;
        }
      });
    }
  },
};
