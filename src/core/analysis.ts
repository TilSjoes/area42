/**
 * Area42 Selection Analysis
 *
 * When 2+ nodes are selected, automatically analyze relationships between them.
 * Purely structural analysis (no AI) -- finds common properties, paths, clusters.
 * Foundation for SOC incident analysis and AML investigation correlation.
 */

import type { GraphNode, GraphEdge } from "../graph/graph.js";
import type { Graph } from "../graph/graph.js";

export interface AnalysisResult {
  nodeCount: number;
  edgeCount: number;
  nodes: { id: string; label: string; color: string }[];
  directEdges: { from: string; to: string; label: string }[];
  commonProperties: { key: string; value: string }[];
  paths: PathResult[];
  clusters: ClusterResult[];
}

export interface PathResult {
  from: string;
  to: string;
  path: string[];
  length: number;
}

export interface ClusterResult {
  nodes: string[];
  density: number;
}

/** Analyze relationships between selected nodes */
export function analyzeSelection(graph: Graph, selectedNodes: GraphNode[]): AnalysisResult {
  const selectedIds = new Set(selectedNodes.map(n => n.id));
  const allEdges = graph.getEdges();
  const allNodes = graph.getNodes();

  // Find direct edges between selected nodes
  const directEdges = allEdges.filter(
    e => selectedIds.has(e.from) && selectedIds.has(e.to)
  );

  // Find common properties
  const commonProperties = findCommonProperties(selectedNodes);

  // Find shortest paths between all pairs
  const paths = findAllPairsPaths(selectedNodes, allNodes, allEdges);

  // Detect clusters among selected nodes
  const clusters = detectClusters(selectedNodes, directEdges);

  return {
    nodeCount: selectedNodes.length,
    edgeCount: directEdges.length,
    nodes: selectedNodes.map(n => ({ id: n.id, label: n.label, color: n.color })),
    directEdges: directEdges.map(e => ({ from: e.from, to: e.to, label: e.label })),
    commonProperties,
    paths,
    clusters,
  };
}

/** Find properties common to all selected nodes */
function findCommonProperties(nodes: GraphNode[]): { key: string; value: string }[] {
  if (nodes.length < 2) return [];
  const result: { key: string; value: string }[] = [];

  // Check shape
  const shapes = new Set(nodes.map(n => n.shape));
  if (shapes.size === 1) {
    result.push({ key: "Shape", value: [...shapes][0] });
  }

  // Check color
  const colors = new Set(nodes.map(n => n.color));
  if (colors.size === 1) {
    result.push({ key: "Color", value: [...colors][0] });
  }

  // Check parentId
  const parents = new Set(nodes.map(n => n.parentId).filter(Boolean));
  if (parents.size === 1) {
    result.push({ key: "Parent", value: [...parents][0]! });
  }

  // Check data properties
  const dataNodes = nodes.filter(n => n.data && typeof n.data === "object");
  if (dataNodes.length === nodes.length) {
    // Get all keys from first node's data
    const firstData = dataNodes[0].data;
    for (const key of Object.keys(firstData)) {
      if (key.startsWith("_")) continue;
      const values = new Set(dataNodes.map(n => {
        const v = n.data[key];
        return v == null ? undefined : String(v);
      }).filter(v => v !== undefined));
      if (values.size === 1) {
        result.push({ key, value: [...values][0]! });
      }
    }
  }

  return result;
}

/** BFS shortest path between two nodes */
function bfsPath(
  fromId: string,
  toId: string,
  nodeMap: Map<string, GraphNode>,
  adjacency: Map<string, string[]>
): string[] | null {
  if (fromId === toId) return [fromId];

  const visited = new Set<string>();
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current.id) || [];

    for (const next of neighbors) {
      if (visited.has(next)) continue;
      const newPath = [...current.path, next];

      if (next === toId) return newPath;

      visited.add(next);
      queue.push({ id: next, path: newPath });
    }
  }

  return null;
}

/** Find shortest paths between all pairs of selected nodes */
function findAllPairsPaths(
  selectedNodes: GraphNode[],
  allNodes: GraphNode[],
  allEdges: GraphEdge[]
): PathResult[] {
  // Build adjacency list (undirected)
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map<string, GraphNode>();

  for (const n of allNodes) {
    nodeMap.set(n.id, n);
    if (!adjacency.has(n.id)) adjacency.set(n.id, []);
  }

  for (const e of allEdges) {
    const fromList = adjacency.get(e.from);
    const toList = adjacency.get(e.to);
    if (fromList) fromList.push(e.to);
    if (toList) toList.push(e.from);
  }

  const results: PathResult[] = [];

  for (let i = 0; i < selectedNodes.length; i++) {
    for (let j = i + 1; j < selectedNodes.length; j++) {
      const from = selectedNodes[i];
      const to = selectedNodes[j];
      const path = bfsPath(from.id, to.id, nodeMap, adjacency);

      if (path) {
        results.push({
          from: from.id,
          to: to.id,
          path,
          length: path.length - 1,
        });
      }
    }
  }

  // Sort by path length (shortest first)
  results.sort((a, b) => a.length - b.length);
  return results;
}

/** Detect clusters among selected nodes based on direct connections */
function detectClusters(nodes: GraphNode[], edges: GraphEdge[]): ClusterResult[] {
  if (nodes.length < 2) return [];

  const nodeIds = nodes.map(n => n.id);
  const adjacency = new Map<string, Set<string>>();

  for (const id of nodeIds) {
    adjacency.set(id, new Set());
  }

  for (const e of edges) {
    adjacency.get(e.from)?.add(e.to);
    adjacency.get(e.to)?.add(e.from);
  }

  // Simple connected components via BFS
  const visited = new Set<string>();
  const clusters: ClusterResult[] = [];

  for (const id of nodeIds) {
    if (visited.has(id)) continue;

    const component: string[] = [];
    const queue = [id];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length >= 2) {
      // Calculate density: actual edges / possible edges
      const possibleEdges = component.length * (component.length - 1) / 2;
      let actualEdges = 0;
      const compSet = new Set(component);
      for (const e of edges) {
        if (compSet.has(e.from) && compSet.has(e.to)) actualEdges++;
      }
      clusters.push({
        nodes: component,
        density: possibleEdges > 0 ? actualEdges / possibleEdges : 0,
      });
    }
  }

  return clusters;
}

/** Render the analysis result into a canvas region */
export function renderAnalysis(
  ctx: CanvasRenderingContext2D,
  result: AnalysisResult,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  let cy = y;
  const lineH = 14;
  const sectionGap = 8;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Title
  ctx.fillStyle = "#00d4aa";
  ctx.font = "bold 10px system-ui";
  ctx.textBaseline = "top";
  ctx.fillText("SELECTION ANALYSIS", x, cy);
  cy += lineH + 2;

  // Summary
  ctx.fillStyle = "#c8d6e5";
  ctx.font = "10px system-ui";
  ctx.fillText(result.nodeCount + " nodes selected, " + result.edgeCount + " direct edges", x, cy);
  cy += lineH + sectionGap;

  // Selected nodes
  ctx.fillStyle = "#6b7b8d";
  ctx.font = "bold 9px system-ui";
  ctx.fillText("NODES", x, cy);
  cy += lineH;

  for (const node of result.nodes) {
    if (cy > y + h - lineH) break;
    // Color dot
    ctx.beginPath();
    ctx.arc(x + 5, cy + 5, 3, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    // Label
    ctx.fillStyle = "#c8d6e5";
    ctx.font = "9px system-ui";
    ctx.fillText(node.label, x + 14, cy);
    cy += lineH;
  }
  cy += sectionGap;

  // Direct edges
  if (result.directEdges.length > 0 && cy < y + h - lineH * 2) {
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "bold 9px system-ui";
    ctx.fillText("DIRECT CONNECTIONS", x, cy);
    cy += lineH;

    for (const edge of result.directEdges) {
      if (cy > y + h - lineH) break;
      ctx.fillStyle = "#c8d6e5";
      ctx.font = "9px system-ui";
      const fromNode = result.nodes.find(n => n.id === edge.from);
      const toNode = result.nodes.find(n => n.id === edge.to);
      const label = (fromNode?.label || edge.from) + " -> " + (toNode?.label || edge.to);
      ctx.fillText(label, x + 4, cy);
      cy += lineH;
    }
    cy += sectionGap;
  }

  // Common properties
  if (result.commonProperties.length > 0 && cy < y + h - lineH * 2) {
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "bold 9px system-ui";
    ctx.fillText("COMMON PROPERTIES", x, cy);
    cy += lineH;

    for (const prop of result.commonProperties) {
      if (cy > y + h - lineH) break;
      ctx.fillStyle = "#4dabf7";
      ctx.font = "9px system-ui";
      ctx.fillText(prop.key + ": ", x + 4, cy);
      const keyW = ctx.measureText(prop.key + ": ").width;
      ctx.fillStyle = "#c8d6e5";
      ctx.fillText(prop.value, x + 4 + keyW, cy);
      cy += lineH;
    }
    cy += sectionGap;
  }

  // Path analysis
  if (result.paths.length > 0 && cy < y + h - lineH * 2) {
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "bold 9px system-ui";
    ctx.fillText("PATHS", x, cy);
    cy += lineH;

    for (const path of result.paths.slice(0, 5)) {
      if (cy > y + h - lineH) break;
      const fromNode = result.nodes.find(n => n.id === path.from);
      const toNode = result.nodes.find(n => n.id === path.to);
      ctx.fillStyle = path.length <= 1 ? "#51cf66" : path.length <= 2 ? "#ffd43b" : "#ff6b6b";
      ctx.font = "9px system-ui";
      const label = (fromNode?.label || path.from) + " -> " + (toNode?.label || path.to) + " (" + path.length + " hop" + (path.length !== 1 ? "s" : "") + ")";
      ctx.fillText(label, x + 4, cy);
      cy += lineH;
    }
    cy += sectionGap;
  }

  // Clusters
  if (result.clusters.length > 0 && cy < y + h - lineH * 2) {
    ctx.fillStyle = "#6b7b8d";
    ctx.font = "bold 9px system-ui";
    ctx.fillText("CLUSTERS", x, cy);
    cy += lineH;

    for (const cluster of result.clusters) {
      if (cy > y + h - lineH) break;
      ctx.fillStyle = "#a78bfa";
      ctx.font = "9px system-ui";
      ctx.fillText(cluster.nodes.length + " nodes, density: " + (cluster.density * 100).toFixed(0) + "%", x + 4, cy);
      cy += lineH;
    }
  }

  ctx.restore();
}
