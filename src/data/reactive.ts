/**
 * Area42 v2 Reactive Data Sources
 *
 * Reactive data binding layer. A ReactiveSource holds current data
 * and notifies subscribers when it changes. Supports field extraction
 * and drill-down for hierarchical data exploration.
 *
 * Works alongside existing DataSource (SSE/REST/WS) — adapters bridge
 * the event-based sources into the reactive model.
 */

/** Unsubscribe function returned by onChange */
export type Unsubscribe = () => void;

/**
 * A reactive data source that holds current state and notifies on change.
 */
export interface ReactiveSource<T = any> {
  /** Current data value */
  readonly data: T;

  /** Subscribe to data changes. Returns unsubscribe function. */
  onChange(callback: (data: T) => void): Unsubscribe;

  /** Optional: can this item be drilled down into? */
  canDrillDown?(item: any): boolean;

  /** Optional: create a child source for drill-down */
  drillDown?(item: any): ReactiveSource<any>;

  /** Human-readable label for this source */
  label?: string;

  /** Domain identifier (e.g., "routing", "missions", "banking") */
  domain?: string;

  /** Disconnect and clean up */
  destroy?(): void;
}

// ─── Implementations ───────────────────────────────────────────────

/**
 * Simple mutable reactive source. Set data directly and subscribers are notified.
 */
export class MutableSource<T> implements ReactiveSource<T> {
  private _data: T;
  private _listeners = new Set<(data: T) => void>();
  label?: string;
  domain?: string;

  constructor(initial: T, label?: string, domain?: string) {
    this._data = initial;
    this.label = label;
    this.domain = domain;
  }

  get data(): T {
    return this._data;
  }

  /** Update the data and notify all subscribers */
  set(value: T): void {
    this._data = value;
    for (const cb of this._listeners) {
      cb(value);
    }
  }

  /** Merge partial data into current value (for object data) */
  update(partial: Partial<T>): void {
    this._data = { ...this._data, ...partial };
    for (const cb of this._listeners) {
      cb(this._data);
    }
  }

  onChange(callback: (data: T) => void): Unsubscribe {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  destroy(): void {
    this._listeners.clear();
  }
}

/**
 * Extract a single field from a parent ReactiveSource.
 * Updates only when the extracted field value changes.
 */
export class FieldSource<T, K extends keyof T> implements ReactiveSource<T[K]> {
  private _parent: ReactiveSource<T>;
  private _field: K;
  private _listeners = new Set<(data: T[K]) => void>();
  private _lastValue: T[K];
  private _unsub: Unsubscribe;
  label?: string;
  domain?: string;

  constructor(parent: ReactiveSource<T>, field: K) {
    this._parent = parent;
    this._field = field;
    this._lastValue = parent.data[field];
    this.label = String(field);
    this.domain = parent.domain;

    this._unsub = parent.onChange((data) => {
      const newVal = data[field];
      if (newVal !== this._lastValue) {
        this._lastValue = newVal;
        for (const cb of this._listeners) {
          cb(newVal);
        }
      }
    });
  }

  get data(): T[K] {
    return this._parent.data[this._field];
  }

  onChange(callback: (data: T[K]) => void): Unsubscribe {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  destroy(): void {
    this._unsub();
    this._listeners.clear();
  }
}

/**
 * Computed reactive source — derives data from one or more parent sources.
 */
export class ComputedSource<T> implements ReactiveSource<T> {
  private _compute: () => T;
  private _listeners = new Set<(data: T) => void>();
  private _unsubs: Unsubscribe[] = [];
  private _cachedData: T;
  label?: string;
  domain?: string;

  constructor(
    sources: ReactiveSource<any>[],
    compute: () => T,
    label?: string,
  ) {
    this._compute = compute;
    this.label = label;
    this._cachedData = compute();

    // Re-compute when any source changes
    for (const source of sources) {
      this._unsubs.push(
        source.onChange(() => {
          const newData = this._compute();
          this._cachedData = newData;
          for (const cb of this._listeners) {
            cb(newData);
          }
        })
      );
    }
  }

  get data(): T {
    return this._cachedData;
  }

  onChange(callback: (data: T) => void): Unsubscribe {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  destroy(): void {
    for (const unsub of this._unsubs) unsub();
    this._unsubs = [];
    this._listeners.clear();
  }
}

// ─── Adapters from existing DataSource ─────────────────────────────

/**
 * Bridge an existing SSESource/RESTSource/WebSocketSource into a ReactiveSource.
 * Listens for "data" or "message" events and updates reactively.
 */
export class DataSourceAdapter<T> implements ReactiveSource<T> {
  private _data: T;
  private _listeners = new Set<(data: T) => void>();
  private _source: any; // DataSource (SSE/REST/WS)
  private _eventType: string;
  label?: string;
  domain?: string;

  /**
   * @param source - An existing DataSource (SSESource, RESTSource, WebSocketSource)
   * @param initial - Initial data value
   * @param eventType - Event type to listen for (default: "data")
   * @param transform - Optional transform function applied to incoming data
   */
  constructor(
    source: any,
    initial: T,
    eventType = "data",
    private transform?: (raw: any) => T,
  ) {
    this._data = initial;
    this._source = source;
    this._eventType = eventType;

    source.on(eventType, (raw: any) => {
      this._data = this.transform ? this.transform(raw) : raw;
      for (const cb of this._listeners) {
        cb(this._data);
      }
    });
  }

  get data(): T {
    return this._data;
  }

  onChange(callback: (data: T) => void): Unsubscribe {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  destroy(): void {
    this._source.off(this._eventType, () => {});
    this._listeners.clear();
  }

  /** Get the underlying DataSource (for connect/disconnect) */
  get source(): any {
    return this._source;
  }
}

// ─── Utilities ─────────────────────────────────────────────────────

/** Extract a field from a ReactiveSource */
export function field<T, K extends keyof T>(
  source: ReactiveSource<T>,
  key: K,
): FieldSource<T, K> {
  return new FieldSource(source, key);
}

/** Create a computed source from multiple inputs */
export function computed<T>(
  sources: ReactiveSource<any>[],
  compute: () => T,
  label?: string,
): ComputedSource<T> {
  return new ComputedSource(sources, compute, label);
}
