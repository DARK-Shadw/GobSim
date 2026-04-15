import { AnimatedSprite, Container, Text } from 'pixi.js';
import { tileAtlas } from '@/world/TileAtlas.js';
import { TILE_SIZE, FIRE_FRAME } from '@shared/constants.js';

/**
 * Campfire with stockpile. Goblins deposit resources here and rest nearby.
 */
export class Camp {
  constructor(col, row, textures, renderContainer) {
    this.col = col;
    this.row = row;
    this.px = col * TILE_SIZE + TILE_SIZE / 2;
    this.py = row * TILE_SIZE + TILE_SIZE;

    // Stockpile
    this.stockpile = { meat: 0, wood: 0, gold: 0 };

    // Fire sprite
    const frames = tileAtlas.extractFrames(
      textures.fire, FIRE_FRAME.W, FIRE_FRAME.H, FIRE_FRAME.COUNT
    );
    this.sprite = new AnimatedSprite(frames);
    this.sprite.animationSpeed = 0.15;
    this.sprite.play();
    this.sprite.anchor.set(0.5, 1);
    this.sprite.x = this.px;
    this.sprite.y = this.py;
    this.sprite.zIndex = this.py;
    renderContainer.addChild(this.sprite);

    // Stockpile label
    this._label = new Text({
      text: '',
      style: {
        fontFamily: 'monospace',
        fontSize: 10,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 2 },
      },
    });
    this._label.anchor.set(0.5, 1);
    this._label.x = this.px;
    this._label.y = this.py - FIRE_FRAME.H - 4;
    this._label.zIndex = this.py + 1;
    renderContainer.addChild(this._label);

    this._updateLabel();
  }

  deposit(inventory) {
    this.stockpile.meat += inventory.meat;
    this.stockpile.wood += inventory.wood;
    this.stockpile.gold += inventory.gold;
    this._updateLabel();
  }

  withdraw(type, amount) {
    const have = this.stockpile[type] || 0;
    const take = Math.min(have, amount);
    this.stockpile[type] -= take;
    this._updateLabel();
    return take;
  }

  getTotal() {
    return this.stockpile.meat + this.stockpile.wood + this.stockpile.gold;
  }

  _updateLabel() {
    const { meat, wood, gold } = this.stockpile;
    if (meat + wood + gold === 0) {
      this._label.text = '';
      return;
    }
    const parts = [];
    if (meat > 0) parts.push(`M:${meat}`);
    if (wood > 0) parts.push(`W:${wood}`);
    if (gold > 0) parts.push(`G:${gold}`);
    this._label.text = parts.join(' ');
  }
}
