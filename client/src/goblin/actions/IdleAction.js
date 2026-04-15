/**
 * Fallback action: stand around doing nothing.
 * Lowest-scoring action — only wins when nothing else is viable.
 */
export const IdleAction = {
  name: 'idle',

  score(goblin, ctx) {
    return 0.05;
  },

  execute(goblin, ctx) {
    // Do nothing — just stand idle
  },
};
