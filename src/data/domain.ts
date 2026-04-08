/**
 * Area42 v2 Domain Context
 *
 * Groups related ReactiveSource instances under a domain identity
 * with shared styling. Provides factory methods for creating
 * domain-aware panels and elements.
 *
 * A domain context is like a "namespace" for a part of your dashboard:
 * routing, missions, banking, etc. All elements created from a domain
 * share the same data sources and visual style.
 */

import { SceneNode, type Vec2 } from "../core/scene.js";
import { type PartialStyle } from "../core/style.js";
import { Panel, type PanelOptions } from "../panels/panel.js";
import { type ReactiveSource, type Unsubscribe } from "./reactive.js";

export interface DomainOptions {
  /** Domain-specific style overrides (accent color, etc.) */
  style?: PartialStyle;

  /** Named reactive data sources for this domain */
  sources?: Record<string, ReactiveSource<any>>;
}

/**
 * A domain context groups data sources and visual style for a logical area
 * of the dashboard (e.g., "routing", "missions", "banking").
 */
export class DomainContext {
  readonly name: string;
  readonly style: PartialStyle;
  readonly sources: Map<string, ReactiveSource<any>> = new Map();

  /** All elements created by this domain (for bulk cleanup) */
  private _elements: SceneNode[] = [];
  private _subscriptions: Unsubscribe[] = [];

  constructor(name: string, options: DomainOptions = {}) {
    this.name = name;
    this.style = options.style ?? {};

    if (options.sources) {
      for (const [key, source] of Object.entries(options.sources)) {
        source.domain = name;
        this.sources.set(key, source);
      }
    }
  }

  /** Get a named source */
  source<T = any>(name: string): ReactiveSource<T> | undefined {
    return this.sources.get(name) as ReactiveSource<T> | undefined;
  }

  /** Add a source */
  addSource(name: string, source: ReactiveSource<any>): void {
    source.domain = this.name;
    this.sources.set(name, source);
  }

  /**
   * Create a Panel with this domain's style applied.
   * The panel's accent color defaults to the domain's accent.
   */
  createPanel(options: PanelOptions): Panel {
    const panel = new Panel({
      ...options,
      titleColor: options.titleColor ?? (this.style.accent as string) ?? undefined,
    });
    panel.style = { ...this.style, ...panel.style };
    this._elements.push(panel);
    return panel;
  }

  /**
   * Create a SceneNode with this domain's style applied.
   * Useful for custom elements that need domain styling.
   */
  createElement(options: {
    id?: string;
    size?: Vec2;
    style?: PartialStyle;
  } = {}): SceneNode {
    const node = new SceneNode({
      id: options.id,
      size: options.size ?? { x: 100, y: 50 },
    });
    node.style = { ...this.style, ...options.style };
    this._elements.push(node);
    return node;
  }

  /**
   * Subscribe to a source and auto-track the subscription for cleanup.
   */
  subscribe<T>(source: ReactiveSource<T>, callback: (data: T) => void): Unsubscribe {
    const unsub = source.onChange(callback);
    this._subscriptions.push(unsub);
    return unsub;
  }

  /**
   * Destroy all elements and subscriptions created by this domain.
   */
  destroy(): void {
    for (const unsub of this._subscriptions) {
      unsub();
    }
    this._subscriptions = [];

    for (const source of this.sources.values()) {
      source.destroy?.();
    }
    this.sources.clear();

    this._elements = [];
  }
}
