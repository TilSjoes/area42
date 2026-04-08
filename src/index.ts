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
export { Scene, SceneNode, Container } from "./core/scene.js";
export type { Vec2, Rect, Transform, Overflow, SceneNodeOptions } from "./core/scene.js";

// Graph
export { Graph, GraphNode, GraphEdge } from "./graph/graph.js";
export type { GraphNodeOptions, GraphEdgeOptions, ParticleOptions, LayoutType } from "./graph/graph.js";

// Panels
export { Panel } from "./panels/panel.js";
export type { PanelOptions, SnapZone } from "./panels/panel.js";
export { MetricDisplay } from "./panels/metric.js";
export type { MetricEntry } from "./panels/metric.js";

// Charts
export { Swimlane } from "./charts/swimlane.js";
export type { SwimlaneGroup, SwimlaneLane, SwimlaneEvent, SwimlaneOptions } from "./charts/swimlane.js";
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

// Status Bar
export { StatusBar } from "./panels/statusbar.js";
export type { StatusItem } from "./panels/statusbar.js";

// Breadcrumb
export { Breadcrumb } from "./panels/breadcrumb.js";
export type { BreadcrumbItem } from "./panels/breadcrumb.js";

// Command Palette
export { CommandPalette } from "./panels/command.js";
export type { CommandItem } from "./panels/command.js";

export { withAlpha } from "./core/color.js";

// Gauge
export { Gauge } from "./charts/gauge.js";
export type { GaugeOptions } from "./charts/gauge.js";

// Heatmap
export { Heatmap } from "./charts/heatmap.js";
export type { HeatmapOptions } from "./charts/heatmap.js";

// Tree
export { Tree } from "./graph/tree.js";
export type { TreeNodeData, TreeOptions } from "./graph/tree.js";

// Toast
export { ToastManager } from "./panels/toast.js";
export type { ToastOptions } from "./panels/toast.js";

// Export System
export { Exporter } from "./core/export.js";

// Selection Analysis
export { analyzeSelection, renderAnalysis } from "./core/analysis.js";
export type { AnalysisResult, PathResult, ClusterResult } from "./core/analysis.js";

// Forest
export { Forest } from "./graph/forest.js";
export type { ForestTree, ForestLink, ForestOptions, PerspectiveOptions } from "./graph/forest.js";

// Panel3D (optional — requires three.js)
export { Panel3D } from "./panels/panel3d.js";
export type { Panel3DOptions } from "./panels/panel3d.js";

// Interactive Controls (canvas-rendered — legacy, prefer Panel Controls)
export { Knob, Slider, Toggle, InputField, wireControls } from "./interactions/controls.js";
export type { KnobOptions, SliderOptions, ToggleOptions, InputFieldOptions } from "./interactions/controls.js";

// Panel Controls (HTML overlay — recommended for all interactive elements)
export { ControlManager } from "./interactions/panel-controls.js";
export type { ButtonControl, RadioGroupControl, SliderControl, ToggleControl, InputControl, PanelControl } from "./interactions/panel-controls.js";
