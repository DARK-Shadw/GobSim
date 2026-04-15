import { Assets } from 'pixi.js';
import { ASSET_MANIFEST } from './AssetManifest.js';

export class AssetLoader {
  static async load(onProgress) {
    const entries = Object.entries(ASSET_MANIFEST);

    Assets.addBundle('game', Object.fromEntries(
      entries.map(([key, path]) => [key, path])
    ));

    const textures = await Assets.loadBundle('game', (progress) => {
      if (onProgress) onProgress(progress);
    });

    console.log(`[AssetLoader] Loaded ${entries.length} assets`);
    return textures;
  }
}
