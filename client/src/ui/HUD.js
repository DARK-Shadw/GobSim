import { Container, Text, Graphics } from 'pixi.js';

const FONT_STYLE = {
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 3 },
};

const FONT_STYLE_SMALL = {
  ...FONT_STYLE,
  fontSize: 14,
};

/**
 * Head-up display: world name, day counter, seed badge.
 * Positioned in the UI container (not affected by camera).
 */
export class HUD {
  constructor(app, worldName, dayCount = 0) {
    this.container = new Container({ label: 'hud' });
    this.worldName = worldName;
    this.dayCount = dayCount;

    // Semi-transparent top bar background
    this._bg = new Graphics();
    this._bg.roundRect(0, 0, 360, 52, 8);
    this._bg.fill({ color: 0x000000, alpha: 0.5 });
    this._bg.x = 10;
    this._bg.y = 10;
    this.container.addChild(this._bg);

    // World name text
    this._nameText = new Text({
      text: `The World of ${worldName}`,
      style: FONT_STYLE,
    });
    this._nameText.x = 22;
    this._nameText.y = 16;
    this.container.addChild(this._nameText);

    // Day + Seed text
    this._infoText = new Text({
      text: `Day ${dayCount}`,
      style: FONT_STYLE_SMALL,
    });
    this._infoText.x = 22;
    this._infoText.y = 38;
    this.container.addChild(this._infoText);

    // Speed indicator
    this._speedText = new Text({
      text: '',
      style: { ...FONT_STYLE_SMALL, fontSize: 13, fill: 0xffcc44 },
    });
    this._speedText.anchor.set(1, 0);
    this.container.addChild(this._speedText);

    // Screenshot hint
    this._hintText = new Text({
      text: '[P] Screenshot  [1-4] Speed',
      style: { ...FONT_STYLE_SMALL, fontSize: 12, fill: 0xaaaaaa },
    });
    this._hintText.anchor.set(1, 0);
    this.container.addChild(this._hintText);

    app.uiContainer.addChild(this.container);
    this._onResize(app);

    window.addEventListener('resize', () => this._onResize(app));
  }

  _onResize(app) {
    const screen = app.pixi.screen;
    this._speedText.x = screen.width - 16;
    this._speedText.y = 16;
    this._hintText.x = screen.width - 16;
    this._hintText.y = 32;
  }

  setDay(day, phaseIcon) {
    this.dayCount = day;
    const icon = phaseIcon || '';
    this._infoText.text = icon ? `${icon} Day ${day}` : `Day ${day}`;
  }

  setDayNight(dayNight) {
    this._infoText.text = `${dayNight.getPhaseIcon()} Day ${dayNight.dayCount}`;
  }

  setSpeed(speed) {
    if (speed === 0) {
      this._speedText.text = '\u23F8 Paused';
    } else if (speed === 1) {
      this._speedText.text = '\u25B6 1x';
    } else {
      this._speedText.text = '\u25B6'.repeat(Math.min(speed, 3)) + ` ${speed}x`;
    }
  }
}
