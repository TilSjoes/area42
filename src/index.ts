/**
 * Area42 — Futuristic HUD Visualization Engine
 *
 * Zero-dependency Canvas 2D visualization library for real-time
 * system monitoring dashboards with force-directed graphs,
 * particle effects, and glass morphism panels.
 *
 * @packageDocumentation
 * @dontpanic/area42
 * https://github.com/TilSjoes/area42
 */

// Core
export { HUD } from "./core/hud.js";
export type { HUDOptions } from "./core/hud.js";
export { Renderer } from "./core/renderer.js";
export type { RenderContext } from "./core/renderer.js";
export { Scene, SceneNode } from "./core/scene.js";
export type { Vec2, Transform, SceneNodeOptions } from "./core/scene.js";

// Graph
export { Graph, GraphNode, GraphEdge } from "./graph/graph.js";
export type { GraphNodeOptions, GraphEdgeOptions, ParticleOptions, LayoutType } from "./graph/graph.js";

// Panels
export { Panel } from "./panels/panel.js";
export type { PanelOptions, SnapZone } from "./panels/panel.js";
export { MetricDisplay } from "./panels/metric.js";
export type { MetricEntry } from "./panels/metric.js";

// Charts
export { TimeSeries } from "./charts/timeseries.js";
export type { TimeSeriesPoint } from "./charts/timeseries.js";

// Effects
export { ParticleSystem } from "./effects/particles.js";
export type { Particle, EmitOptions } from "./effects/particles.js";

// Data Sources
export { WebSocketSource, RESTSource, SSESource } from "./data/source.js";
export type { DataSource } from "./data/source.js";

// Themes
export { NeonTheme, GlassTheme } from "./themes/neon.js";
export type { Theme } from "./themes/neon.js";

// Table
export { Table } from "./panels/table.js";
export type { TableColumn, TableRow } from "./panels/table.js";

// MiniGraph
export { MiniGraph } from "./panels/minigraph.js";
export type { MiniNode, MiniEdge } from "./panels/minigraph.js";

export { DetailPanel } from "./panels/detail.js";
export { ContextMenu } from "./panels/contextmenu.js";export type { MenuItem } from "./panels/contextmenu.js";export { HelpOverlay } from "./panels/helpoverlay.js";
export type { NodeDetail, DetailSection, DetailField } from "./panels/detail.js";

export { withAlpha } from "./core/color.js";
