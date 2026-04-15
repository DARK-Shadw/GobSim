import { GENOME } from '@shared/constants.js';

/**
 * Create a random genome — each key is a float in [GENOME.MIN, GENOME.MAX].
 * These multiply GOBLIN_DEFAULTS to produce per-goblin traits.
 */
export function createRandomGenome(rng) {
  const genome = {};
  for (const key of GENOME.KEYS) {
    genome[key] = rng.nextFloat(GENOME.MIN, GENOME.MAX);
  }
  return genome;
}

/**
 * Placeholder for Phase 5 — crossover + mutation from two parents.
 */
export function createGenomeFromParents(parentA, parentB, rng) {
  return createRandomGenome(rng);
}
