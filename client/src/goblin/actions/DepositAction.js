/**
 * Bring resources back to camp stockpile.
 * Triggers when inventory has items, scores higher when full.
 */
export const DepositAction = {
  name: 'deposit',

  score(goblin, ctx) {
    if (!ctx.camp) return 0;
    const total = goblin.getInventoryTotal();
    if (total === 0) return 0;

    // Full inventory — urgent deposit
    if (total >= goblin.traits.carry_capacity) return 0.7;

    // Scales with fullness: 1/3 = 0.07, 2/3 = 0.13 (won't beat gathering)
    const fullness = total / goblin.traits.carry_capacity;
    return 0.07 + 0.13 * fullness;
  },

  execute(goblin, ctx) {
    if (!ctx.camp || goblin.getInventoryTotal() === 0) {
      goblin.currentAction = null;
      return;
    }

    const dist = Math.abs(ctx.camp.col - goblin.col) + Math.abs(ctx.camp.row - goblin.row);

    // At camp — deposit everything
    if (dist <= 1 && !goblin.path) {
      const m = goblin.inventory.meat, w = goblin.inventory.wood, g = goblin.inventory.gold;
      ctx.camp.deposit(goblin.inventory);
      goblin.inventory.meat = 0;
      goblin.inventory.wood = 0;
      goblin.inventory.gold = 0;
      goblin.carry = 'none';
      goblin.currentAction = null;
      // Curiosity burst — completing a cycle sparks wanderlust
      goblin.drives.curiosity = Math.min(1, goblin.drives.curiosity + 0.15);
      console.log(`[Goblin #${goblin.id}] Deposited at camp → M${m} W${w} G${g}`);
      return;
    }

    // Walk to camp (ignoreFog — goblins always know the way home)
    if (!goblin.path && !goblin._pathPending) {
      goblin._pathPending = true;
      ctx.pathfinder.request(goblin, ctx.camp.col, ctx.camp.row, (path) => {
        goblin._pathPending = false;
        if (path && path.length > 1) {
          goblin.path = path;
          goblin.pathIndex = 1;
          goblin._depositFails = 0;
        } else {
          // Path to camp failed (water barrier?) — cooldown prevents tight loop
          goblin._depositFails = (goblin._depositFails || 0) + 1;
          if (goblin._depositFails >= 3) {
            // Give up — drop inventory (items lost)
            console.log(`[Goblin #${goblin.id}] Can't reach camp after 3 tries — dropping inventory`);
            goblin.inventory.meat = 0;
            goblin.inventory.wood = 0;
            goblin.inventory.gold = 0;
            goblin.carry = 'none';
            goblin._depositFails = 0;
          }
          goblin.setActionCooldown('deposit', 120);
          goblin.currentAction = null;
        }
      }, { ignoreFog: true });
    }
  },
};
