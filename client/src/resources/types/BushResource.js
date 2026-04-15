import { AnimatedSprite } from 'pixi.js';
import { tileAtlas } from '@/world/TileAtlas.js';
import { ANIM_SPEED, RESOURCE } from '@shared/constants.js';

/**
 * Berry bush — stationary, renewable food source.
 * States: FULL → DEPLETED → REGROWING → FULL
 */
export const BushTypeDef = {
  type: 'bush',
  initialState: 'FULL',

  states: {
    FULL: { harvestable: true },
    DEPLETED: { harvestable: false },
    REGROWING: { harvestable: false },
  },

  createSprite(entity, manager) {
    const key = `bush${entity.variant}`;
    const frames = tileAtlas.extractFrames(manager.textures[key], 128, 128, 8);
    entity.data.frames = frames;

    const sprite = new AnimatedSprite(frames);
    sprite.animationSpeed = ANIM_SPEED.BUSH;
    sprite.gotoAndPlay(manager.rng.nextInt(0, 8));
    sprite.anchor.set(0.5, 1);
    sprite.x = entity.px;
    sprite.y = entity.py;
    return sprite;
  },

  onStateEnter(entity, state) {
    switch (state) {
      case 'FULL':
        entity.sprite.tint = 0xffffff;
        entity.sprite.alpha = 1.0;
        entity.sprite.play();
        break;
      case 'DEPLETED':
        entity.sprite.stop();
        entity.sprite.tint = 0x667766;
        entity.sprite.alpha = 0.6;
        entity.stateTimer = RESOURCE.BUSH_REGROW_TICKS;
        break;
      case 'REGROWING':
        entity.sprite.tint = 0xaaddaa;
        entity.sprite.alpha = 0.8;
        entity.stateTimer = RESOURCE.BUSH_REGROW2_TICKS;
        break;
    }
  },

  update(entity, delta, ctx) {
    if (entity.state === 'DEPLETED' && entity.stateTimer <= 0) {
      entity.setState('REGROWING', ctx);
    } else if (entity.state === 'REGROWING' && entity.stateTimer <= 0) {
      entity.setState('FULL', ctx);
    }
  },

  harvest(entity, ctx) {
    if (entity.state !== 'FULL') return false;
    entity.setState('DEPLETED', ctx);
    ctx.manager.spawnParticle('dust', entity.px, entity.py - 32);
    return true;
  },
};
