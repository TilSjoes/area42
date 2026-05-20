/**
 * Area42 World — Three.js-backed surface for data-as-space exploration.
 *
 * Companion to the existing Canvas-2D HUD. Choose the surface that
 * fits the data:
 * - HUD            — small dashboards, panels, force-directed graphs
 * - WorldHUD       — knowledge graphs at scale, navigable 3D space
 *
 * Three.js is a peer dep — install it in the consumer:
 *     npm i three
 *
 * Both surfaces share the broader Area42 ecosystem (themes, data
 * sources, reactive primitives). They are not interchangeable — choose
 * by *what the data is*, not by aesthetic.
 */

export { WorldHUD, NeonWorldTheme } from "./world-hud.js";
export type { WorldHUDOptions, WorldTheme } from "./world-hud.js";
export { Graph3D } from "./graph3d.js";
export type { Node3DOptions, Edge3DOptions } from "./graph3d.js";
export { AxisFrame } from "./axis-frame.js";
export type { AxisFrameOptions, AxisTick } from "./axis-frame.js";
export { FlyControls } from "./fly-controls.js";
export type { FlyControlsOptions } from "./fly-controls.js";
export { makeTextSprite, makeTextMesh } from "./labels.js";
export type { TextSpriteOptions, TextMeshOptions } from "./labels.js";
export { scaleLinear, parseTime, categoricalIndex } from "./layout.js";
