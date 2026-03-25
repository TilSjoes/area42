/**
 * Area42 Data Sources
 *
 * Zero-dependency data binding layer supporting WebSocket, REST polling,
 * and Server-Sent Events. Each source dispatches typed events to listeners.
 */

/** Common interface for all data sources */
export interface DataSource {
  /** Establish connection to the data source */
  connect(): Promise<void>;
  /** Disconnect and clean up */
  disconnect(): void;
  /** Register an event listener */
  on(event: string, callback: (data: any) => void): void;
  /** Remove an event listener */
  off(event: string, callback: (data: any) => void): void;
}

/**
 * WebSocket data source.
 *
 * Connects to a WebSocket endpoint, parses incoming JSON messages,
 * and dispatches them to registered listeners. Supports auto-reconnect.
 */
export class WebSocketSource implements DataSource {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private url: string;
  private reconnectDelay: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  /**
   * @param url - WebSocket URL (e.g., "ws://localhost:8042/ws")
   * @param reconnectDelay - Milliseconds between reconnect attempts (default 3000)
   */
  constructor(url: string, reconnectDelay = 3000) {
    this.url = url;
    this.reconnectDelay = reconnectDelay;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.shouldReconnect = true;
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.dispatch("connected", { url: this.url });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type ?? data.event ?? "message";
          this.dispatch(type, data);
          this.dispatch("message", data);
        } catch {
          this.dispatch("message", { raw: event.data });
        }
      };

      this.ws.onerror = (err) => {
        this.dispatch("error", err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.dispatch("disconnected", { url: this.url });
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  /** Send data through the WebSocket */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  private dispatch(event: string, data: any): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

/**
 * REST polling data source.
 *
 * Polls a REST endpoint at a configurable interval and dispatches
 * new data to listeners.
 */
export class RESTSource implements DataSource {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private url: string;
  private interval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private headers: Record<string, string>;
  private lastEtag: string | null = null;

  /**
   * @param url - REST endpoint URL
   * @param interval - Polling interval in milliseconds (default 5000)
   * @param headers - Additional request headers
   */
  constructor(url: string, interval = 5000, headers: Record<string, string> = {}) {
    this.url = url;
    this.interval = interval;
    this.headers = headers;
  }

  async connect(): Promise<void> {
    // Do an initial fetch immediately
    await this.poll();
    // Then set up polling interval
    this.timer = setInterval(() => this.poll(), this.interval);
    this.dispatch("connected", { url: this.url });
  }

  disconnect(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.dispatch("disconnected", { url: this.url });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private async poll(): Promise<void> {
    try {
      const reqHeaders: Record<string, string> = { ...this.headers };
      if (this.lastEtag) {
        reqHeaders["If-None-Match"] = this.lastEtag;
      }

      const response = await fetch(this.url, { headers: reqHeaders });

      if (response.status === 304) return; // Not modified

      const etag = response.headers.get("ETag");
      if (etag) this.lastEtag = etag;

      if (!response.ok) {
        this.dispatch("error", { status: response.status, statusText: response.statusText });
        return;
      }

      const data = await response.json();
      this.dispatch("data", data);
      this.dispatch("message", data);
    } catch (err) {
      this.dispatch("error", err);
    }
  }

  private dispatch(event: string, data: any): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

/**
 * Server-Sent Events data source.
 *
 * Connects to an SSE endpoint and dispatches events to listeners.
 * Perfect for AgentSmith's /api/events stream.
 */
export class SSESource implements DataSource {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private url: string;
  private eventTypes: string[];

  /**
   * @param url - SSE endpoint URL (e.g., "http://localhost:8042/api/events")
   * @param eventTypes - Specific SSE event types to listen for (default: listens to all via onmessage)
   */
  constructor(url: string, eventTypes: string[] = []) {
    this.url = url;
    this.eventTypes = eventTypes;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        this.dispatch("connected", { url: this.url });
        resolve();
      };

      this.eventSource.onerror = (err) => {
        this.dispatch("error", err);
        // SSE auto-reconnects, so only reject on initial connect
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          reject(err);
        }
      };

      // Default message handler (events without a type field)
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.dispatch("message", data);
          // Also dispatch by type if present in the payload
          if (data.type) {
            this.dispatch(data.type, data);
          }
        } catch {
          this.dispatch("message", { raw: event.data });
        }
      };

      // Named event type handlers
      for (const type of this.eventTypes) {
        this.eventSource.addEventListener(type, (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            this.dispatch(type, data);
          } catch {
            this.dispatch(type, { raw: (event as MessageEvent).data });
          }
        });
      }
    });
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.dispatch("disconnected", { url: this.url });
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private dispatch(event: string, data: any): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}
