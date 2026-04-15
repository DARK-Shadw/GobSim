/**
 * Rest to recover stamina. Happens in place — no walking to camp.
 * This is the "catch your breath" action, not sleep.
 */
export const RestAction = {
  name: 'rest',

  score(goblin, ctx) {
    // Only rest when stamina is actually low — don't rest at 70%
    if (goblin.drives.stamina > 0.4) return 0;
    const urgency = goblin.getStaminaUrgency();
    return urgency * 0.45;
  },

  execute(goblin, ctx) {
    ctx.manager._setAnimation(goblin, 'idle', goblin.carry);

    // Stamina recovery handled by _tickDrives when action === 'rest'
    const maxStamina = goblin.getEffectiveMaxStamina();
    if (goblin.drives.stamina > maxStamina * 0.8) {
      goblin.currentAction = null;
      console.log(`[Goblin #${goblin.id}] Caught breath — stamina: ${goblin.drives.stamina.toFixed(2)}`);
    }
  },
};
