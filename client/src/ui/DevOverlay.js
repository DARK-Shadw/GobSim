import { Container, Text, Graphics, Sprite } from 'pixi.js';
import { TILE_SIZE, WORLD_COLS, WORLD_ROWS } from '@shared/constants.js';

const FONT = {
  fontFamily: 'Consolas, monospace',
  fontSize: 12,
  fill: 0x00ff88,
};

const FONT_HIGHLIGHT = { ...FONT, fill: 0xffff66 };

const PAD = 8;
const LINE_H = 16;
const SELECT_BOX_BASE = 128; // native size of Cursor_04.png

/**
 * Dev overlay toggled with ` (backtick) or F3.
 * Shows FPS, cursor tile, resource counts, and click-to-inspect entity info.
 * Right-click an entity to inspect — draws a select box and camera follows it.
 */
export class DevOverlay {
  constructor(app, camera, resources) {
    this.app = app;
    this.camera = camera;
    this.resources = resources;
    this.visible = false;

    // Track mouse in screen space
    this._mouseX = 0;
    this._mouseY = 0;
    this._inspected = null; // entity id currently inspected
    this._following = false; // camera tracking active

    // Container lives in UI layer (camera-independent)
    this.container = new Container({ label: 'dev-overlay' });
    this.container.visible = false;

    // Background panel
    this._bg = new Graphics();
    this.container.addChild(this._bg);

    // Text lines
    this._headerText = new Text({ text: 'DEV', style: FONT_HIGHLIGHT });
    this._headerText.x = PAD;
    this._headerText.y = PAD;
    this.container.addChild(this._headerText);

    this._bodyText = new Text({ text: '', style: FONT });
    this._bodyText.x = PAD;
    this._bodyText.y = PAD + LINE_H + 4;
    this.container.addChild(this._bodyText);

    // Inspect panel (right side, shown on click)
    this._inspectBg = new Graphics();
    this._inspectBg.visible = false;
    this.container.addChild(this._inspectBg);

    this._inspectText = new Text({ text: '', style: FONT });
    this._inspectText.visible = false;
    this.container.addChild(this._inspectText);

    // Select box sprite — lives in world container so it moves with camera
    this._selectBox = new Sprite(app.textures.ui_select_box);
    this._selectBox.anchor.set(0.5, 0.5);
    this._selectBox.visible = false;
    this._selectBox.zIndex = 999999;
    app.worldContainer.addChild(this._selectBox);

    app.uiContainer.addChild(this.container);

    this._bindInput();
    this._positionPanel(app);
    window.addEventListener('resize', () => this._positionPanel(app));
  }

  _bindInput() {
    const canvas = this.app.pixi.canvas;

    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      this._mouseX = e.clientX;
      this._mouseY = e.clientY;
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.visible) return;
      // Right-click or ctrl+click to inspect
      if (e.button === 2 || e.ctrlKey) {
        e.preventDefault();
        this._inspectAt(e.clientX, e.clientY);
      } else if (e.button === 0 && this._following) {
        // Left-click drag breaks camera follow (keep inspect panel open)
        this._following = false;
      }
    });

    // Prevent context menu on right-click when overlay is active
    canvas.addEventListener('contextmenu', (e) => {
      if (this.visible) e.preventDefault();
    });
  }

  _positionPanel(app) {
    const screen = app.pixi.screen;
    // Bottom-left corner
    this.container.x = 10;
    this.container.y = screen.height - 10;
  }

  toggle() {
    this.visible = !this.visible;
    this.container.visible = this.visible;
    if (!this.visible) {
      this._clearInspect();
    }
  }

  _clearInspect() {
    this._inspected = null;
    this._following = false;
    this._inspectBg.visible = false;
    this._inspectText.visible = false;
    this._selectBox.visible = false;
  }

  _screenToWorld(sx, sy) {
    const wc = this.app.worldContainer;
    const wx = (sx - wc.x) / wc.scale.x;
    const wy = (sy - wc.y) / wc.scale.y;
    return { wx, wy };
  }

  _worldToTile(wx, wy) {
    const col = Math.floor(wx / TILE_SIZE);
    const row = Math.floor(wy / TILE_SIZE);
    return { col, row };
  }

  _inspectAt(sx, sy) {
    const { wx, wy } = this._screenToWorld(sx, sy);
    const { col, row } = this._worldToTile(wx, wy);

    // Search the clicked tile and adjacent tiles for entities
    const entity = this.resources.getResourceAt(col, row)
      || this.resources.getResourceAt(col - 1, row)
      || this.resources.getResourceAt(col + 1, row)
      || this.resources.getResourceAt(col, row - 1)
      || this.resources.getResourceAt(col, row + 1);

    if (entity) {
      this._inspected = entity.id;
      this._following = true;
      this._selectBox.visible = true;
    } else {
      this._clearInspect();
    }
  }

  update() {
    if (!this.visible) return;

    const ticker = this.app.pixi.ticker;
    const fps = Math.round(ticker.FPS);

    // Cursor tile
    const { wx, wy } = this._screenToWorld(this._mouseX, this._mouseY);
    const { col, row } = this._worldToTile(wx, wy);
    const inBounds = col >= 0 && col < WORLD_COLS && row >= 0 && row < WORLD_ROWS;
    const tileStr = inBounds ? `${col}, ${row}` : 'out of bounds';

    // Resource counts
    const counts = this.resources.getAllCounts();
    const countLines = Object.entries(counts)
      .filter(([, c]) => c.initial > 0 || c.current > 0)
      .map(([type, c]) => `  ${type}: ${c.current}/${c.initial}`)
      .join('\n');

    // Entity count
    const totalEntities = this.resources._entities.size;

    const lines = [
      `FPS: ${fps}`,
      `Tile: ${tileStr}`,
      `World: ${wx.toFixed(0)}, ${wy.toFixed(0)}`,
      `Zoom: ${this.camera.zoom.toFixed(2)}`,
      ``,
      `Entities: ${totalEntities}`,
      countLines,
      ``,
      `[Right-click to inspect]`,
    ];

    this._bodyText.text = lines.join('\n');

    // Resize background to fit text
    const textH = PAD + LINE_H + 4 + this._bodyText.height + PAD;
    const textW = Math.max(180, this._bodyText.width + PAD * 2);
    this._bg.clear();
    this._bg.roundRect(0, 0, textW, textH, 4);
    this._bg.fill({ color: 0x000000, alpha: 0.75 });

    // Position from bottom-left (container.y is at screen bottom)
    this.container.y = this.app.pixi.screen.height - 10 - textH;

    // Inspect panel
    this._updateInspectPanel(textW);
  }

  _updateInspectPanel(mainWidth) {
    if (!this._inspected) {
      this._inspectBg.visible = false;
      this._inspectText.visible = false;
      this._selectBox.visible = false;
      return;
    }

    const entity = this.resources.getEntity(this._inspected);
    if (!entity || !entity.alive) {
      this._clearInspect();
      return;
    }

    // Position and scale the select box around the entity's sprite
    const sprite = entity.sprite;
    if (sprite) {
      // Estimate the sprite's visual size to scale the box around it
      const spriteH = sprite.height / Math.abs(sprite.scale.y);
      const boxSize = Math.max(spriteH, TILE_SIZE) * 1.3;
      const scale = boxSize / SELECT_BOX_BASE;
      this._selectBox.scale.set(scale);
      this._selectBox.x = entity.px;
      this._selectBox.y = entity.py - boxSize * 0.4; // center vertically on sprite
      this._selectBox.visible = true;
    }

    // Camera follows the inspected entity
    if (this._following) {
      this.camera.moveTo(entity.px, entity.py);
    }

    const lines = [
      `--- Inspect ---`,
      `ID: ${entity.id}`,
      `Type: ${entity.type}`,
      `State: ${entity.state}`,
      `Timer: ${Math.round(entity.stateTimer)}`,
      `Pos: ${entity.col}, ${entity.row}`,
      `Pixel: ${entity.px.toFixed(1)}, ${entity.py.toFixed(1)}`,
      `Home: ${entity.homeCol}, ${entity.homeRow}`,
    ];

    // Show type-specific data
    if (entity.data && Object.keys(entity.data).length > 0) {
      for (const [k, v] of Object.entries(entity.data)) {
        if (k === 'frames' || k === 'frameH') continue; // skip bulky cached data
        const display = typeof v === 'number' ? v.toFixed(1) : String(v);
        lines.push(`${k}: ${display}`);
      }
    }

    this._inspectText.text = lines.join('\n');
    this._inspectText.visible = true;
    this._inspectText.x = mainWidth + PAD + PAD;
    this._inspectText.y = PAD;

    const iw = this._inspectText.width + PAD * 2;
    const ih = this._inspectText.height + PAD * 2;
    this._inspectBg.clear();
    this._inspectBg.roundRect(0, 0, iw, ih, 4);
    this._inspectBg.fill({ color: 0x000000, alpha: 0.75 });
    this._inspectBg.x = mainWidth + PAD;
    this._inspectBg.y = 0;
    this._inspectBg.visible = true;
  }
}
