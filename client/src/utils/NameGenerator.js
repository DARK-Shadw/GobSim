import { SeededRandom } from './SeededRandom.js';

const PREFIXES = [
  'Grim', 'Moss', 'Dusk', 'Iron', 'Black', 'Storm', 'Shade', 'Thorn',
  'Ember', 'Ash', 'Stone', 'Frost', 'Dark', 'Wild', 'Bone', 'Crow',
  'Mist', 'Rust', 'Gold', 'Fang', 'Raven', 'Briar', 'Wolf', 'Oak',
];

const SUFFIXES = [
  'hollow', 'fen', 'barrow', 'reach', 'vale', 'peak', 'marsh', 'haven',
  'moor', 'dell', 'crag', 'keep', 'ford', 'glen', 'wood', 'gate',
  'ridge', 'fall', 'brook', 'deep', 'hold', 'shire', 'field', 'stone',
];

/**
 * Generate a seed-deterministic fantasy world name.
 * Same seed always produces the same name.
 */
export function generateWorldName(seed) {
  const rng = new SeededRandom(seed + 12345);
  const prefix = PREFIXES[rng.nextInt(0, PREFIXES.length)];
  const suffix = SUFFIXES[rng.nextInt(0, SUFFIXES.length)];
  return prefix + suffix;
}
