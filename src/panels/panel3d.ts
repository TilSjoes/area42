/**
 * Area42 Panel3D — Three.js Scene as Glass Panel
 *
 * Optional addon that embeds a Three.js WebGL canvas inside an Area42
 * glass panel. The 3D scene is rendered to an offscreen canvas and
 * composited into the panel's content area each frame.
 *
 * Three.js is dynamically imported — graceful fallback if not installed.
 */

import { Panel } from "./panel.js";
import type { PanelOptions } from "./panel.js";

// Three.js types (used for type safety without hard dependency)
type Scene = import("three").Scene;
type PerspectiveCamera = import("three").PerspectiveCamera;
type WebGLRenderer = import("three").WebGLRenderer;

/** THREE module shape (subset we use) */
interface ThreeModule {
  Scene: new () => Scene;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => PerspectiveCamera;
  WebGLRenderer: new (params: { canvas: HTMLCanvasElement; alpha: boolean; antialias: boolean }) => WebGLRenderer;
}

/** Options for Panel3D */
export interface Panel3DOptions extends PanelOptions {
  /** Called once after Three.js loads — set up your scene here */
  setup?: (scene: Scene, camera: PerspectiveCamera, THREE: ThreeModule) => void;
  /** Called each frame — animate your scene here */
  animate?: (scene: Scene, camera: PerspectiveCamera, dt: number, THREE: ThreeModule) => void;
  /** Resolution scale for offscreen canvas (default 1.0, lower = faster) */
  resolution?: number;
}

/** Loading state for the Three.js module */
let threePromise: Promise<ThreeModule | null> | null = null;
let threeModule: ThreeModule | null = null;
let threeLoadFailed = false;

/** Lazily load Three.js */
function loadThree(): Promise<ThreeModule | null> {
  if (threeLoadFailed) return Promise.resolve(null);
  if (threeModule) return Promise.resolve(threeModule);
  if (!threePromise) {
    threePromise = import("three")
      .then((mod) => {
        threeModule = mod as unknown as ThreeModule;
        return threeModule;
      })
      .catch(() => {
        threeLoadFailed = true;
        console.warn("Panel3D: three.js not available — 3D panels will show fallback");
        return null;
      });
  }
  return threePromise;
}

export class Panel3D extends Panel {
  private threeRenderer: WebGLRenderer | null = null;
  private threeScene: Scene | null = null;
  private threeCamera: PerspectiveCamera | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private resolution: number;
  private setupFn: Panel3DOptions["setup"];
  private animateFn: Panel3DOptions["animate"];
  private initialized = false;
  private initFailed = false;
  private lastTime = 0;

  constructor(options: Panel3DOptions) {
    super(options);
    this.resolution = options.resolution ?? 1.0;
    this.setupFn = options.setup;
    this.animateFn = options.animate;

    // Create offscreen canvas for Three.js rendering
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = 256;
    this.offscreenCanvas.height = 256;

    // Kick off Three.js loading
    this.initThree();
  }

  private async initThree(): Promise<void> {
    const THREE = await loadThree();
    if (!THREE) {
      this.initFailed = true;
      return;
    }

    try {
      // Create scene + camera
      this.threeScene = new THREE.Scene();
      this.threeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      this.threeCamera.position.z = 3;

      // Create renderer targeting offscreen canvas
      this.threeRenderer = new THREE.WebGLRenderer({
        canvas: this.offscreenCanvas,
        alpha: true,
        antialias: true,
      });
      this.threeRenderer.setSize(256, 256);
      this.threeRenderer.setClearColor(0x000000, 0);

      // Call user setup
      if (this.setupFn && this.threeScene && this.threeCamera) {
        this.setupFn(this.threeScene, this.threeCamera, THREE);
      }

      this.initialized = true;
    } catch (err) {
      console.warn("Panel3D: failed to initialize Three.js renderer:", err);
      this.initFailed = true;
    }
  }

  /** Resize the offscreen canvas to match panel content area */
  private resizeOffscreen(contentW: number, contentH: number): void {
    const w = Math.max(1, Math.round(contentW * this.resolution));
    const h = Math.max(1, Math.round(contentH * this.resolution));

    if (this.offscreenCanvas.width !== w || this.offscreenCanvas.height !== h) {
      this.offscreenCanvas.width = w;
      this.offscreenCanvas.height = h;

      if (this.threeRenderer) {
        this.threeRenderer.setSize(w, h, false);
      }
      if (this.threeCamera) {
        (this.threeCamera as PerspectiveCamera).aspect = w / h;
        (this.threeCamera as PerspectiveCamera).updateProjectionMatrix();
      }
    }
  }

  /** Dispose Three.js resources */
  dispose(): void {
    if (this.threeRenderer) {
      this.threeRenderer.dispose();
      this.threeRenderer = null;
    }
    this.threeScene = null;
    this.threeCamera = null;
    this.initialized = false;
  }

  override render(ctx: CanvasRenderingContext2D): void {
    // Render base panel (glass background, title bar, controls)
    super.render(ctx);

    // Don't render 3D content if collapsed or minimized
    if (this.collapsed || this.minimized) return;

    // Content area dimensions (inside panel, below header)
    const pad = this.compact ? 4 : 8;
    const headerH = this.compact ? 22 : 28;
    const contentX = pad;
    const contentY = headerH + pad;
    const contentW = this.size.x - pad * 2;
    const contentH = this.size.y - headerH - pad * 2;

    if (contentW <= 0 || contentH <= 0) return;

    if (this.initFailed) {
      // Fallback: render a subtle "3D unavailable" message
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3D: three.js not available", contentX + contentW / 2, contentY + contentH / 2);
      ctx.restore();
      return;
    }

    if (!this.initialized || !this.threeRenderer || !this.threeScene || !this.threeCamera) {
      // Still loading — render a subtle loading indicator
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Loading 3D...", contentX + contentW / 2, contentY + contentH / 2);
      ctx.restore();
      return;
    }

    // Resize offscreen canvas if needed
    this.resizeOffscreen(contentW, contentH);

    // Calculate dt
    const now = performance.now();
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0.016;
    this.lastTime = now;

    // Call user animate callback
    if (this.animateFn && this.threeScene && this.threeCamera && threeModule) {
      this.animateFn(this.threeScene, this.threeCamera, dt, threeModule);
    }

    // Render Three.js scene
    this.threeRenderer.render(this.threeScene, this.threeCamera);

    // Composite offscreen canvas into panel content area
    ctx.save();
    ctx.drawImage(this.offscreenCanvas, contentX, contentY, contentW, contentH);
    ctx.restore();
  }
}
