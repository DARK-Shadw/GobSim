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
  constructor(app, camera, resources, goblins) {
    this.app = app;
    this.camera = camera;
    this.resources = resources;
    this.goblins = goblins;
    this.visible = false;

    // Track mouse in screen space
    this._mouseX = 0;
    this._mouseY = 0;
    this._inspected = null; // { type: 'resource'|'goblin', id }
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

    // World-space graphics for goblin visualization
    this._worldGfx = new Graphics();
    this._worldGfx.zIndex = 999998;
    app.worldContainer.addChild(this._worldGfx);

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
    this._worldGfx.clear();
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

    // Check goblins first (search clicked tile and neighbors)
    const goblin = this.goblins.getGoblinAt(col, row)
      || this.goblins.getGoblinAt(col - 1, row)
      || this.goblins.getGoblinAt(col + 1, row)
      || this.goblins.getGoblinAt(col, row - 1)
      || this.goblins.getGoblinAt(col, row + 1);

    if (goblin) {
      this._inspected = { type: 'goblin', id: goblin.id };
      this._following = true;
      this._selectBox.visible = true;
      return;
    }

    // Then check resources
    const entity = this.resources.getResourceAt(col, row)
      || this.resources.getResourceAt(col - 1, row)
      || this.resources.getResourceAt(col + 1, row)
      || this.resources.getResourceAt(col, row - 1)
      || this.resources.getResourceAt(col, row + 1);

    if (entity) {
      this._inspected = { type: 'resource', id: entity.id };
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
    const goblinCount = this.goblins.getAllGoblins().size;

    const lines = [
      `FPS: ${fps}`,
      `Tile: ${tileStr}`,
      `World: ${wx.toFixed(0)}, ${wy.toFixed(0)}`,
      `Zoom: ${this.camera.zoom.toFixed(2)}`,
      ``,
      `Goblins: ${goblinCount}`,
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
    this._worldGfx.clear();

    if (!this._inspected) {
      this._inspectBg.visible = false;
      this._inspectText.visible = false;
      this._selectBox.visible = false;
      return;
    }

    if (this._inspected.type === 'goblin') {
      this._updateGoblinInspect(mainWidth);
    } else {
      this._updateResourceInspect(mainWidth);
    }
  }

  _updateResourceInspect(mainWidth) {
    const entity = this.resources.getEntity(this._inspected.id);
    if (!entity || !entity.alive) {
      this._clearInspect();
      return;
    }

    this._positionSelectBox(entity.sprite, entity.px, entity.py);

    if (this._following) {
      this.camera.moveTo(entity.px, entity.py);
    }

    const lines = [
      `--- Resource ---`,
      `ID: ${entity.id}`,
      `Type: ${entity.type}`,
      `State: ${entity.state}`,
      `Timer: ${Math.round(entity.stateTimer)}`,
      `Pos: ${entity.col}, ${entity.row}`,
      `Pixel: ${entity.px.toFixed(1)}, ${entity.py.toFixed(1)}`,
      `Home: ${entity.homeCol}, ${entity.homeRow}`,
    ];

    if (entity.data && Object.keys(entity.data).length > 0) {
      for (const [k, v] of Object.entries(entity.data)) {
        if (k === 'frames' || k === 'frameH') continue;
        const display = typeof v === 'number' ? v.toFixed(1) : String(v);
        lines.push(`${k}: ${display}`);
      }
    }

    this._showInspectText(lines, mainWidth);
  }

  _updateGoblinInspect(mainWidth) {
    const goblin = this.goblins.getGoblin(this._inspected.id);
    if (!goblin || !goblin.alive) {
      this._clearInspect();
      return;
    }

    this._positionSelectBox(goblin.sprite, goblin.px, goblin.py);

    if (this._following) {
      this.camera.moveTo(goblin.px, goblin.py);
    }

    // Drive bar helper
    const bar = (val, w = 10) => {
      const filled = Math.round(val * w);
      return '[' + '|'.repeat(filled) + ' '.repeat(w - filled) + ']';
    };

    const d = goblin.drives;
    const inv = goblin.inventory;
    const explored = goblin.explored.reduce((sum, v) => sum + v, 0);

    const lines = [
      `--- Goblin #${goblin.id} ---`,
      `Pos: ${goblin.col}, ${goblin.row}`,
      `Action: ${goblin.currentAction?.name || 'none'}`,
      `Timer: ${Math.round(goblin.actionTimer)}`,
      ``,
      `Hunger:    ${bar(d.hunger)} ${d.hunger.toFixed(2)}`,
      `Stamina:   ${bar(d.stamina)} ${d.stamina.toFixed(2)}`,
      `Fatigue:   ${bar(d.fatigue)} ${d.fatigue.toFixed(2)}`,
      `Curiosity: ${bar(d.curiosity)} ${d.curiosity.toFixed(2)}`,
      `MaxStam:   ${goblin.getEffectiveMaxStamina().toFixed(2)}  Speed: ${goblin.getEffectiveSpeed().toFixed(2)}`,
      ``,
      `Inventory: M:${inv.meat} W:${inv.wood} G:${inv.gold}`,
      `Carry: ${goblin.carry}`,
      `Memory: ${goblin.memory.size} entries`,
      `Explored: ${explored} tiles`,
      `Path: ${goblin.path ? `${goblin.pathIndex}/${goblin.path.length}` : 'none'}`,
    ];

    this._showInspectText(lines, mainWidth);

    // ── World-space visualizations ──
    const gfx = this._worldGfx;

    // Vision circle (green, semi-transparent) — uses effective range (night shrinks it)
    const effectiveRange = this.goblins._getEffectiveVisionRange
      ? this.goblins._getEffectiveVisionRange(goblin)
      : goblin.traits.sense_range;
    const visionRadius = effectiveRange * TILE_SIZE;
    gfx.circle(goblin.px, goblin.py - TILE_SIZE / 2, visionRadius);
    gfx.stroke({ color: 0x00ff66, alpha: 0.3, width: 2 });

    // Path line (yellow)
    if (goblin.path && goblin.pathIndex < goblin.path.length) {
      gfx.moveTo(goblin.px, goblin.py);
      for (let i = goblin.pathIndex; i < goblin.path.length; i++) {
        const wp = goblin.path[i];
        gfx.lineTo(
          wp.col * TILE_SIZE + TILE_SIZE / 2,
          wp.row * TILE_SIZE + TILE_SIZE
        );
      }
      gfx.stroke({ color: 0xffff00, alpha: 0.6, width: 2 });
    }

    // Memory dots (colored by type)
    const MEM_COLORS = {
      bush: 0x44cc44,
      tree: 0x886633,
      gold: 0xffcc00,
      sheep: 0xffffff,
      drop_meat: 0xff4444,
      drop_wood: 0xcc8844,
      drop_gold: 0xffee44,
    };

    for (const entry of goblin.memory.values()) {
      const color = MEM_COLORS[entry.type] || 0x888888;
      const mx = entry.col * TILE_SIZE + TILE_SIZE / 2;
      const my = entry.row * TILE_SIZE + TILE_SIZE / 2;
      gfx.circle(mx, my, 4);
      gfx.fill({ color, alpha: 0.7 });
    }

    // Camp dot (orange)
    const camp = this.goblins.camp;
    if (camp) {
      gfx.circle(camp.px, camp.py - TILE_SIZE / 2, 6);
      gfx.fill({ color: 0xff8800, alpha: 0.8 });
    }
  }

  _positionSelectBox(sprite, px, py) {
    if (sprite) {
      const spriteH = sprite.height / Math.abs(sprite.scale.y);
      const boxSize = Math.max(spriteH, TILE_SIZE) * 1.3;
      const scale = boxSize / SELECT_BOX_BASE;
      this._selectBox.scale.set(scale);
      this._selectBox.x = px;
      this._selectBox.y = py - boxSize * 0.4;
      this._selectBox.visible = true;
    }
  }

  _showInspectText(lines, mainWidth) {
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
