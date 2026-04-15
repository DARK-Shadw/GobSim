import {
  TILE_SIZE, WORLD_COLS, WORLD_ROWS,
  CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM, CAMERA_EASE, CAMERA_DEFAULT_ZOOM,
} from '@shared/constants.js';

const WORLD_W = WORLD_COLS * TILE_SIZE;
const WORLD_H = WORLD_ROWS * TILE_SIZE;

/**
 * Camera — smooth drag-pan + scroll-zoom with bounds clamping.
 *
 * The camera controls worldContainer's position and scale.
 * Camera (x, y) represents the world-space point at the center of the screen.
 */
export class Camera {
  constructor(app) {
    this.app = app;
    this.worldContainer = app.worldContainer;

    // Current state
    this.x = WORLD_W / 2;
    this.y = WORLD_H / 2;
    this.zoom = CAMERA_DEFAULT_ZOOM;

    // Target state (camera lerps toward these)
    this.targetX = this.x;
    this.targetY = this.y;
    this.targetZoom = this.zoom;

    // Drag state
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._camStartX = 0;
    this._camStartY = 0;

    // Cinematic lock — when true, user input is ignored
    this.locked = false;

    // Shake offsets (set externally for VFX)
    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;

    this._bindInput();
    this._applyTransform();
  }

  _bindInput() {
    const canvas = this.app.pixi.canvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (this.locked) return;
      this._dragging = true;
      this._dragStartX = e.clientX;
      this._dragStartY = e.clientY;
      this._camStartX = this.targetX;
      this._camStartY = this.targetY;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = (e.clientX - this._dragStartX) / this.zoom;
      const dy = (e.clientY - this._dragStartY) / this.zoom;
      this.targetX = this._camStartX - dx;
      this.targetY = this._camStartY - dy;
      this._clampTarget();
    });

    window.addEventListener('pointerup', () => {
      if (this._dragging) {
        this._dragging = false;
        canvas.style.cursor = this.locked ? 'default' : 'grab';
      }
    });

    canvas.addEventListener('wheel', (e) => {
      if (this.locked) return;
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.targetZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM,
        this.targetZoom * zoomFactor
      ));
    }, { passive: false });

    canvas.style.cursor = 'grab';
  }

  _clampTarget() {
    const screen = this.app.pixi.screen;
    const halfW = (screen.width / this.targetZoom) / 2;
    const halfH = (screen.height / this.targetZoom) / 2;

    this.targetX = Math.max(halfW, Math.min(WORLD_W - halfW, this.targetX));
    this.targetY = Math.max(halfH, Math.min(WORLD_H - halfH, this.targetY));
  }

  /**
   * Lerp camera toward target. Call once per frame.
   */
  update() {
    this.x += (this.targetX - this.x) * CAMERA_EASE;
    this.y += (this.targetY - this.y) * CAMERA_EASE;
    this.zoom += (this.targetZoom - this.zoom) * CAMERA_EASE;

    this._applyTransform();
  }

  _applyTransform() {
    const screen = this.app.pixi.screen;
    this.worldContainer.scale.set(this.zoom);
    this.worldContainer.x = screen.width / 2 - this.x * this.zoom + this._shakeOffsetX;
    this.worldContainer.y = screen.height / 2 - this.y * this.zoom + this._shakeOffsetY;
  }

  /**
   * Returns the visible world-space rectangle for viewport culling.
   */
  getViewBounds() {
    const screen = this.app.pixi.screen;
    const w = screen.width / this.zoom;
    const h = screen.height / this.zoom;
    return {
      x: this.x - w / 2,
      y: this.y - h / 2,
      width: w,
      height: h,
    };
  }

  /**
   * Smoothly move camera to a world-space position.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} [zoom] - Optional target zoom
   */
  moveTo(x, y, zoom) {
    this.targetX = x;
    this.targetY = y;
    if (zoom !== undefined) this.targetZoom = zoom;
    this._clampTarget();
  }

  /**
   * Instantly snap camera (no easing).
   */
  snapTo(x, y, zoom) {
    this.targetX = x;
    this.targetY = y;
    this.x = x;
    this.y = y;
    if (zoom !== undefined) {
      this.targetZoom = zoom;
      this.zoom = zoom;
    }
    this._clampTarget();
    this._applyTransform();
  }
}
