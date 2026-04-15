import { DAY_NIGHT } from '@shared/constants.js';

const { CYCLE_TICKS, DAWN_START, DAY_START, DUSK_START, NIGHT_START } = DAY_NIGHT;

/**
 * Day/Night cycle — tracks time, provides phase info, lighting tints,
 * and multipliers that affect vision, fatigue, and hunger at night.
 */
export class DayNightCycle {
  constructor() {
    this._tick = 0;
    this.dayCount = 0;
    this.phase = 'dawn';
    this.isNight = false;
  }

  /** Advance the clock. Call once per frame. */
  update(delta) {
    this._tick += delta;

    if (this._tick >= CYCLE_TICKS) {
      this._tick -= CYCLE_TICKS;
      this.dayCount++;
    }

    const t = this._tick / CYCLE_TICKS; // 0–1 position in cycle

    if (t < DAY_START) {
      this.phase = 'dawn';
    } else if (t < DUSK_START) {
      this.phase = 'day';
    } else if (t < NIGHT_START) {
      this.phase = 'dusk';
    } else {
      this.phase = 'night';
    }

    this.isNight = this.phase === 'night';
  }

  /** 0–1 position within the full cycle. */
  getCycleProgress() {
    return this._tick / CYCLE_TICKS;
  }

  /** Vision multiplier: 1.0 during day, lerps to 0.5 at night. */
  getVisionMultiplier() {
    const t = this.getCycleProgress();
    if (t < DAY_START) {
      // Dawn: lerp from night→day
      return _lerp(DAY_NIGHT.NIGHT_VISION_MULT, 1.0, t / DAY_START);
    }
    if (t < DUSK_START) return 1.0;
    if (t < NIGHT_START) {
      // Dusk: lerp from day→night
      const p = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      return _lerp(1.0, DAY_NIGHT.NIGHT_VISION_MULT, p);
    }
    return DAY_NIGHT.NIGHT_VISION_MULT;
  }

  /** Fatigue rise multiplier: 1.0 during day, up to 2.0 at night. */
  getFatigueMultiplier() {
    const t = this.getCycleProgress();
    if (t < DAY_START) {
      return _lerp(DAY_NIGHT.NIGHT_FATIGUE_MULT, 1.0, t / DAY_START);
    }
    if (t < DUSK_START) return 1.0;
    if (t < NIGHT_START) {
      const p = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      return _lerp(1.0, DAY_NIGHT.NIGHT_FATIGUE_MULT, p);
    }
    return DAY_NIGHT.NIGHT_FATIGUE_MULT;
  }

  /** Hunger multiplier: 1.0 during day, 1.3 at night. */
  getHungerMultiplier() {
    const t = this.getCycleProgress();
    if (t < DAY_START) {
      return _lerp(DAY_NIGHT.NIGHT_HUNGER_MULT, 1.0, t / DAY_START);
    }
    if (t < DUSK_START) return 1.0;
    if (t < NIGHT_START) {
      const p = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      return _lerp(1.0, DAY_NIGHT.NIGHT_HUNGER_MULT, p);
    }
    return DAY_NIGHT.NIGHT_HUNGER_MULT;
  }

  /** Returns an integer tint for worldContainer. Smoothly lerps between phase tints. */
  getLightingTint() {
    const t = this.getCycleProgress();
    if (t < DAY_START) {
      return _lerpColor(DAY_NIGHT.TINT_NIGHT, DAY_NIGHT.TINT_DAWN, t / DAY_START);
    }
    if (t < (DAY_START + DUSK_START) / 2) {
      const p = (t - DAY_START) / ((DAY_START + DUSK_START) / 2 - DAY_START);
      return _lerpColor(DAY_NIGHT.TINT_DAWN, DAY_NIGHT.TINT_DAY, p);
    }
    if (t < DUSK_START) return DAY_NIGHT.TINT_DAY;
    if (t < NIGHT_START) {
      const p = (t - DUSK_START) / (NIGHT_START - DUSK_START);
      return _lerpColor(DAY_NIGHT.TINT_DUSK, DAY_NIGHT.TINT_NIGHT, p);
    }
    // Late night, stay at night tint until dawn approaches
    const nightLen = 1.0 - NIGHT_START;
    const duskP = (t - NIGHT_START) / nightLen;
    if (duskP < 0.5) return DAY_NIGHT.TINT_NIGHT;
    // Last half of night — slight warm shift toward dawn
    return _lerpColor(DAY_NIGHT.TINT_NIGHT, DAY_NIGHT.TINT_NIGHT, 1.0);
  }

  /** Phase icon for HUD display. */
  getPhaseIcon() {
    switch (this.phase) {
      case 'dawn': return '\u2600'; // ☀
      case 'day': return '\u2600';
      case 'dusk': return '\uD83C\uDF05'; // 🌅
      case 'night': return '\uD83C\uDF19'; // 🌙
      default: return '';
    }
  }
}

function _lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function _lerpColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
