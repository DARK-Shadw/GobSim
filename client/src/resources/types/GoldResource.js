import { Sprite } from 'pixi.js';
import { RESOURCE } from '@shared/constants.js';

/**
 * Gold stone — stationary wealth source, non-renewable.
 * States: FULL → DEPLETED
 */
export const GoldTypeDef = {
  type: 'gold',
  initialState: 'FULL',

  states: {
    FULL: { harvestable: true },
    DEPLETED: { harvestable: false },
  },

  createSprite(entity, manager) {
    const key = `gold_stone${entity.variant}`;
    const sprite = new Sprite(manager.textures[key]);
    sprite.anchor.set(0.5, 1);
    sprite.x = entity.px;
    sprite.y = entity.py;
    return sprite;
  },

  onStateEnter(entity, state, ctx) {
    if (state === 'DEPLETED') {
      ctx.manager.spawnParticle('dust', entity.px, entity.py - 32);
      ctx.manager.queueSpawn('drop_gold', entity.col, entity.row, 1);
      ctx.manager.remove(entity.id);
    }
  },

  update() {},

  mine(entity, ctx) {
    if (entity.state !== 'FULL') return false;
    entity.setState('DEPLETED', ctx);
    return true;
  },
};
