/**
 * FlyControls — pointer-locked WASD camera, the game-grammar input
 * scheme for navigating data-as-space.
 *
 * Wraps Three.js PointerLockControls (mouse-look on locked pointer)
 * with WASD movement, Q/E vertical, and Shift for sprint. Built as
 * an explicit alternative to OrbitControls — consumers swap between
 * them based on what the user wants to do:
 * - Orbit: inspect a fixed object from outside ("look at the model")
 * - Fly:   move through the world ("explore the space")
 *
 * Lifecycle:
 *   const fly = new FlyControls(camera, domElement);
 *   fly.enable();    // requests pointer lock
 *   fly.disable();   // releases pointer lock
 *   fly.update(dt);  // call from your render loop while enabled
 *
 * Keys are configurable via the keys map. Defaults match standard
 * first-person shooter convention.
 */

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

export interface FlyControlsOptions {
  /** Movement speed in scene units per second. Default 200. */
  speed?: number;
  /** Sprint multiplier when Shift is held. Default 3. */
  sprintMultiplier?: number;
  /** Custom key mapping. */
  keys?: Partial<{
    forward: string;
    back: string;
    left: string;
    right: string;
    up: string;
    down: string;
    sprint: string;
  }>;
}

const DEFAULT_KEYS = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  up: "Space",
  down: "ShiftLeft",  // Note: Shift is also sprint — handled with priority
  sprint: "ShiftLeft",
};

export class FlyControls {
  readonly pointerLock: PointerLockControls;
  private domElement: HTMLElement;
  private speed: number;
  private sprintMultiplier: number;
  private keys: typeof DEFAULT_KEYS;

  // Per-frame state — read by update().
  private moveForward = false;
  private moveBack = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;
  private sprinting = false;
  private active = false;

  // Reusable vec to avoid allocation in the render loop.
  private upDelta = new THREE.Vector3();

  constructor(camera: THREE.Camera, domElement: HTMLElement, options: FlyControlsOptions = {}) {
    this.domElement = domElement;
    this.speed = options.speed ?? 200;
    this.sprintMultiplier = options.sprintMultiplier ?? 3;
    this.keys = { ...DEFAULT_KEYS, ...options.keys };

    this.pointerLock = new PointerLockControls(camera, domElement);
  }

  /** Engage: request pointer lock, attach key listeners. */
  enable(): void {
    if (this.active) return;
    this.active = true;
    this.pointerLock.lock();
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup",   this.onKeyUp);
    this.pointerLock.addEventListener("unlock", this.onUnlock);
  }

  /** Disengage: release pointer lock, detach listeners. */
  disable(): void {
    if (!this.active) return;
    this.active = false;
    this.resetKeyState();
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup",   this.onKeyUp);
    this.pointerLock.removeEventListener("unlock", this.onUnlock);
    if (this.pointerLock.isLocked) this.pointerLock.unlock();
  }

  /** True when pointer is locked and movement keys are active. */
  isActive(): boolean {
    return this.active && this.pointerLock.isLocked;
  }

  /** Per-frame update — advances camera position by current velocity. */
  update(dt: number): void {
    if (!this.isActive()) return;
    const v = this.speed * (this.sprinting ? this.sprintMultiplier : 1) * dt;
    if (this.moveForward) this.pointerLock.moveForward(v);
    if (this.moveBack)    this.pointerLock.moveForward(-v);
    if (this.moveLeft)    this.pointerLock.moveRight(-v);
    if (this.moveRight)   this.pointerLock.moveRight(v);
    if (this.moveUp || this.moveDown) {
      this.upDelta.set(0, (this.moveUp ? v : 0) - (this.moveDown ? v : 0), 0);
      // PointerLockControls' object IS the camera — translate world-Y.
      this.pointerLock.object.position.add(this.upDelta);
    }
  }

  dispose(): void {
    this.disable();
    this.pointerLock.dispose();
  }

  // ── Event handlers ────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === this.keys.forward) this.moveForward = true;
    if (e.code === this.keys.back)    this.moveBack    = true;
    if (e.code === this.keys.left)    this.moveLeft    = true;
    if (e.code === this.keys.right)   this.moveRight   = true;
    if (e.code === this.keys.up)      { this.moveUp = true; e.preventDefault(); }
    // Shift handles both sprint AND descend; sprint wins when any
    // horizontal movement is active, descend when stationary or only
    // vertical movement is requested.
    if (e.code === this.keys.sprint)  this.sprinting = true;
    if (e.code === this.keys.down && e.code !== this.keys.sprint) this.moveDown = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === this.keys.forward) this.moveForward = false;
    if (e.code === this.keys.back)    this.moveBack    = false;
    if (e.code === this.keys.left)    this.moveLeft    = false;
    if (e.code === this.keys.right)   this.moveRight   = false;
    if (e.code === this.keys.up)      this.moveUp      = false;
    if (e.code === this.keys.sprint)  this.sprinting   = false;
    if (e.code === this.keys.down && e.code !== this.keys.sprint) this.moveDown = false;
  };

  /** ESC or click outside the canvas releases pointer lock. */
  private onUnlock = (): void => {
    this.resetKeyState();
    this.active = false;
  };

  private resetKeyState(): void {
    this.moveForward = false;
    this.moveBack = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;
    this.sprinting = false;
  }
}
