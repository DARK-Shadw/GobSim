/**
 * Eat action: harvest a bush for berries OR eat carried meat.
 * Phases: find food → pathfind → interact animation → restore hunger.
 */
export const EatAction = {
  name: 'eat',

  score(goblin, ctx) {
    const urgency = goblin.getHungerUrgency();

    // Has meat in inventory — eat immediately, high priority
    if (goblin.inventory.meat > 0) {
      return urgency * 0.9;
    }

    // Know about a bush? Score based on urgency and proximity
    const bush = ctx.manager.findInMemory(goblin, 'bush', 'FULL');
    if (bush) {
      const dist = Math.abs(bush.col - goblin.col) + Math.abs(bush.row - goblin.row);
      const proximity = Math.max(0.1, 1 - dist / 30);
      return urgency * 0.7 * proximity;
    }

    // Know about dropped meat on ground?
    const meat = ctx.manager.findInMemory(goblin, 'drop_meat', 'GROUND');
    if (meat) {
      const dist = Math.abs(meat.col - goblin.col) + Math.abs(meat.row - goblin.row);
      const proximity = Math.max(0.1, 1 - dist / 30);
      return urgency * 0.8 * proximity;
    }

    return 0;
  },

  execute(goblin, ctx) {
    // Phase 1: Eat carried meat (no movement needed)
    if (goblin.inventory.meat > 0 && !goblin.path) {
      goblin.actionTimer += ctx.delta;
      ctx.manager._setAnimation(goblin, 'interact', 'knife');
      if (goblin.actionTimer >= goblin.traits.eat_time) {
        goblin.inventory.meat--;
        goblin.drives.hunger = Math.min(1, goblin.drives.hunger + 0.5);
        goblin.carry = goblin.getInventoryTotal() > 0 ? _getCarryType(goblin) : 'none';
        goblin.actionTimer = 0;
        goblin.currentAction = null;
        ctx.manager.showFloat(goblin, '+0.5 hunger', 0x44ff44);
        console.log(`[Goblin #${goblin.id}] Ate meat → hunger: ${goblin.drives.hunger.toFixed(2)}`);
      }
      return;
    }

    // Phase 2: Pick up dropped meat at feet
    const meatMem = ctx.manager.findInMemory(goblin, 'drop_meat', 'GROUND');
    if (meatMem && !goblin.path && goblin.col === meatMem.col && goblin.row === meatMem.row) {
      const entity = ctx.manager.verifyMemory(goblin, meatMem);
      if (entity && entity.typeDef.pickup) {
        entity.typeDef.pickup(entity, ctx.resources._makeContext(ctx.delta));
        goblin.inventory.meat++;
        goblin.carry = 'meat';
        console.log(`[Goblin #${goblin.id}] Picked up meat (total: ${goblin.inventory.meat})`);
      }
      goblin.currentAction = null;
      return;
    }

    // Phase 3: Find target — prefer dropped meat, then bush
    const bushMem = ctx.manager.findInMemory(goblin, 'bush', 'FULL');
    const target = meatMem || bushMem;
    if (!target) {
      goblin.currentAction = null;
      return;
    }

    // At target location
    if (!goblin.path && !goblin._pathPending && goblin.col === target.col && goblin.row === target.row) {
      const entity = ctx.manager.verifyMemory(goblin, target);
      if (!entity) {
        goblin.currentAction = null;
        return;
      }

      // Resource consumed by another goblin — bail out
      if (entity.type === 'bush' && entity.state !== 'FULL') {
        goblin.currentAction = null;
        return;
      }
      if (entity.type === 'drop_meat' && entity.state !== 'GROUND') {
        goblin.currentAction = null;
        return;
      }

      if (entity.type === 'bush' && entity.typeDef.harvest) {
        goblin.actionTimer += ctx.delta;
        ctx.manager._setAnimation(goblin, 'interact', 'knife');
        if (goblin.actionTimer >= goblin.getEffectiveGatherTime('foraging')) {
          entity.typeDef.harvest(entity, ctx.resources._makeContext(ctx.delta));
          goblin.drives.hunger = Math.min(1, goblin.drives.hunger + 0.4);
          goblin.actionTimer = 0;
          goblin.currentAction = null;
          ctx.manager.showFloat(goblin, '+0.4 hunger', 0x44ff44);
          const levelUp = goblin.addSkillXP('foraging');
          if (levelUp) {
            ctx.manager.showFloat(goblin, `\u2B06 Foraging ${['I','II','III','IV','V'][levelUp-1]}`, 0x44ff44);
            if (ctx.manager.narrator) ctx.manager.narrator.log(`${goblin.name} reached Foraging ${['I','II','III','IV','V'][levelUp-1]}!`, 0x44ff44);
          }
          console.log(`[Goblin #${goblin.id}] Ate bush → hunger: ${goblin.drives.hunger.toFixed(2)}`);
        }
      }
      return;
    }

    // Need to pathfind to target
    if (!goblin.path && !goblin._pathPending) {
      goblin._pathPending = true;
      const targetId = target.entityId;
      ctx.pathfinder.request(goblin, target.col, target.row, (path) => {
        goblin._pathPending = false;
        if (path && path.length > 1) {
          goblin.path = path;
          goblin.pathIndex = 1;
        } else {
          // Target unreachable — forget it and cooldown (shorter when starving)
          goblin.memory.delete(targetId);
          goblin.setActionCooldown('eat', goblin.drives.hunger < 0.21 ? 15 : 60);
          goblin.currentAction = null;
        }
      });
    }
  },
};

function _getCarryType(goblin) {
  if (goblin.inventory.gold > 0) return 'gold';
  if (goblin.inventory.wood > 0) return 'wood';
  if (goblin.inventory.meat > 0) return 'meat';
  return 'none';
}
