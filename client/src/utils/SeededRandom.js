/**
 * Mulberry32 — fast 32-bit seeded PRNG.
 * Same seed always produces the same sequence.
 */
export class SeededRandom {
  constructor(seed) {
    this._seed = seed | 0;
    this._state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next() {
    let t = (this._state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max) */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /** Returns a float in [min, max) */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  /** Fisher-Yates shuffle (in-place) */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Create from a string (hashes the string to a seed) */
  static fromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return new SeededRandom(hash);
  }

  get seed() {
    return this._seed;
  }
}
