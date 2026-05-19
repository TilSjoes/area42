/**
 * Area42 World — Three.js-backed renderer.
 *
 * The 2D Area42 stack (HUD, Renderer, Scene, Graph) targets Canvas 2D.
 * WorldHUD is the parallel surface for true 3D: a Three.js scene, a
 * perspective camera, OrbitControls by default, and a render loop that
 * mirrors the 2D HUD's lifecycle. Consumers pick the surface that fits
 * the data — small dashboards stay 2D; data-as-space exploration
 * (SELDON's WorldView) goes 3D.
 *
 * Three.js is a peer dependency. Consumers must `npm i three`. This
 * keeps Canvas 2D consumers from paying the ~150 KB cost.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** Theme — keep it minimal until we know what we need. */
export interface WorldTheme {
  background: number;     // hex color for clear color
  fog?: number;           // hex; null/undefined disables fog
  ambient: number;        // ambient light intensity (0..1)
  directional: number;    // directional light intensity (0..1)
}

export const NeonWorldTheme: WorldTheme = {
  background: 0x080c14,    // matches v1 SELDON bg-0
  fog: 0x080c14,
  ambient: 0.55,
  directional: 0.75,
};

export interface WorldHUDOptions {
  theme?: WorldTheme;
  /** Field of view for the perspective camera, in degrees. Default 60. */
  fov?: number;
  /** Initial camera position. Default looks down-and-back at origin. */
  cameraStart?: [number, number, number];
  /** Initial OrbitControls target. Default origin. */
  cameraTarget?: [number, number, number];
}

export class WorldHUD {
  readonly container: HTMLElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly theme: WorldTheme;

  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private renderCallbacks: Array<(dt: number) => void> = [];
  private lastTime = 0;

  constructor(selector: string | HTMLElement, options: WorldHUDOptions = {}) {
    const el = typeof selector === "string" ? document.querySelector(selector) as HTMLElement : selector;
    if (!el) throw new Error(`WorldHUD: container ${selector} not found`);
    this.container = el;
    this.theme = options.theme ?? NeonWorldTheme;

    // Scene + fog. Fog gives us free depth cueing — distant nodes
    // fade into the background, near nodes pop. Cheap atmosphere.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.background);
    if (this.theme.fog !== undefined) {
      this.scene.fog = new THREE.Fog(this.theme.fog, 400, 2400);
    }

    // Camera. Default position is back and slightly above so the user
    // sees three planes meeting at the origin. fitToData() can move it
    // once data lands.
    const rect = el.getBoundingClientRect();
    const aspect = (rect.width || 1) / (rect.height || 1);
    this.camera = new THREE.PerspectiveCamera(options.fov ?? 60, aspect, 1, 5000);
    const cs = options.cameraStart ?? [600, 400, 800];
    this.camera.position.set(cs[0], cs[1], cs[2]);

    // Renderer. WebGL2-preferred (Three.js auto-falls-back). antialias on
    // for pretty edges; pixel ratio capped at 2 to keep retina sane.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(rect.width || 1, rect.height || 1, false);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    el.appendChild(this.renderer.domElement);

    // Lighting. One ambient + one directional is enough for the basic
    // depth shading we need. SELDON nodes glow on top via emissive
    // material, not light — that comes later if we want it.
    this.scene.add(new THREE.AmbientLight(0xffffff, this.theme.ambient));
    const dir = new THREE.DirectionalLight(0xffffff, this.theme.directional);
    dir.position.set(400, 800, 600);
    this.scene.add(dir);

    // Controls. OrbitControls: drag = orbit, right-drag/two-finger = pan,
    // scroll = zoom. Damping on for the "feels alive" inertia. WASD-fly
    // mode comes in a follow-up — needs PointerLockControls + keyboard
    // wiring. For MVP, OrbitControls alone gives us inspection.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    const ct = options.cameraTarget ?? [0, 0, 0];
    this.controls.target.set(ct[0], ct[1], ct[2]);
    this.controls.update();

    // Auto-resize. ResizeObserver fires whenever the container's box
    // changes — sidebars opening, viewport resizing, etc. Cheaper than
    // listening to window resize.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(el);
  }

  /** Resize the renderer to fit the container. Idempotent. */
  resize(): void {
    const rect = this.container.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** Register a per-frame callback (data updates, animations, etc). */
  onRender(cb: (dt: number) => void): void {
    this.renderCallbacks.push(cb);
  }

  /** Start the render loop. */
  start(): void {
    if (this.animationId !== null) return;
    const tick = (t: number) => {
      const dt = this.lastTime ? (t - this.lastTime) / 1000 : 0;
      this.lastTime = t;
      this.controls.update();
      for (const cb of this.renderCallbacks) cb(dt);
      this.renderer.render(this.scene, this.camera);
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  /** Stop the render loop. Doesn't dispose anything. */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Frame the camera so a bounding box fits comfortably in view. Useful
   * after loading data — positions nodes in space, then this call sets
   * the camera so they're all visible without manual orbiting.
   */
  fitToBox(box: THREE.Box3, padding = 1.4): void {
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const dist = (maxDim / (2 * Math.tan(fovRad / 2))) * padding;
    const dir = new THREE.Vector3(0.7, 0.5, 1.0).normalize();
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.controls.target.copy(center);
    this.controls.update();
  }

  /** Tear down: stop loop, drop GL resources, remove canvas. */
  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
