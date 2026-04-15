import { ASSET_BASE } from '@shared/constants.js';

const T = `${ASSET_BASE}/Terrain`;
const B = `${ASSET_BASE}/Buildings`;
const U = `${ASSET_BASE}/UI Elements/UI Elements`;
const P = `${ASSET_BASE}/Units/Purple Units/Pawn`;

export const ASSET_MANIFEST = {
  // ── Terrain Tileset ──
  tilemap_color1: `${T}/Tileset/Tilemap_color1.png`,
  tilemap_color2: `${T}/Tileset/Tilemap_color2.png`,
  tilemap_color3: `${T}/Tileset/Tilemap_color3.png`,
  tilemap_color4: `${T}/Tileset/Tilemap_color4.png`,
  tilemap_color5: `${T}/Tileset/Tilemap_color5.png`,
  shadow: `${T}/Tileset/Shadow.png`,
  water_foam: `${T}/Tileset/Water Foam.png`,

  // ── Trees ──
  tree1: `${T}/Resources/Wood/Trees/Tree1.png`,
  tree2: `${T}/Resources/Wood/Trees/Tree2.png`,
  tree3: `${T}/Resources/Wood/Trees/Tree3.png`,
  tree4: `${T}/Resources/Wood/Trees/Tree4.png`,

  // ── Stumps ──
  stump1: `${T}/Resources/Wood/Trees/Stump 1.png`,
  stump2: `${T}/Resources/Wood/Trees/Stump 2.png`,
  stump3: `${T}/Resources/Wood/Trees/Stump 3.png`,
  stump4: `${T}/Resources/Wood/Trees/Stump 4.png`,

  // ── Bushes ──
  bush1: `${T}/Decorations/Bushes/Bushe1.png`,
  bush2: `${T}/Decorations/Bushes/Bushe2.png`,
  bush3: `${T}/Decorations/Bushes/Bushe3.png`,
  bush4: `${T}/Decorations/Bushes/Bushe4.png`,

  // ── Rocks ──
  rock1: `${T}/Decorations/Rocks/Rock1.png`,
  rock2: `${T}/Decorations/Rocks/Rock2.png`,
  rock3: `${T}/Decorations/Rocks/Rock3.png`,
  rock4: `${T}/Decorations/Rocks/Rock4.png`,

  // ── Water Rocks ──
  water_rock1: `${T}/Decorations/Rocks in the Water/Water Rocks_01.png`,
  water_rock2: `${T}/Decorations/Rocks in the Water/Water Rocks_02.png`,
  water_rock3: `${T}/Decorations/Rocks in the Water/Water Rocks_03.png`,
  water_rock4: `${T}/Decorations/Rocks in the Water/Water Rocks_04.png`,

  // ── Rubber Duck ──
  rubber_duck: `${T}/Decorations/Rubber Duck/Rubber duck.png`,

  // ── Clouds ──
  cloud1: `${T}/Decorations/Clouds/Clouds_01.png`,
  cloud2: `${T}/Decorations/Clouds/Clouds_02.png`,
  cloud3: `${T}/Decorations/Clouds/Clouds_03.png`,
  cloud4: `${T}/Decorations/Clouds/Clouds_04.png`,
  cloud5: `${T}/Decorations/Clouds/Clouds_05.png`,
  cloud6: `${T}/Decorations/Clouds/Clouds_06.png`,
  cloud7: `${T}/Decorations/Clouds/Clouds_07.png`,
  cloud8: `${T}/Decorations/Clouds/Clouds_08.png`,

  // ── Gold ──
  gold_stone1: `${T}/Resources/Gold/Gold Stones/Gold Stone 1.png`,
  gold_stone2: `${T}/Resources/Gold/Gold Stones/Gold Stone 2.png`,
  gold_stone3: `${T}/Resources/Gold/Gold Stones/Gold Stone 3.png`,
  gold_stone4: `${T}/Resources/Gold/Gold Stones/Gold Stone 4.png`,
  gold_stone5: `${T}/Resources/Gold/Gold Stones/Gold Stone 5.png`,
  gold_stone6: `${T}/Resources/Gold/Gold Stones/Gold Stone 6.png`,
  gold_resource: `${T}/Resources/Gold/Gold Resource/Gold_Resource.png`,

  // ── Meat / Sheep ──
  sheep_idle: `${T}/Resources/Meat/Sheep/Sheep_Idle.png`,
  sheep_move: `${T}/Resources/Meat/Sheep/Sheep_Move.png`,
  sheep_grass: `${T}/Resources/Meat/Sheep/Sheep_Grass.png`,
  meat_resource: `${T}/Resources/Meat/Meat Resource/Meat Resource.png`,

  // ── Wood Resource ──
  wood_resource: `${T}/Resources/Wood/Wood Resource/Wood Resource.png`,

  // ── Tools ──
  tool1: `${T}/Resources/Tools/Tool_01.png`,
  tool2: `${T}/Resources/Tools/Tool_02.png`,
  tool3: `${T}/Resources/Tools/Tool_03.png`,
  tool4: `${T}/Resources/Tools/Tool_04.png`,

  // ── Goblin (Purple Pawn) — Idle (8fr, 192×192) ──
  goblin_idle:         `${P}/Pawn_Idle.png`,
  goblin_idle_axe:     `${P}/Pawn_Idle Axe.png`,
  goblin_idle_gold:    `${P}/Pawn_Idle Gold.png`,
  goblin_idle_hammer:  `${P}/Pawn_Idle Hammer.png`,
  goblin_idle_knife:   `${P}/Pawn_Idle Knife.png`,
  goblin_idle_meat:    `${P}/Pawn_Idle Meat.png`,
  goblin_idle_pickaxe: `${P}/Pawn_Idle Pickaxe.png`,
  goblin_idle_wood:    `${P}/Pawn_Idle Wood.png`,

  // ── Goblin — Run (6fr, 192×192) ──
  goblin_run:         `${P}/Pawn_Run.png`,
  goblin_run_axe:     `${P}/Pawn_Run Axe.png`,
  goblin_run_gold:    `${P}/Pawn_Run Gold.png`,
  goblin_run_hammer:  `${P}/Pawn_Run Hammer.png`,
  goblin_run_knife:   `${P}/Pawn_Run Knife.png`,
  goblin_run_meat:    `${P}/Pawn_Run Meat.png`,
  goblin_run_pickaxe: `${P}/Pawn_Run Pickaxe.png`,
  goblin_run_wood:    `${P}/Pawn_Run Wood.png`,

  // ── Goblin — Interact (192×192, variable frame counts) ──
  goblin_interact_axe:     `${P}/Pawn_Interact Axe.png`,
  goblin_interact_hammer:  `${P}/Pawn_Interact Hammer.png`,
  goblin_interact_knife:   `${P}/Pawn_Interact Knife.png`,
  goblin_interact_pickaxe: `${P}/Pawn_Interact Pickaxe.png`,

  // ── Particle FX ──
  dust1: `${ASSET_BASE}/Particle FX/Dust_01.png`,
  dust2: `${ASSET_BASE}/Particle FX/Dust_02.png`,
  explosion1: `${ASSET_BASE}/Particle FX/Explosion_01.png`,
  explosion2: `${ASSET_BASE}/Particle FX/Explosion_02.png`,
  fire: `${ASSET_BASE}/Particle FX/Fire_02.png`,

  // ── Buildings (Blue — default faction) ──
  house1: `${B}/Blue Buildings/House1.png`,
  house2: `${B}/Blue Buildings/House2.png`,
  house3: `${B}/Blue Buildings/House3.png`,
  castle: `${B}/Blue Buildings/Castle.png`,
  tower: `${B}/Blue Buildings/Tower.png`,
  barracks: `${B}/Blue Buildings/Barracks.png`,

  // ── UI Elements ──
  ui_banner: `${U}/Banners/Banner.png`,
  ui_ribbon_big: `${U}/Ribbons/BigRibbons.png`,
  ui_ribbon_small: `${U}/Ribbons/SmallRibbons.png`,
  ui_paper: `${U}/Papers/RegularPaper.png`,
  ui_paper_special: `${U}/Papers/SpecialPaper.png`,
  ui_bar_big_base: `${U}/Bars/BigBar_Base.png`,
  ui_bar_big_fill: `${U}/Bars/BigBar_Fill.png`,
  ui_btn_blue: `${U}/Buttons/SmallBlueSquareButton_Regular.png`,
  ui_btn_blue_pressed: `${U}/Buttons/SmallBlueSquareButton_Pressed.png`,
  ui_btn_red: `${U}/Buttons/SmallRedSquareButton_Regular.png`,
  ui_btn_red_pressed: `${U}/Buttons/SmallRedSquareButton_Pressed.png`,
  ui_wood_table: `${U}/Wood Table/WoodTable.png`,
  ui_select_box: `${U}/Cursors/Cursor_04.png`,
};
