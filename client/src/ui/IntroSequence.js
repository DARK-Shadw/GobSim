import { Container, Text, Graphics } from 'pixi.js';
import { TILE_SIZE } from '@shared/constants.js';

/**
 * Cinematic intro: camera pans across the island while text overlay fades in.
 * Skippable by clicking or pressing any key.
 */
export class IntroSequence {
  constructor(app, camera, world, worldName, spawnPos) {
    this.app = app;
    this.camera = camera;
    this.done = false;
    this._elapsed = 0;
    this._duration = 8000; // ms
    this._skipped = false;

    // Use goblin spawn position if provided, otherwise scenic spot
    const target = spawnPos || world.findScenicSpot();
    const cx = target.col * TILE_SIZE;
    const cy = target.row * TILE_SIZE;
    this._startX = cx - 200;
    this._startY = cy - 100;
    this._endX = cx + 200;
    this._endY = cy + 50;
    this._startZoom = 1.2;
    this._endZoom = 0.6;

    // Lock camera and set initial position
    camera.locked = true;
    camera.snapTo(this._startX, this._startY, this._startZoom);

    // Text overlay container (in UI layer)
    this.overlay = new Container({ label: 'intro-overlay' });
    this.overlay.alpha = 0;

    // Dark backdrop
    const backdrop = new Graphics();
    const screen = app.pixi.screen;
    backdrop.rect(0, screen.height / 2 - 80, screen.width, 160);
    backdrop.fill({ color: 0x000000, alpha: 0.6 });
    this.overlay.addChild(backdrop);

    // Title text
    const title = new Text({
      text: `The World of ${worldName}`,
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 36,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 4 },
        align: 'center',
      },
    });
    title.anchor.set(0.5, 0.5);
    title.x = screen.width / 2;
    title.y = screen.height / 2 - 30;
    this.overlay.addChild(title);

    // Flavor text
    const flavor = new Text({
      text: 'A new world awaits its first inhabitants...',
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fill: 0x999999,
        fontStyle: 'italic',
        align: 'center',
      },
    });
    flavor.anchor.set(0.5, 0.5);
    flavor.x = screen.width / 2;
    flavor.y = screen.height / 2 + 14;
    this.overlay.addChild(flavor);

    // "Click to skip" hint
    const skip = new Text({
      text: 'Click or press any key to skip',
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        fill: 0x666666,
        align: 'center',
      },
    });
    skip.anchor.set(0.5, 0);
    skip.x = screen.width / 2;
    skip.y = screen.height / 2 + 42;
    this.overlay.addChild(skip);

    app.uiContainer.addChild(this.overlay);

    // Skip handlers
    const onSkip = () => this._skip();
    window.addEventListener('keydown', onSkip, { once: true });
    app.pixi.canvas.addEventListener('pointerdown', onSkip, { once: true });
  }

  _skip() {
    if (this._skipped) return;
    this._skipped = true;
    this._elapsed = this._duration;
  }

  /**
   * Update intro animation. Returns true when complete.
   * @param {number} deltaMs - Elapsed ms since last frame
   */
  update(deltaMs) {
    if (this.done) return true;

    this._elapsed += deltaMs;
    const t = Math.min(this._elapsed / this._duration, 1);

    // Ease function (smooth ease-in-out)
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Pan camera
    const x = this._startX + (this._endX - this._startX) * ease;
    const y = this._startY + (this._endY - this._startY) * ease;
    const zoom = this._startZoom + (this._endZoom - this._startZoom) * ease;
    this.camera.snapTo(x, y, zoom);

    // Fade in text (first 20% of duration)
    const fadeIn = Math.min(t / 0.2, 1);
    // Fade out text (last 15% of duration)
    const fadeOut = t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
    this.overlay.alpha = fadeIn * fadeOut;

    if (t >= 1) {
      this.done = true;
      this.camera.locked = false;
      this.camera.moveTo(this._endX, this._endY, this._endZoom);
      this.overlay.alpha = 0;
      this.overlay.destroy({ children: true });
      this.app.pixi.canvas.style.cursor = 'grab';
    }

    return this.done;
  }
}
