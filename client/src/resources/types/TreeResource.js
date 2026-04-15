import { AnimatedSprite, Sprite } from 'pixi.js';
import { tileAtlas } from '@/world/TileAtlas.js';
import { ANIM_SPEED, RESOURCE } from '@shared/constants.js';

/**
 * Tree — stationary material source, slow renewable.
 * States: GROWN → STUMP → SAPLING → GROWN
 */
export const TreeTypeDef = {
  type: 'tree',
  initialState: 'GROWN',

  states: {
    GROWN: { harvestable: true },
    STUMP: { harvestable: false },
    SAPLING: { harvestable: false },
  },

  createSprite(entity, manager) {
    const key = `tree${entity.variant}`;
    const tex = manager.textures[key];
    // Trees 1-2 are 192×256, trees 3-4 are 192×192
    const h = (entity.variant <= 2) ? 256 : 192;
    const frames = tileAtlas.extractFrames(tex, 192, h, 8);
    entity.data.frames = frames;
    entity.data.frameH = h;

    const sprite = new AnimatedSprite(frames);
    sprite.animationSpeed = ANIM_SPEED.TREE;
    sprite.gotoAndPlay(manager.rng.nextInt(0, 8));
    sprite.anchor.set(0.5, 1);
    sprite.x = entity.px;
    sprite.y = entity.py;
    return sprite;
  },

  onStateEnter(entity, state, ctx) {
    switch (state) {
      case 'GROWN': {
        // Swap back to animated tree
        const oldSprite = entity.sprite;
        const parent = oldSprite.parent;
        const frames = entity.data.frames;
        const sprite = new AnimatedSprite(frames);
        sprite.animationSpeed = ANIM_SPEED.TREE;
        sprite.play();
        sprite.anchor.set(0.5, 1);
        sprite.x = entity.px;
        sprite.y = entity.py;
        sprite.zIndex = entity.py;
        if (parent) {
          parent.removeChild(oldSprite);
          parent.addChild(sprite);
        }
        oldSprite.destroy();
        entity.sprite = sprite;
        break;
      }
      case 'STUMP': {
        // Replace animated tree with stump sprite
        const oldSprite = entity.sprite;
        const parent = oldSprite.parent;
        const stumpKey = `stump${entity.variant}`;
        const sprite = new Sprite(ctx.textures[stumpKey]);
        sprite.anchor.set(0.5, 1);
        sprite.x = entity.px;
        sprite.y = entity.py;
        sprite.zIndex = entity.py;
        if (parent) {
          parent.removeChild(oldSprite);
          parent.addChild(sprite);
        }
        oldSprite.destroy();
        entity.sprite = sprite;
        entity.stateTimer = RESOURCE.TREE_STUMP_TICKS;

        // Effects
        ctx.manager.spawnParticle('dust', entity.px, entity.py - 48);
        ctx.manager.queueSpawn('drop_wood', entity.col, entity.row, 1);
        break;
      }
      case 'SAPLING': {
        // Use a small bush-like sprite as sapling placeholder
        const oldSprite = entity.sprite;
        const parent = oldSprite.parent;
        const bushKey = `bush${((entity.variant - 1) % 4) + 1}`;
        const frames = tileAtlas.extractFrames(ctx.textures[bushKey], 128, 128, 8);
        const sprite = new AnimatedSprite(frames);
        sprite.animationSpeed = ANIM_SPEED.BUSH;
        sprite.play();
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(0.5);
        sprite.x = entity.px;
        sprite.y = entity.py;
        sprite.zIndex = entity.py;
        if (parent) {
          parent.removeChild(oldSprite);
          parent.addChild(sprite);
        }
        oldSprite.destroy();
        entity.sprite = sprite;
        entity.stateTimer = RESOURCE.TREE_SAPLING_TICKS;
        break;
      }
    }
  },

  update(entity, delta, ctx) {
    if (entity.state === 'STUMP' && entity.stateTimer <= 0) {
      entity.setState('SAPLING', ctx);
    } else if (entity.state === 'SAPLING' && entity.stateTimer <= 0) {
      entity.setState('GROWN', ctx);
    }
  },

  chop(entity, ctx) {
    if (entity.state !== 'GROWN') return false;
    entity.setState('STUMP', ctx);
    return true;
  },
};
