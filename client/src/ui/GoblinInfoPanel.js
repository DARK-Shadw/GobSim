import { Container, Text, Graphics } from 'pixi.js';
import { TILE_SIZE, GENOME, SKILLS } from '@shared/constants.js';
import { FAMILY_COLORS } from '@/utils/GoblinNames.js';

// ── Layout Constants ──
const PANEL_W = 300;
const PAD = 16;
const LINE_H = 22;
const SECTION_GAP = 10;
const BAR_H = 12;
const BAR_W = 130;
const BAR_RADIUS = 3;
const LABEL_W = 100;

// ── Colors ──
const BG_COLOR = 0x1c1712;
const BG_ALPHA = 0.88;
const BORDER_COLOR = 0x665533;
const DIVIDER_COLOR = 0x443322;
const SECTION_COLOR = 0xaa9977;
const TEXT_COLOR = 0xe8dcc8;
const VALUE_COLOR = 0xccbbaa;
const BAR_BG = 0x2a2218;

const DRIVE_COLORS = {
  hunger:  { high: 0x55aa44, low: 0xcc3333 },
  stamina: { high: 0x4488cc, low: 0x4488cc },
  fatigue: { high: 0x8866aa, low: 0x8866aa },
};

// ── Font Styles ──
const FONT_NAME = {
  fontFamily: 'Georgia, serif', fontSize: 16, fill: 0xffffff,
  fontWeight: 'bold',
  stroke: { color: 0x000000, width: 2 },
};
const FONT_SUB = {
  fontFamily: 'Georgia, serif', fontSize: 12, fill: TEXT_COLOR,
};
const FONT_SECTION = {
  fontFamily: 'Georgia, serif', fontSize: 11, fill: SECTION_COLOR,
  fontWeight: 'bold', letterSpacing: 2,
};
const FONT_LABEL = {
  fontFamily: 'Georgia, serif', fontSize: 11, fill: TEXT_COLOR,
};
const FONT_VALUE = {
  fontFamily: 'Consolas, monospace', fontSize: 11, fill: VALUE_COLOR,
};
const FONT_STATUS = {
  fontFamily: 'Georgia, serif', fontSize: 12, fill: TEXT_COLOR,
};

/**
 * Right-side info panel shown when a goblin is left-clicked.
 * Clean sidebar layout with drive bars, skill levels, genome traits.
 */
export class GoblinInfoPanel {
  constructor(app, camera, goblins) {
    this.app = app;
    this.camera = camera;
    this.goblins = goblins;
    this._selectedId = null;

    this.container = new Container({ label: 'goblin-info-panel' });
    this.container.visible = false;
    app.uiContainer.addChild(this.container);

    this._bg = new Graphics();
    this.container.addChild(this._bg);

    this._bars = new Graphics();
    this.container.addChild(this._bars);

    // Pre-create text objects for each section
    this._nameText = new Text({ text: '', style: FONT_NAME });
    this._subText = new Text({ text: '', style: FONT_SUB });
    this._driveHeader = new Text({ text: 'DRIVES', style: FONT_SECTION });
    this._skillHeader = new Text({ text: 'SKILLS', style: FONT_SECTION });
    this._genomeHeader = new Text({ text: 'GENOME', style: FONT_SECTION });
    this._statusText = new Text({ text: '', style: FONT_STATUS });

    // Drive labels + values
    this._driveLabels = {};
    this._driveValues = {};
    for (const key of ['hunger', 'stamina', 'fatigue']) {
      this._driveLabels[key] = new Text({
        text: key.charAt(0).toUpperCase() + key.slice(1),
        style: FONT_LABEL,
      });
      this._driveValues[key] = new Text({ text: '', style: FONT_VALUE });
    }

    // Skill labels + values
    this._skillLabels = {};
    this._skillValues = {};
    for (const type of SKILLS.TYPES) {
      this._skillLabels[type] = new Text({
        text: type.charAt(0).toUpperCase() + type.slice(1),
        style: FONT_LABEL,
      });
      this._skillValues[type] = new Text({ text: '', style: FONT_VALUE });
    }

    // Genome labels + values
    this._genomeLabels = {};
    this._genomeValues = {};
    for (const key of GENOME.KEYS) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      this._genomeLabels[key] = new Text({ text: label, style: FONT_LABEL });
      this._genomeValues[key] = new Text({ text: '', style: FONT_VALUE });
    }

    // Add all text children
    const allTexts = [
      this._nameText, this._subText,
      this._driveHeader, this._skillHeader, this._genomeHeader,
      this._statusText,
      ...Object.values(this._driveLabels), ...Object.values(this._driveValues),
      ...Object.values(this._skillLabels), ...Object.values(this._skillValues),
      ...Object.values(this._genomeLabels), ...Object.values(this._genomeValues),
    ];
    for (const t of allTexts) this.container.addChild(t);

    this._bindInput();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
  }

  _bindInput() {
    const canvas = this.app.pixi.canvas;
    let downX = 0, downY = 0, downTime = 0;

    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downTime = Date.now();
    });

    canvas.addEventListener('pointerup', (e) => {
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      const dt = Date.now() - downTime;
      if (dx > 5 || dy > 5 || dt > 300) return;

      // Ignore clicks on the panel itself
      const panelRight = this.container.x + PANEL_W;
      const panelLeft = this.container.x;
      if (this.container.visible &&
          e.clientX >= panelLeft && e.clientX <= panelRight &&
          e.clientY >= this.container.y) return;

      const goblin = this._hitTest(e.clientX, e.clientY);
      if (goblin) {
        this.select(goblin.id);
      } else {
        this.deselect();
      }
    });
  }

  _hitTest(sx, sy) {
    const wc = this.app.worldContainer;
    const wx = (sx - wc.x) / wc.scale.x;
    const wy = (sy - wc.y) / wc.scale.y;
    const col = Math.floor(wx / TILE_SIZE);
    const row = Math.floor(wy / TILE_SIZE);
    return this.goblins.getGoblinAt(col, row)
      || this.goblins.getGoblinAt(col - 1, row)
      || this.goblins.getGoblinAt(col + 1, row)
      || this.goblins.getGoblinAt(col, row - 1)
      || this.goblins.getGoblinAt(col, row + 1);
  }

  select(id) {
    this._selectedId = id;
    this.container.visible = true;
  }

  deselect() {
    this._selectedId = null;
    this.container.visible = false;
  }

  get selectedGoblin() {
    if (!this._selectedId) return null;
    return this.goblins.getGoblin(this._selectedId);
  }

  update() {
    const goblin = this.selectedGoblin;
    if (!goblin || !goblin.alive) {
      if (this._selectedId) this.deselect();
      return;
    }

    // Camera follow
    this.camera.moveTo(goblin.px, goblin.py - TILE_SIZE / 2);

    const familyColor = FAMILY_COLORS[goblin.familyIndex % FAMILY_COLORS.length];
    let y = PAD;

    // ── Name ──
    this._nameText.text = goblin.name;
    this._nameText.style.fill = familyColor;
    this._nameText.x = PAD;
    this._nameText.y = y;
    y += 24;

    // ── Subtitle ──
    const genLabel = goblin.lineage.generation === 0 ? ' \u2014 Founder' : '';
    this._subText.text = `Age: ${goblin.ageYears.toFixed(1)} yrs (${goblin.ageStage})  |  Gen ${goblin.lineage.generation}${genLabel}`;
    this._subText.x = PAD;
    this._subText.y = y;
    y += 20;

    // ── Drives Section ──
    y += SECTION_GAP;
    this._driveHeader.x = PAD;
    this._driveHeader.y = y;
    y += 20;

    const barX = LABEL_W + PAD;
    const valX = barX + BAR_W + 8;

    for (const key of ['hunger', 'stamina', 'fatigue']) {
      this._driveLabels[key].x = PAD;
      this._driveLabels[key].y = y;
      this._driveValues[key].text = goblin.drives[key].toFixed(2);
      this._driveValues[key].x = valX;
      this._driveValues[key].y = y;
      y += LINE_H;
    }

    // ── Skills Section ──
    y += SECTION_GAP;
    this._skillHeader.x = PAD;
    this._skillHeader.y = y;
    y += 20;

    for (const type of SKILLS.TYPES) {
      const lvl = goblin.getSkillLevel(type);
      const xp = goblin.skills[type] || 0;
      const next = SKILLS.XP_THRESHOLDS[lvl] || '\u221E';
      this._skillLabels[type].x = PAD;
      this._skillLabels[type].y = y;
      this._skillValues[type].text = `Lv${lvl}  ${xp}/${next} XP`;
      this._skillValues[type].x = LABEL_W + PAD;
      this._skillValues[type].y = y;
      y += LINE_H;
    }

    // ── Genome Section ──
    y += SECTION_GAP;
    this._genomeHeader.x = PAD;
    this._genomeHeader.y = y;
    y += 20;

    for (const key of GENOME.KEYS) {
      this._genomeLabels[key].x = PAD;
      this._genomeLabels[key].y = y;
      this._genomeValues[key].text = goblin.genome[key].toFixed(2);
      this._genomeValues[key].x = valX;
      this._genomeValues[key].y = y;
      y += LINE_H;
    }

    // ── Status ──
    y += SECTION_GAP;
    const action = goblin.currentAction?.name || 'idle';
    const inv = goblin.inventory;
    const explored = goblin.explored.reduce((a, b) => a + b, 0);
    this._statusText.text =
      `Action: ${action}\n` +
      `Inventory:  M:${inv.meat}  W:${inv.wood}  G:${inv.gold}\n` +
      `Memory: ${goblin.memory.size}  |  Explored: ${explored}`;
    this._statusText.x = PAD;
    this._statusText.y = y;
    y += 52;

    const totalH = y + PAD;

    // ── Draw Background ──
    this._bg.clear();
    // Main panel
    this._bg.roundRect(0, 0, PANEL_W, totalH, 6);
    this._bg.fill({ color: BG_COLOR, alpha: BG_ALPHA });
    // Border
    this._bg.roundRect(0, 0, PANEL_W, totalH, 6);
    this._bg.stroke({ color: BORDER_COLOR, width: 2, alpha: 0.6 });
    // Inner accent line at top
    this._bg.rect(PAD, PAD + 22, PANEL_W - PAD * 2, 1);
    this._bg.fill({ color: familyColor, alpha: 0.3 });

    // Section dividers
    const dividerY = (headerText) => headerText.y - 4;
    for (const header of [this._driveHeader, this._skillHeader, this._genomeHeader]) {
      const dy = dividerY(header);
      this._bg.rect(PAD, dy, PANEL_W - PAD * 2, 1);
      this._bg.fill({ color: DIVIDER_COLOR, alpha: 0.5 });
    }
    // Divider before status
    this._bg.rect(PAD, this._statusText.y - 6, PANEL_W - PAD * 2, 1);
    this._bg.fill({ color: DIVIDER_COLOR, alpha: 0.5 });

    // ── Draw Bars ──
    this._bars.clear();

    // Drive bars
    for (const key of ['hunger', 'stamina', 'fatigue']) {
      const val = goblin.drives[key];
      const labelY = this._driveLabels[key].y;
      const by = labelY + 2;
      // Bar background
      this._bars.roundRect(barX, by, BAR_W, BAR_H, BAR_RADIUS);
      this._bars.fill({ color: BAR_BG });
      // Bar fill
      const fillW = Math.max(0, BAR_W * Math.min(1, val));
      if (fillW > 0) {
        const colors = DRIVE_COLORS[key];
        const fillColor = key === 'hunger'
          ? (val > 0.4 ? colors.high : colors.low)
          : colors.high;
        this._bars.roundRect(barX, by, fillW, BAR_H, BAR_RADIUS);
        this._bars.fill({ color: fillColor, alpha: 0.85 });
      }
      // Bar border
      this._bars.roundRect(barX, by, BAR_W, BAR_H, BAR_RADIUS);
      this._bars.stroke({ color: 0x444433, width: 1, alpha: 0.4 });
    }

    // Genome bars
    for (const key of GENOME.KEYS) {
      const val = goblin.genome[key];
      const labelY = this._genomeLabels[key].y;
      const by = labelY + 2;
      // Bar background
      this._bars.roundRect(barX, by, BAR_W, BAR_H, BAR_RADIUS);
      this._bars.fill({ color: BAR_BG });
      // Normalized value (0.7–1.3 range → 0–1)
      const norm = (val - GENOME.MIN) / (GENOME.MAX - GENOME.MIN);
      const fillW = Math.max(0, BAR_W * Math.min(1, norm));
      if (fillW > 0) {
        const fillColor = val >= 1.0 ? 0x55aa44 : 0xbb7733;
        this._bars.roundRect(barX, by, fillW, BAR_H, BAR_RADIUS);
        this._bars.fill({ color: fillColor, alpha: 0.75 });
      }
      // Center marker at 1.0
      const centerX = barX + BAR_W * ((1.0 - GENOME.MIN) / (GENOME.MAX - GENOME.MIN));
      this._bars.rect(centerX - 0.5, by, 1, BAR_H);
      this._bars.fill({ color: 0xffffff, alpha: 0.2 });
      // Bar border
      this._bars.roundRect(barX, by, BAR_W, BAR_H, BAR_RADIUS);
      this._bars.stroke({ color: 0x444433, width: 1, alpha: 0.4 });
    }

    // Skill XP progress bars (thin, below skill text)
    for (const type of SKILLS.TYPES) {
      const lvl = goblin.getSkillLevel(type);
      const xp = goblin.skills[type] || 0;
      const nextThreshold = SKILLS.XP_THRESHOLDS[lvl];
      const prevThreshold = SKILLS.XP_THRESHOLDS[lvl - 1] || 0;
      const labelY = this._skillLabels[type].y;
      const by = labelY + 15;
      const skillBarW = PANEL_W - PAD * 2;
      // Thin XP progress bar
      this._bars.roundRect(PAD, by, skillBarW, 3, 1);
      this._bars.fill({ color: BAR_BG });
      if (nextThreshold) {
        const progress = (xp - prevThreshold) / (nextThreshold - prevThreshold);
        const fillW = Math.max(0, skillBarW * Math.min(1, progress));
        if (fillW > 0) {
          this._bars.roundRect(PAD, by, fillW, 3, 1);
          this._bars.fill({ color: 0xddaa33, alpha: 0.7 });
        }
      } else {
        // Max level — full bar
        this._bars.roundRect(PAD, by, skillBarW, 3, 1);
        this._bars.fill({ color: 0xddaa33, alpha: 0.7 });
      }
    }
  }

  _onResize() {
    const screen = this.app.pixi.screen;
    this.container.x = screen.width - PANEL_W - 12;
    this.container.y = 60;
  }
}
