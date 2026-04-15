import { Text } from 'pixi.js';

const FLOAT_DURATION = 60; // frames (~1 second at 60fps)
const FLOAT_HEIGHT = 40;   // pixels to float upward

const FONT = {
  fontFamily: 'Georgia, serif',
  fontSize: 12,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
  fontWeight: 'bold',
};

/**
 * Manages floating text popups ("+1 wood", "+0.4 hunger", etc.)
 * that appear in world space, float upward, and fade out.
 */
export class FloatingTextManager {
  constructor(container) {
    this.container = container;
    this._popups = [];
  }

  /**
   * Spawn a floating text popup.
   * @param {string} message - Text to show
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} [color=0xffffff] - Text color
   */
  spawn(message, x, y, color) {
    const text = new Text({
      text: message,
      style: { ...FONT, fill: color || 0xffffff },
    });
    text.anchor.set(0.5, 1);
    text.x = x;
    text.y = y;
    text.zIndex = y + 10000;
    this.container.addChild(text);

    this._popups.push({
      text,
      startX: x,
      startY: y,
      frame: 0,
    });
  }

  update() {
    const toRemove = [];

    for (const popup of this._popups) {
      popup.frame++;
      const t = popup.frame / FLOAT_DURATION;
      popup.text.y = popup.startY - FLOAT_HEIGHT * t;
      popup.text.alpha = 1 - t;

      if (popup.frame >= FLOAT_DURATION) {
        toRemove.push(popup);
      }
    }

    for (const popup of toRemove) {
      const idx = this._popups.indexOf(popup);
      if (idx >= 0) this._popups.splice(idx, 1);
      this.container.removeChild(popup.text);
      popup.text.destroy();
    }
  }
}
