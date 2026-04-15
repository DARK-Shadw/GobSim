import { WATER_BG_COLOR } from '@shared/constants.js';

/**
 * Screenshot capture with watermark overlay.
 * Uses PixiJS extract API (WebGL toDataURL returns black without preserveDrawingBuffer).
 * Hotkey: 'P'
 */
export class Screenshot {
  constructor(app, worldName) {
    this.app = app;
    this.worldName = worldName;
    this.dayCount = 0;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        this.capture();
      }
    });
  }

  setDay(day) {
    this.dayCount = day;
  }

  async capture() {
    const renderer = this.app.pixi.renderer;
    const stage = this.app.pixi.stage;

    // Use PixiJS extract to get the rendered frame (avoids WebGL buffer clearing issue)
    const extractedCanvas = renderer.extract.canvas({ target: stage });
    const w = extractedCanvas.width;
    const h = extractedCanvas.height;

    // Create offscreen canvas for compositing with watermark
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Fill with ocean background color (extract API doesn't capture PixiJS background)
    const bgHex = WATER_BG_COLOR.toString(16).padStart(6, '0');
    ctx.fillStyle = `#${bgHex}`;
    ctx.fillRect(0, 0, w, h);

    // Draw extracted game frame on top
    ctx.drawImage(extractedCanvas, 0, 0);

    // Watermark text
    const text = `GobSim — World of ${this.worldName} — Day ${this.dayCount}`;

    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Semi-transparent backdrop
    const metrics = ctx.measureText(text);
    const textW = metrics.width + 40;
    const textH = 36;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect((w - textW) / 2, h - textH - 10, textW, textH, 6);
    ctx.fill();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeText(text, w / 2, h - 16);
    ctx.fillText(text, w / 2, h - 16);

    // Download
    const link = document.createElement('a');
    link.download = `gobsim_${this.worldName}_day${this.dayCount}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    console.log('[Screenshot] Captured:', link.download);
  }
}
