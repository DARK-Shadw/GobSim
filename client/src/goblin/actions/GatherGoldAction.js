import * as Rel from '../Relationship.js';
import { RELATIONSHIP } from '@shared/constants.js';

/**
 * Mine gold ore, or pick up dropped gold.
 * Phases: find target → pathfind → interact animation → collect.
 */
export const GatherGoldAction = {
  name: 'gather_gold',

  score(goblin, ctx) {
    if (goblin.drives.hunger < 0.3 || goblin.drives.stamina < 0.2) return 0;
    if (goblin.getInventoryTotal() >= goblin.traits.carry_capacity) return 0;

    const drop = ctx.manager.findInMemory(goblin, 'drop_gold', 'GROUND');
    const gold = ctx.manager.findInMemory(goblin, 'gold', 'FULL');
    const target = drop || gold;
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
    // Pick up dropped gold at feet
    const dropMem = ctx.manager.findInMemory(goblin, 'drop_gold', 'GROUND');
    if (dropMem && !goblin.path && goblin.col === dropMem.col && goblin.row === dropMem.row) {
      const entity = ctx.manager.verifyMemory(goblin, dropMem);
      if (entity && entity.typeDef.pickup) {
        entity.typeDef.pickup(entity, ctx.resources._makeContext(ctx.delta));
        goblin.inventory.gold++;
        goblin.carry = 'gold';
        ctx.manager.showFloat(goblin, '+1 gold', 0xffcc00);
        console.log(`[Goblin #${goblin.id}] Picked up gold (total: ${goblin.inventory.gold})`);
      }
      goblin.actionTimer = 0;
      goblin.currentAction = null;
      return;
    }

    // Find target: prefer drops, then ore
    const target = dropMem || ctx.manager.findInMemory(goblin, 'gold', 'FULL');
    if (!target) {
      goblin.currentAction = null;
      return;
    }

    // At target
    if (!goblin.path && !goblin._pathPending && goblin.col === target.col && goblin.row === target.row) {
      const entity = ctx.manager.verifyMemory(goblin, target);
      if (!entity) {
        ctx.manager._onResourceContention(goblin, target.entityId);
        goblin.currentAction = null;
        return;
      }

      // Resource consumed by another goblin — bail out
      if (entity.type === 'gold' && entity.state !== 'FULL') {
        ctx.manager._onResourceContention(goblin, target.entityId);
        goblin.currentAction = null;
        return;
      }
      if (entity.type === 'drop_gold' && entity.state !== 'GROUND') {
        ctx.manager._onResourceContention(goblin, target.entityId);
        goblin.currentAction = null;
        return;
      }

      if (entity.type === 'gold' && entity.typeDef.mine) {
        goblin.actionTimer += ctx.delta;
        ctx.manager._setAnimation(goblin, 'interact', 'pickaxe');
        goblin.carry = 'pickaxe';
        if (goblin.actionTimer >= goblin.getEffectiveGatherTime('mining')) {
          entity.typeDef.mine(entity, ctx.resources._makeContext(ctx.delta));
          ctx.manager._recordHarvest(entity.id, goblin.id);
          goblin.actionTimer = 0.01; // Stay committed — flow into pickup phase
          goblin.carry = 'none';
          ctx.manager._scanResources(goblin); // Discover the new drop
          const levelUp = goblin.addSkillXP('mining');
          if (levelUp) {
            ctx.manager.showFloat(goblin, `\u2B06 Mining ${['I','II','III','IV','V'][levelUp-1]}`, 0xffcc00);
            if (ctx.manager.narrator) ctx.manager.narrator.log(`${goblin.name} reached Mining ${['I','II','III','IV','V'][levelUp-1]}!`, 0xffcc00);
          }
          console.log(`[Goblin #${goblin.id}] Mined gold at (${entity.col},${entity.row})`);
        }
      } else if (entity.type === 'drop_gold' && entity.typeDef.pickup) {
        entity.typeDef.pickup(entity, ctx.resources._makeContext(ctx.delta));
        goblin.inventory.gold++;
        goblin.carry = 'gold';
        goblin.actionTimer = 0;
        goblin.currentAction = null;
        ctx.manager.showFloat(goblin, '+1 gold', 0xffcc00);
        console.log(`[Goblin #${goblin.id}] Picked up gold (total: ${goblin.inventory.gold})`);
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
          goblin.setActionCooldown('gather_gold', 60);
          goblin.currentAction = null;
        }
      });
    }
  },
};
