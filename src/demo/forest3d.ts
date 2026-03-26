/**
 * Area42 — 3D Forest Demo (Experimental)
 *
 * True 3D rendering of IAM/GDPR/AML forest data using Three.js.
 * Standalone experiment, NOT integrated into the Area42 Canvas 2D library.
 *
 * Features:
 * - PerspectiveCamera with OrbitControls
 * - Glass-like transparent node boxes with emissive glow
 * - TubeGeometry pipe edges between nodes
 * - Cross-tree curved links with particle flow
 * - Raycaster hover/click interaction
 * - Double-click collapse/expand with animation
 * - Auto-rotation when idle
 * - View switching (IAM / GDPR / AML)
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// ============================================================================
// Types
// ============================================================================

interface TreeNodeData {
  id: string;
  label: string;
  color: string;
  children?: TreeNodeData[];
  collapsed?: boolean;
}

interface ForestTree {
  id: string;
  label: string;
  color: string;
  root: TreeNodeData;
}

interface ForestLink {
  fromTree: string;
  fromNode: string;
  toTree: string;
  toNode: string;
  label?: string;
  color: string;
  style?: "solid" | "dashed";
}

interface NodeMesh {
  id: string;
  treeId: string;
  mesh: THREE.Mesh;
  label: CSS2DObject;
  data: TreeNodeData;
  position: THREE.Vector3;
  children: NodeMesh[];
  parent: NodeMesh | null;
  edges: THREE.Mesh[];
  visible: boolean;
  targetScale: number;
  spotlight: THREE.PointLight;
}

// ============================================================================
// Data Sets (same as 2D forest demo)
// ============================================================================

function createIAMData(): { trees: ForestTree[]; links: ForestLink[] } {
  const users: TreeNodeData = {
    id: "users-root", label: "Users", color: "#00d4aa",
    children: [
      { id: "admin-group", label: "Admin Group", color: "#00d4aa", children: [
        { id: "user-ford", label: "Ford Prefect", color: "#51cf66" },
        { id: "user-arthur", label: "Arthur Dent", color: "#51cf66" },
        { id: "user-trillian", label: "Trillian", color: "#51cf66" },
      ]},
      { id: "dev-group", label: "Dev Group", color: "#00d4aa", children: [
        { id: "user-zaphod", label: "Zaphod", color: "#51cf66" },
        { id: "user-marvin", label: "Marvin", color: "#51cf66" },
      ]},
      { id: "audit-group", label: "Audit Group", color: "#00d4aa", children: [
        { id: "user-slartibartfast", label: "Slartibartfast", color: "#51cf66" },
      ]},
    ],
  };
  const roles: TreeNodeData = {
    id: "roles-root", label: "Roles", color: "#7b68ee",
    children: [
      { id: "role-devops", label: "DevOps", color: "#7b68ee", children: [
        { id: "perm-deploy", label: "deploy", color: "#9775fa" },
        { id: "perm-monitor", label: "monitor", color: "#9775fa" },
        { id: "perm-configure", label: "configure", color: "#9775fa" },
      ]},
      { id: "role-sysadmin", label: "System Admin", color: "#7b68ee", children: [
        { id: "perm-root", label: "root-access", color: "#9775fa" },
        { id: "perm-network", label: "network", color: "#9775fa" },
      ]},
      { id: "role-auditor", label: "Auditor", color: "#7b68ee", children: [
        { id: "perm-read-logs", label: "read-logs", color: "#9775fa" },
        { id: "perm-compliance", label: "compliance", color: "#9775fa" },
      ]},
    ],
  };
  const resources: TreeNodeData = {
    id: "resources-root", label: "Resources", color: "#f97316",
    children: [
      { id: "sys-arthur", label: "Arthur (VM)", color: "#f97316", children: [
        { id: "ep-missions", label: "/api/missions", color: "#fb923c" },
        { id: "ep-brain", label: "/api/brain", color: "#fb923c" },
        { id: "ep-dream", label: "/api/dream", color: "#fb923c" },
      ]},
      { id: "sys-morpheus", label: "Morpheus (GPU)", color: "#f97316", children: [
        { id: "ep-ollama", label: "/api/generate", color: "#fb923c" },
        { id: "ep-comfyui", label: ":8188/ws", color: "#fb923c" },
      ]},
      { id: "sys-trillian", label: "Trillian (Dev)", color: "#f97316", children: [
        { id: "ep-ssh", label: "SSH :22", color: "#fb923c" },
      ]},
    ],
  };
  return {
    trees: [
      { id: "iam-users", label: "USERS", color: "#00d4aa", root: users },
      { id: "iam-roles", label: "ROLES", color: "#7b68ee", root: roles },
      { id: "iam-resources", label: "RESOURCES", color: "#f97316", root: resources },
    ],
    links: [
      { fromTree: "iam-users", fromNode: "user-ford", toTree: "iam-roles", toNode: "role-devops", label: "assigned", color: "#4dabf7", style: "dashed" },
      { fromTree: "iam-users", fromNode: "user-arthur", toTree: "iam-roles", toNode: "role-sysadmin", label: "assigned", color: "#4dabf7", style: "dashed" },
      { fromTree: "iam-users", fromNode: "user-slartibartfast", toTree: "iam-roles", toNode: "role-auditor", label: "assigned", color: "#4dabf7", style: "dashed" },
      { fromTree: "iam-roles", fromNode: "perm-deploy", toTree: "iam-resources", toNode: "ep-missions", label: "grants", color: "#ffd43b", style: "dashed" },
      { fromTree: "iam-roles", fromNode: "perm-monitor", toTree: "iam-resources", toNode: "ep-brain", label: "grants", color: "#ffd43b", style: "dashed" },
      { fromTree: "iam-roles", fromNode: "perm-root", toTree: "iam-resources", toNode: "sys-arthur", label: "full access", color: "#ff6b6b" },
    ],
  };
}

function createGDPRData(): { trees: ForestTree[]; links: ForestLink[] } {
  const subjects: TreeNodeData = {
    id: "subjects-root", label: "Data Subjects", color: "#22d3ee",
    children: [
      { id: "cat-employees", label: "Employees", color: "#22d3ee", children: [
        { id: "subj-ole", label: "Ole Nordmann", color: "#67e8f9" },
        { id: "subj-kari", label: "Kari Hansen", color: "#67e8f9" },
      ]},
      { id: "cat-customers", label: "Customers", color: "#22d3ee", children: [
        { id: "subj-nils", label: "Nils Berg", color: "#67e8f9" },
        { id: "subj-ingrid", label: "Ingrid Vik", color: "#67e8f9" },
        { id: "subj-per", label: "Per Olsen", color: "#67e8f9" },
      ]},
    ],
  };
  const purposes: TreeNodeData = {
    id: "purposes-root", label: "Purposes", color: "#a78bfa",
    children: [
      { id: "purp-service", label: "Service Delivery", color: "#a78bfa", children: [
        { id: "basis-contract", label: "Art.6(1)(b) Contract", color: "#c4b5fd" },
      ]},
      { id: "purp-marketing", label: "Marketing", color: "#a78bfa", children: [
        { id: "basis-consent", label: "Art.6(1)(a) Consent", color: "#c4b5fd" },
      ]},
      { id: "purp-compliance", label: "AML Compliance", color: "#a78bfa", children: [
        { id: "basis-legal", label: "Art.6(1)(c) Legal", color: "#c4b5fd" },
      ]},
      { id: "purp-analytics", label: "Analytics", color: "#a78bfa", children: [
        { id: "basis-interest", label: "Art.6(1)(f) Interest", color: "#c4b5fd" },
      ]},
    ],
  };
  const dataTypes: TreeNodeData = {
    id: "data-root", label: "Data Types", color: "#fb7185",
    children: [
      { id: "dtype-personal", label: "Personal Data", color: "#fb7185", children: [
        { id: "store-pg", label: "PostgreSQL", color: "#fda4af" },
        { id: "store-s3", label: "S3 Backup", color: "#fda4af" },
      ]},
      { id: "dtype-financial", label: "Financial Data", color: "#fb7185", children: [
        { id: "store-ledger", label: "Core Ledger", color: "#fda4af" },
      ]},
      { id: "dtype-behavioral", label: "Behavioral Data", color: "#fb7185", children: [
        { id: "store-analytics", label: "Analytics DB", color: "#fda4af" },
        { id: "store-logs", label: "Log Archive", color: "#fda4af" },
      ]},
    ],
  };
  return {
    trees: [
      { id: "gdpr-subjects", label: "SUBJECTS", color: "#22d3ee", root: subjects },
      { id: "gdpr-purposes", label: "PURPOSES", color: "#a78bfa", root: purposes },
      { id: "gdpr-data", label: "DATA", color: "#fb7185", root: dataTypes },
    ],
    links: [
      { fromTree: "gdpr-subjects", fromNode: "subj-nils", toTree: "gdpr-purposes", toNode: "purp-service", label: "consent", color: "#22d3ee", style: "dashed" },
      { fromTree: "gdpr-subjects", fromNode: "subj-ingrid", toTree: "gdpr-purposes", toNode: "purp-marketing", label: "opted-in", color: "#22d3ee", style: "dashed" },
      { fromTree: "gdpr-subjects", fromNode: "subj-ole", toTree: "gdpr-purposes", toNode: "purp-compliance", label: "mandatory", color: "#ffd43b" },
      { fromTree: "gdpr-purposes", fromNode: "purp-service", toTree: "gdpr-data", toNode: "dtype-personal", label: "processes", color: "#a78bfa", style: "dashed" },
      { fromTree: "gdpr-purposes", fromNode: "purp-analytics", toTree: "gdpr-data", toNode: "dtype-behavioral", label: "collects", color: "#a78bfa", style: "dashed" },
      { fromTree: "gdpr-purposes", fromNode: "purp-compliance", toTree: "gdpr-data", toNode: "dtype-financial", label: "requires", color: "#ff6b6b" },
    ],
  };
}

function createAMLData(): { trees: ForestTree[]; links: ForestLink[] } {
  const customers: TreeNodeData = {
    id: "cust-root", label: "Customers", color: "#00d4aa",
    children: [
      { id: "seg-retail", label: "Retail", color: "#00d4aa", children: [
        { id: "cust-nordmann", label: "Ole Nordmann", color: "#51cf66" },
        { id: "cust-hansen", label: "Kari Hansen", color: "#51cf66" },
        { id: "cust-berg", label: "Nils Berg", color: "#ffd43b" },
      ]},
      { id: "seg-corporate", label: "Corporate", color: "#00d4aa", children: [
        { id: "cust-acme", label: "ACME Holding AS", color: "#ff6b6b" },
        { id: "cust-fjord", label: "Fjord Tech AS", color: "#51cf66" },
      ]},
    ],
  };
  const products: TreeNodeData = {
    id: "prod-root", label: "Products", color: "#4dabf7",
    children: [
      { id: "ptype-savings", label: "Savings", color: "#4dabf7", children: [
        { id: "acct-savings-1", label: "1234.56.78901", color: "#74c0fc" },
        { id: "acct-savings-2", label: "1234.56.78902", color: "#74c0fc" },
      ]},
      { id: "ptype-checking", label: "Checking", color: "#4dabf7", children: [
        { id: "acct-check-1", label: "9876.54.32101", color: "#74c0fc" },
        { id: "acct-check-2", label: "9876.54.32102", color: "#ffd43b" },
      ]},
      { id: "ptype-business", label: "Business", color: "#4dabf7", children: [
        { id: "acct-biz-1", label: "5555.00.10001", color: "#ff6b6b" },
      ]},
    ],
  };
  const transactions: TreeNodeData = {
    id: "txn-root", label: "Transactions", color: "#f97316",
    children: [
      { id: "txn-normal", label: "Normal", color: "#51cf66", children: [
        { id: "txn-001", label: "NOK 1,200", color: "#51cf66" },
        { id: "txn-002", label: "NOK 8,500", color: "#51cf66" },
        { id: "txn-003", label: "NOK 450", color: "#51cf66" },
      ]},
      { id: "txn-suspicious", label: "Suspicious", color: "#ffd43b", children: [
        { id: "txn-flag-1", label: "NOK 149,999", color: "#ffd43b" },
        { id: "txn-flag-2", label: "EUR 49,800", color: "#ffd43b" },
      ]},
      { id: "txn-blocked", label: "Blocked", color: "#ff6b6b", children: [
        { id: "txn-block-1", label: "USD 250,000", color: "#ff6b6b" },
      ]},
    ],
  };
  return {
    trees: [
      { id: "aml-customers", label: "CUSTOMERS", color: "#00d4aa", root: customers },
      { id: "aml-products", label: "PRODUCTS", color: "#4dabf7", root: products },
      { id: "aml-transactions", label: "TRANSACTIONS", color: "#f97316", root: transactions },
    ],
    links: [
      { fromTree: "aml-customers", fromNode: "cust-nordmann", toTree: "aml-products", toNode: "acct-savings-1", label: "owns", color: "#4dabf7", style: "dashed" },
      { fromTree: "aml-customers", fromNode: "cust-hansen", toTree: "aml-products", toNode: "acct-check-1", label: "owns", color: "#4dabf7", style: "dashed" },
      { fromTree: "aml-customers", fromNode: "cust-acme", toTree: "aml-products", toNode: "acct-biz-1", label: "owns", color: "#ff6b6b" },
      { fromTree: "aml-products", fromNode: "acct-check-2", toTree: "aml-transactions", toNode: "txn-flag-1", label: "flagged", color: "#ffd43b", style: "dashed" },
      { fromTree: "aml-products", fromNode: "acct-biz-1", toTree: "aml-transactions", toNode: "txn-block-1", label: "BLOCKED", color: "#ff6b6b" },
      { fromTree: "aml-products", fromNode: "acct-savings-1", toTree: "aml-transactions", toNode: "txn-001", label: "normal", color: "#51cf66", style: "dashed" },
    ],
  };
}

// ============================================================================
// Scene Setup
// ============================================================================

const BG_COLOR = 0x0a0e17;
const NODE_WIDTH = 80;
const NODE_HEIGHT = 10;
const NODE_DEPTH = 4;
const LEVEL_SPACING = 60;
const SIBLING_SPACING = 20;
const TREE_SPACING = 400;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(BG_COLOR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById("scene")!.appendChild(renderer.domElement);

// CSS2D Renderer for labels
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.left = "0";
labelRenderer.domElement.style.pointerEvents = "none";
document.getElementById("scene")!.appendChild(labelRenderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(BG_COLOR, 0.0008);

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.set(0, 250, 600);
camera.lookAt(0, 0, 0);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 100;
controls.maxDistance = 2000;
controls.maxPolarAngle = Math.PI * 0.85;
controls.target.set(0, -40, 0);

// ============================================================================
// Lighting
// ============================================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const topLight = new THREE.PointLight(0xffeedd, 1.5, 2000);
topLight.position.set(0, 400, 100);
scene.add(topLight);

const fillLight = new THREE.PointLight(0x4dabf7, 0.4, 1500);
fillLight.position.set(-300, 100, 300);
scene.add(fillLight);

// ============================================================================
// Floor
// ============================================================================

const floorGeom = new THREE.PlaneGeometry(2400, 1200);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x080c14,
  roughness: 0.3,
  metalness: 0.8,
  transparent: true,
  opacity: 0.6,
});
const floorMesh = new THREE.Mesh(floorGeom, floorMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = -180;
scene.add(floorMesh);

const grid = new THREE.GridHelper(2400, 60, 0x1a2744, 0x111b2e);
grid.position.y = -179;
scene.add(grid);

// ============================================================================
// State
// ============================================================================

type ViewName = "iam" | "gdpr" | "aml";
let currentView: ViewName = "iam";
let allNodeMeshes: NodeMesh[] = [];
let crossLinkMeshes: THREE.Object3D[] = [];
let crossLinkParticles: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; t: number; speed: number }[] = [];
let treeGroups: THREE.Group[] = [];
let treeLabelObjects: CSS2DObject[] = [];
let hoveredNode: NodeMesh | null = null;
let selectedNode: NodeMesh | null = null;

// Persistent collapsed state across reloads
const collapsedState: Record<string, boolean> = {};

// Auto-rotation
let autoRotate = true;
const IDLE_TIMEOUT = 5;
let lastInteraction = 0;

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Info overlay
const infoDiv = document.getElementById("info")!;

// ============================================================================
// Tree Layout & Mesh Creation
// ============================================================================

function calcSubtreeWidth(node: TreeNodeData): number {
  if (node.collapsed || !node.children || node.children.length === 0) return NODE_WIDTH;
  let total = 0;
  for (const child of node.children) {
    total += calcSubtreeWidth(child);
  }
  total += (node.children.length - 1) * SIBLING_SPACING;
  return Math.max(NODE_WIDTH, total);
}

function createNodeMaterial(color: string): THREE.MeshPhysicalMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.85,
    roughness: 0.15,
    metalness: 0.1,
    transmission: 0.2,
    thickness: 2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
}

function createNodeBox(data: TreeNodeData, treeId: string, pos: THREE.Vector3, group: THREE.Group): NodeMesh {
  const geom = new THREE.BoxGeometry(NODE_WIDTH, NODE_HEIGHT, NODE_DEPTH, 2, 1, 1);
  const mat = createNodeMaterial(data.color);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(pos);
  mesh.castShadow = true;
  mesh.userData = { nodeId: data.id, treeId };
  group.add(mesh);

  // Edge wireframe for glass effect
  const edgesGeom = new THREE.EdgesGeometry(geom);
  const edgeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(data.color),
    transparent: true,
    opacity: 0.4,
  });
  const edges = new THREE.LineSegments(edgesGeom, edgeMat);
  mesh.add(edges);

  // CSS2D label
  const labelDiv = document.createElement("div");
  labelDiv.className = "node-label";
  let labelText = data.label;
  if (data.children && data.children.length > 0 && data.collapsed) {
    labelText += " [+" + data.children.length + "]";
  }
  labelDiv.textContent = labelText;
  labelDiv.style.color = data.color;
  labelDiv.style.fontSize = "10px";
  labelDiv.style.fontWeight = "600";
  labelDiv.style.fontFamily = "system-ui, -apple-system, sans-serif";
  labelDiv.style.textShadow = "0 0 8px " + data.color + "66";
  labelDiv.style.whiteSpace = "nowrap";
  labelDiv.style.letterSpacing = "0.5px";

  const labelObj = new CSS2DObject(labelDiv);
  labelObj.position.set(0, NODE_HEIGHT * 0.8, 0);
  mesh.add(labelObj);

  // Subtle spotlight under each node
  const spotlight = new THREE.PointLight(new THREE.Color(data.color), 0.3, 80);
  spotlight.position.copy(pos);
  spotlight.position.y -= 15;
  group.add(spotlight);

  const nodeMesh: NodeMesh = {
    id: data.id,
    treeId,
    mesh,
    label: labelObj,
    data,
    position: pos.clone(),
    children: [],
    parent: null,
    edges: [],
    visible: true,
    targetScale: 1,
    spotlight,
  };

  allNodeMeshes.push(nodeMesh);
  return nodeMesh;
}

function createEdge(from: THREE.Vector3, to: THREE.Vector3, color: string, group: THREE.Group): THREE.Mesh {
  const mid1 = new THREE.Vector3(from.x, from.y - LEVEL_SPACING * 0.35, from.z);
  const mid2 = new THREE.Vector3(to.x, to.y + LEVEL_SPACING * 0.35, to.z);
  const curve = new THREE.CatmullRomCurve3([from.clone(), mid1, mid2, to.clone()]);
  const tubeGeom = new THREE.TubeGeometry(curve, 16, 0.8, 6, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.5,
    roughness: 0.4,
  });
  const tube = new THREE.Mesh(tubeGeom, tubeMat);
  group.add(tube);
  return tube;
}

function applyCollapsedState(node: TreeNodeData): void {
  if (collapsedState[node.id] !== undefined) {
    node.collapsed = collapsedState[node.id];
  }
  if (node.children) {
    for (const child of node.children) {
      applyCollapsedState(child);
    }
  }
}

function buildTree(tree: ForestTree, treeIndex: number): THREE.Group {
  const group = new THREE.Group();
  const offsetX = (treeIndex - 1) * TREE_SPACING;
  group.position.x = offsetX;
  group.rotation.y = Math.PI / 2;  // face along the tree line

  applyCollapsedState(tree.root);

  // Tree label
  const treeLabelDiv = document.createElement("div");
  treeLabelDiv.className = "tree-label";
  treeLabelDiv.textContent = tree.label;
  treeLabelDiv.style.color = tree.color;
  treeLabelDiv.style.fontSize = "16px";
  treeLabelDiv.style.fontWeight = "800";
  treeLabelDiv.style.letterSpacing = "4px";
  treeLabelDiv.style.fontFamily = "system-ui, -apple-system, sans-serif";
  treeLabelDiv.style.textShadow = "0 0 20px " + tree.color + "88";
  const treeLabelObj = new CSS2DObject(treeLabelDiv);
  treeLabelObj.position.set(0, 60, 0);
  group.add(treeLabelObj);
  treeLabelObjects.push(treeLabelObj);

  function layoutNode(
    data: TreeNodeData,
    cx: number,
    level: number,
    parentMesh: NodeMesh | null,
  ): NodeMesh {
    const pos = new THREE.Vector3(cx, -level * LEVEL_SPACING, 0);
    const nodeMesh = createNodeBox(data, tree.id, pos, group);
    nodeMesh.parent = parentMesh;

    if (parentMesh) {
      const edge = createEdge(parentMesh.position, pos, data.color, group);
      nodeMesh.edges.push(edge);
    }

    if (!data.collapsed && data.children && data.children.length > 0) {
      const stw = calcSubtreeWidth(data);
      let startX = cx - stw / 2;
      for (const child of data.children) {
        const childSTW = calcSubtreeWidth(child);
        const childCx = startX + childSTW / 2;
        const childMesh = layoutNode(child, childCx, level + 1, nodeMesh);
        nodeMesh.children.push(childMesh);
        startX += childSTW + SIBLING_SPACING;
      }
    }

    return nodeMesh;
  }

  layoutNode(tree.root, 0, 0, null);
  scene.add(group);
  treeGroups.push(group);
  return group;
}

// ============================================================================
// Cross-Tree Links
// ============================================================================

function buildCrossLinks(links: ForestLink[]): void {
  for (const link of links) {
    const fromNode = allNodeMeshes.find(n => n.id === link.fromNode && n.treeId === link.fromTree);
    const toNode = allNodeMeshes.find(n => n.id === link.toNode && n.treeId === link.toTree);
    if (!fromNode || !toNode) continue;

    const fromWorld = new THREE.Vector3();
    fromNode.mesh.getWorldPosition(fromWorld);
    const toWorld = new THREE.Vector3();
    toNode.mesh.getWorldPosition(toWorld);

    const mid = new THREE.Vector3().lerpVectors(fromWorld, toWorld, 0.5);
    mid.y += 80;
    mid.z += 30;

    const curve = new THREE.CatmullRomCurve3([
      fromWorld.clone(),
      new THREE.Vector3().lerpVectors(fromWorld, mid, 0.5).setY(mid.y * 0.7),
      mid,
      new THREE.Vector3().lerpVectors(mid, toWorld, 0.5).setY(mid.y * 0.7),
      toWorld.clone(),
    ]);

    const tubeGeom = new THREE.TubeGeometry(curve, 32, 0.5, 6, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(link.color),
      emissive: new THREE.Color(link.color),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: link.style === "dashed" ? 0.3 : 0.5,
      roughness: 0.3,
    });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    scene.add(tube);
    crossLinkMeshes.push(tube);

    // Flowing particles along cross-links
    const particleGeom = new THREE.SphereGeometry(1.5, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(link.color),
      transparent: true,
      opacity: 0.9,
    });

    for (let p = 0; p < 2; p++) {
      const particle = new THREE.Mesh(particleGeom.clone(), particleMat.clone());
      scene.add(particle);
      crossLinkMeshes.push(particle);
      crossLinkParticles.push({
        mesh: particle,
        curve,
        t: p * 0.5 + Math.random() * 0.3,
        speed: 0.15 + Math.random() * 0.1,
      });
    }
  }
}

// ============================================================================
// View Management
// ============================================================================

function clearScene(): void {
  for (const g of treeGroups) {
    scene.remove(g);
    g.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }
  treeGroups = [];
  treeLabelObjects = [];

  for (const obj of crossLinkMeshes) {
    scene.remove(obj);
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m: THREE.Material) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  }
  crossLinkMeshes = [];
  crossLinkParticles = [];
  allNodeMeshes = [];
  hoveredNode = null;
  selectedNode = null;
}

function loadView(view: ViewName): void {
  clearScene();
  currentView = view;

  let data: { trees: ForestTree[]; links: ForestLink[] };
  if (view === "iam") data = createIAMData();
  else if (view === "gdpr") data = createGDPRData();
  else data = createAMLData();

  for (let i = 0; i < data.trees.length; i++) {
    buildTree(data.trees[i], i);
  }
  buildCrossLinks(data.links);

  document.querySelectorAll(".view-btn").forEach(btn => {
    const el = btn as HTMLElement;
    el.classList.toggle("active", el.dataset.view === view);
  });
}

// ============================================================================
// Interaction
// ============================================================================

function onMouseMove(event: MouseEvent): void {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = allNodeMeshes.filter(n => n.visible).map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  if (hoveredNode) {
    const mat = hoveredNode.mesh.material as THREE.MeshPhysicalMaterial;
    mat.emissiveIntensity = selectedNode === hoveredNode ? 0.5 : 0.25;
    hoveredNode.spotlight.intensity = 0.3;
    document.body.style.cursor = "default";
  }

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const nm = allNodeMeshes.find(n => n.mesh === hit);
    if (nm) {
      hoveredNode = nm;
      const mat = nm.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.7;
      nm.spotlight.intensity = 0.8;
      document.body.style.cursor = "pointer";
    }
  } else {
    hoveredNode = null;
  }
}

function onClick(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest(".ui-overlay")) return;

  lastInteraction = performance.now() / 1000;
  autoRotate = false;

  raycaster.setFromCamera(mouse, camera);
  const meshes = allNodeMeshes.filter(n => n.visible).map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const nm = allNodeMeshes.find(n => n.mesh === hit);
    if (nm) {
      if (selectedNode && selectedNode !== nm) {
        const prevMat = selectedNode.mesh.material as THREE.MeshPhysicalMaterial;
        prevMat.emissiveIntensity = 0.25;
      }
      selectedNode = nm;
      const mat = nm.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.5;

      infoDiv.style.display = "block";
      infoDiv.innerHTML =
        '<div style="color:' + nm.data.color + ';font-weight:700;font-size:13px;margin-bottom:4px;">' + nm.data.label + '</div>' +
        '<div style="color:#6b7b8d;font-size:10px;">ID: ' + nm.id + '</div>' +
        '<div style="color:#6b7b8d;font-size:10px;">Tree: ' + nm.treeId + '</div>' +
        '<div style="color:#6b7b8d;font-size:10px;">Children: ' + (nm.data.children?.length ?? 0) + '</div>' +
        '<div style="color:#6b7b8d;font-size:10px;">Collapsed: ' + (nm.data.collapsed ? "yes" : "no") + '</div>' +
        '<div style="color:#4d5f73;font-size:9px;margin-top:6px;">Double-click to toggle</div>';
    }
  } else {
    if (selectedNode) {
      const mat = selectedNode.mesh.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = 0.25;
      selectedNode = null;
      infoDiv.style.display = "none";
    }
  }
}

function onDblClick(): void {
  raycaster.setFromCamera(mouse, camera);
  const meshes = allNodeMeshes.filter(n => n.visible).map(n => n.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    const nm = allNodeMeshes.find(n => n.mesh === hit);
    if (nm && nm.data.children && nm.data.children.length > 0) {
      nm.data.collapsed = !nm.data.collapsed;
      collapsedState[nm.id] = nm.data.collapsed;
      loadView(currentView);
    }
  }
}

// ============================================================================
// Auto-rotation
// ============================================================================

function onInteractionStart(): void {
  lastInteraction = performance.now() / 1000;
  autoRotate = false;
}

renderer.domElement.addEventListener("mousedown", onInteractionStart);
renderer.domElement.addEventListener("wheel", onInteractionStart);
renderer.domElement.addEventListener("touchstart", onInteractionStart);

// ============================================================================
// Animation Loop
// ============================================================================

const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const now = performance.now() / 1000;

  if (!autoRotate && now - lastInteraction > IDLE_TIMEOUT) {
    autoRotate = true;
  }

  if (autoRotate) {
    const angle = dt * 0.08;
    const pos = camera.position.clone().sub(controls.target);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = pos.x * cos - pos.z * sin;
    const nz = pos.x * sin + pos.z * cos;
    camera.position.set(nx + controls.target.x, camera.position.y, nz + controls.target.z);
    camera.lookAt(controls.target);
  }

  controls.update();

  // Animate cross-link particles
  for (const p of crossLinkParticles) {
    p.t = (p.t + dt * p.speed) % 1;
    const point = p.curve.getPoint(p.t);
    p.mesh.position.copy(point);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(now * 4 + p.t * 6) * 0.4;
  }

  // Node breathing glow
  for (const nm of allNodeMeshes) {
    if (nm === hoveredNode || nm === selectedNode) continue;
    const mat = nm.mesh.material as THREE.MeshPhysicalMaterial;
    mat.emissiveIntensity = 0.2 + Math.sin(now * 1.5 + nm.position.x * 0.01) * 0.05;
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// ============================================================================
// Event Listeners
// ============================================================================

window.addEventListener("mousemove", onMouseMove);
window.addEventListener("click", onClick);
window.addEventListener("dblclick", onDblClick);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = (btn as HTMLElement).dataset.view as ViewName;
    if (view && view !== currentView) {
      loadView(view);
    }
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "1") loadView("iam");
  else if (e.key === "2") loadView("gdpr");
  else if (e.key === "3") loadView("aml");
});

// ============================================================================
// Init
// ============================================================================

loadView("iam");
animate();
