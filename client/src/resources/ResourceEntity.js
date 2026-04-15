import { TILE_SIZE } from '@shared/constants.js';

/**
 * Generic resource entity. All behavior lives in the typeDef config object.
 */
export class ResourceEntity {
  constructor(id, typeDef, col, row, variant) {
    this.id = id;
    this.type = typeDef.type;
    this.typeDef = typeDef;
    this.col = col;
    this.row = row;
    this.homeCol = col;
    this.homeRow = row;
    this.variant = variant;

    // Pixel position (for smooth movement)
    this.px = col * TILE_SIZE + TILE_SIZE / 2;
    this.py = row * TILE_SIZE + TILE_SIZE;

    // State machine
    this.state = typeDef.initialState;
    this.stateTimer = 0;

    // Sprite (created by typeDef.createSprite)
    this.sprite = null;
    this.alive = true;

    // Type-specific data bag
    this.data = {};
  }

  update(delta, context) {
    this.stateTimer -= delta;
    if (this.typeDef.update) {
      this.typeDef.update(this, delta, context);
    }
  }

  setState(newState, context) {
    this.state = newState;
    this.stateTimer = 0;
    if (this.typeDef.onStateEnter) {
      this.typeDef.onStateEnter(this, newState, context);
    }
  }

  destroy() {
    this.alive = false;
    if (this.sprite) {
      if (this.sprite.parent) this.sprite.parent.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
