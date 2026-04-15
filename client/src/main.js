import { App } from '@/core/App.js';
import { AssetLoader } from '@/core/AssetLoader.js';
import { Camera } from '@/core/Camera.js';
import { WorldGenerator } from '@/world/WorldGenerator.js';
import { TileMap } from '@/world/TileMap.js';
import { WaterLayer } from '@/world/WaterLayer.js';
import { DecorationPlacer } from '@/world/DecorationPlacer.js';
import { CloudLayer } from '@/world/CloudLayer.js';
import { ResourceManager } from '@/resources/ResourceManager.js';
import { BushTypeDef } from '@/resources/types/BushResource.js';
import { TreeTypeDef } from '@/resources/types/TreeResource.js';
import { GoldTypeDef } from '@/resources/types/GoldResource.js';
import { SheepTypeDef } from '@/resources/types/SheepResource.js';
import { DroppedMeatDef, DroppedWoodDef, DroppedGoldDef } from '@/resources/types/DroppedResource.js';
import { GoblinManager } from '@/goblin/GoblinManager.js';
import { DevOverlay } from '@/ui/DevOverlay.js';
import { HUD } from '@/ui/HUD.js';
import { Minimap } from '@/ui/Minimap.js';
import { IntroSequence } from '@/ui/IntroSequence.js';
import { Screenshot } from '@/utils/Screenshot.js';
import { generateWorldName } from '@/utils/NameGenerator.js';
import { DayNightCycle } from '@/world/DayNightCycle.js';
import { Narrator } from '@/ui/Narrator.js';
import { FloatingTextManager } from '@/ui/FloatingText.js';
import { TILE_SIZE } from '@shared/constants.js';

const STORAGE_KEY = 'gobsim_world';

async function boot() {
  const app = new App();
  await app.init();

  // ── Asset Loading ──
  const textures = await AssetLoader.load((progress) => {
    console.log(`[GobSim] Loading: ${Math.round(progress * 100)}%`);
  });
  app.textures = textures;

  // ── Seed Resolution ──
  const params = new URLSearchParams(window.location.search);
  let seed, dayCount;

  if (params.has('seed')) {
    seed = parseInt(params.get('seed'), 10);
    dayCount = 0;
  } else {
    // Check localStorage for existing world
    const saved = loadWorld();
    if (saved) {
      seed = saved.seed;
      dayCount = saved.dayCount;
    } else {
      seed = Math.floor(Math.random() * 99999);
      dayCount = 0;
    }
  }

  const worldName = generateWorldName(seed);

  // ── World Generation ──
  const world = new WorldGenerator(seed);
  app.world = world;

  // ── Render Layers (order matters) ──
  // 1. Water foam (below everything)
  const waterLayer = new WaterLayer(app, world);

  // 2. Terrain tilemap (flat + shadow + elevated)
  const tilemap = new TileMap(app, world);

  // 3. Cloud shadows (between terrain and decorations)
  const cloudLayer = new CloudLayer(app, world);

  // 4. Decorations (rocks, water_rocks, ducks — non-managed items)
  const decorations = new DecorationPlacer(app, world);

  // 5. Resource system (bush, tree, gold, sheep — all managed entities)
  const resources = new ResourceManager(app, world, decorations.container);
  resources.registerType(BushTypeDef);
  resources.registerType(TreeTypeDef);
  resources.registerType(GoldTypeDef);
  resources.registerType(SheepTypeDef);
  resources.registerType(DroppedMeatDef);
  resources.registerType(DroppedWoodDef);
  resources.registerType(DroppedGoldDef);
  resources.initFromWorld();

  // 6. Day/Night cycle
  const dayNight = new DayNightCycle();

  // 7. Narrator (event log) + Floating text
  const narrator = new Narrator(app);
  const floatingText = new FloatingTextManager(decorations.container);

  // 8. Goblin system (separate from resources, shares render container)
  const goblins = new GoblinManager(app, world, resources, decorations.container, dayNight, narrator, floatingText);
  const spawn = world.findBarrenSpot(6);
  goblins.spawnGoblin(spawn.col, spawn.row);

  // Reorder: clouds should be above everything, cloud shadows below decorations
  // Current worldContainer order: [foam, flat, shadow, elevated, cloudShadow, cloudSprites, decorations]
  // We need: [foam, flat, shadow, elevated, cloudShadow, decorations, cloudSprites]
  // Move cloud sprites to the very top
  app.worldContainer.addChild(cloudLayer.cloudContainer);

  // ── Camera ──
  const camera = new Camera(app);
  app.camera = camera;

  // ── UI ──
  const hud = new HUD(app, worldName, dayCount);
  const minimap = new Minimap(app, world, camera, goblins);
  const screenshot = new Screenshot(app, worldName);
  screenshot.setDay(dayCount);

  // ── Dev Overlay (toggle: ` or F3) ──
  const devOverlay = new DevOverlay(app, camera, resources, goblins);

  // ── Cinematic Intro ──
  const intro = new IntroSequence(app, camera, world, worldName, spawn);

  // ── Speed Controls (keys 1-4) ──
  app.gameSpeed = 1;
  const SPEED_MAP = { '1': 0, '2': 1, '3': 2, '4': 5 };
  window.addEventListener('keydown', (e) => {
    if (SPEED_MAP[e.key] !== undefined) {
      app.gameSpeed = SPEED_MAP[e.key];
      app.pixi.ticker.speed = app.gameSpeed;
      hud.setSpeed(app.gameSpeed);
    }
  });

  // ── Save World ──
  saveWorld({ seed, name: worldName, dayCount, createdAt: Date.now() });

  // ── Game Loop ──
  app.pixi.ticker.add((ticker) => {
    const delta = ticker.deltaTime;
    const deltaMs = ticker.deltaMS;

    // Intro sequence
    if (!intro.done) {
      intro.update(deltaMs);
    }

    // Camera
    camera.update();
    const viewBounds = camera.getViewBounds();

    // Viewport culling
    waterLayer.updateVisibility(viewBounds);
    decorations.updateVisibility(viewBounds);

    // Day/Night cycle
    const prevDay = dayNight.dayCount;
    const prevPhase = dayNight.phase;
    dayNight.update(delta);
    app.worldContainer.tint = dayNight.getLightingTint();
    hud.setDayNight(dayNight);
    if (dayNight.dayCount !== prevDay) {
      narrator.log(`Day ${dayNight.dayCount} dawns.`, 0xffd4a0);
      saveWorld({ seed, name: worldName, dayCount: dayNight.dayCount, createdAt: Date.now() });
    } else if (dayNight.phase !== prevPhase && dayNight.phase === 'night') {
      narrator.log('Night falls...', 0x8888cc);
    }

    // Resource system (sheep AI, timers, state machines)
    resources.update(delta, viewBounds);

    // Goblin system (AI, pathfinding, drives)
    goblins.update(delta, viewBounds);

    // Animated layers
    cloudLayer.update(delta);

    // Minimap
    minimap.update(viewBounds);

    // Narrator + floating text
    narrator.update();
    floatingText.update();

    // Dev overlay
    devOverlay.update();
  });

  console.log(`[GobSim] World of ${worldName} — Seed: ${seed} — Day: ${dayCount}`);
  window.__app = app;
  window.__resources = resources;
  window.__goblins = goblins;
}

function saveWorld(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Silently fail if localStorage unavailable
  }
}

function loadWorld() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

boot().catch(console.error);
