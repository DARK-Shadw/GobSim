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
    if (drop) {
      const dist = Math.abs(drop.col - goblin.col) + Math.abs(drop.row - goblin.row);
      return 0.3 * Math.max(0.1, 1 - dist / 30);
    }

    const tree = ctx.manager.findInMemory(goblin, 'tree', 'GROWN');
    if (tree) {
      const dist = Math.abs(tree.col - goblin.col) + Math.abs(tree.row - goblin.row);
      return 0.2 * Math.max(0.1, 1 - dist / 30);
    }

    return 0;
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

      if (entity.type === 'tree' && entity.typeDef.chop) {
        goblin.actionTimer += ctx.delta;
        ctx.manager._setAnimation(goblin, 'interact', 'axe');
        goblin.carry = 'axe';
        if (goblin.actionTimer >= goblin.getEffectiveGatherTime()) {
          entity.typeDef.chop(entity, ctx.resources._makeContext(ctx.delta));
          goblin.actionTimer = 0.01; // Stay committed — flow into pickup phase
          goblin.carry = 'none';
          ctx.manager._scanResources(goblin); // Discover the new drop
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
      ctx.pathfinder.request(goblin, target.col, target.row, (path) => {
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
