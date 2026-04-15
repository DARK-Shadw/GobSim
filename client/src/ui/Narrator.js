import { Container, Text } from 'pixi.js';

const MAX_LINES = 5;
const FADE_DURATION = 2000; // ms to fade out
const LINE_LIFETIME = 6000; // ms before starting fade

const FONT = {
  fontFamily: 'Georgia, serif',
  fontSize: 13,
  fill: 0xdddddd,
  stroke: { color: 0x000000, width: 3 },
  wordWrap: true,
  wordWrapWidth: 360,
};

/**
 * Scrolling event narrator — RPG-style combat log in the bottom-left.
 * Each entry fades out after a few seconds.
 */
export class Narrator {
  constructor(app) {
    this.app = app;
    this.container = new Container({ label: 'narrator' });
    this._entries = []; // { text: Text, createdAt: number }

    app.uiContainer.addChild(this.container);
    this._reposition();
    window.addEventListener('resize', () => this._reposition());
  }

  _reposition() {
    const screen = this.app.pixi.screen;
    this.container.x = 16;
    this.container.y = screen.height - 24;
  }

  /**
   * Add a narration entry.
   * @param {string} message - The text to display
   * @param {number} [color=0xdddddd] - Text color
   */
  log(message, color) {
    const text = new Text({
      text: message,
      style: { ...FONT, fill: color || 0xdddddd },
    });
    text.anchor.set(0, 1);

    const entry = { text, createdAt: performance.now() };
    this._entries.push(entry);
    this.container.addChild(text);

    // Remove oldest if over limit
    while (this._entries.length > MAX_LINES) {
      const old = this._entries.shift();
      this.container.removeChild(old.text);
      old.text.destroy();
    }

    this._layout();
  }

  update() {
    const now = performance.now();
    const toRemove = [];

    for (const entry of this._entries) {
      const age = now - entry.createdAt;
      if (age > LINE_LIFETIME) {
        const fadeProgress = (age - LINE_LIFETIME) / FADE_DURATION;
        entry.text.alpha = Math.max(0, 1 - fadeProgress);
        if (fadeProgress >= 1) toRemove.push(entry);
      }
    }

    for (const entry of toRemove) {
      const idx = this._entries.indexOf(entry);
      if (idx >= 0) this._entries.splice(idx, 1);
      this.container.removeChild(entry.text);
      entry.text.destroy();
    }

    if (toRemove.length > 0) this._layout();
  }

  _layout() {
    let y = 0;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const entry = this._entries[i];
      y -= entry.text.height + 3;
      entry.text.x = 0;
      entry.text.y = y;
    }
  }
}
