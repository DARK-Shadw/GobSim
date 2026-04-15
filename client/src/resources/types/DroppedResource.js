import { Sprite } from 'pixi.js';
import { RESOURCE } from '@shared/constants.js';

/**
 * Dropped resource items sitting on the ground.
 * Despawn after a long time if not picked up.
 */
function makeDropDef(type, textureKey) {
  return {
    type,
    initialState: 'GROUND',

    states: {
      GROUND: {},
      DESPAWNING: {},
    },

    createSprite(entity, manager) {
      const sprite = new Sprite(manager.textures[textureKey]);
      sprite.anchor.set(0.5, 1);
      sprite.x = entity.px;
      sprite.y = entity.py;
      return sprite;
    },

    onStateEnter(entity, state) {
      if (state === 'GROUND') {
        entity.stateTimer = RESOURCE.DROP_DESPAWN_TICKS;
      }
    },

    update(entity, delta, ctx) {
      if (entity.state === 'GROUND' && entity.stateTimer <= 0) {
        entity.setState('DESPAWNING', ctx);
        entity.stateTimer = RESOURCE.DROP_FADE_TICKS;
      } else if (entity.state === 'DESPAWNING') {
        const progress = Math.max(0, entity.stateTimer / RESOURCE.DROP_FADE_TICKS);
        entity.sprite.alpha = progress;
        if (entity.stateTimer <= 0) {
          ctx.manager.remove(entity.id);
        }
      }
    },

    pickup(entity, ctx) {
      ctx.manager.remove(entity.id);
      return type;
    },
  };
}

export const DroppedMeatDef = makeDropDef('drop_meat', 'meat_resource');
export const DroppedWoodDef = makeDropDef('drop_wood', 'wood_resource');
export const DroppedGoldDef = makeDropDef('drop_gold', 'gold_resource');
