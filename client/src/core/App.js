import { Application, Container } from 'pixi.js';
import { WATER_BG_COLOR } from '@shared/constants.js';

export class App {
  constructor() {
    this.pixi = null;
    this.worldContainer = null;
    this.uiContainer = null;
  }

  async init() {
    this.pixi = new Application();

    await this.pixi.init({
      background: WATER_BG_COLOR,
      resizeTo: window,
      antialias: false,
      roundPixels: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    document.getElementById('game-container').appendChild(this.pixi.canvas);

    // World container — holds all game world elements (affected by camera)
    this.worldContainer = new Container();
    this.worldContainer.label = 'world';
    this.pixi.stage.addChild(this.worldContainer);

    // UI container — holds HUD elements (not affected by camera)
    this.uiContainer = new Container();
    this.uiContainer.label = 'ui';
    this.pixi.stage.addChild(this.uiContainer);

    return this;
  }
}
