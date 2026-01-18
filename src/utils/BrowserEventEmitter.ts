// Browser-compatible EventEmitter for client-side usage
// Replaces Node.js EventEmitter for browser compatibility

type EventListener = (...args: any[]) => void;

export class BrowserEventEmitter {
  private eventListeners: Map<string, EventListener[]> = new Map();

  /**
   * Add an event listener
   */
  on(event: string, listener: EventListener): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
    return this;
  }

  /**
   * Add a one-time event listener
   */
  once(event: string, listener: EventListener): this {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    };
    return this.on(event, onceListener);
  }

  /**
   * Remove an event listener
   */
  off(event: string, listener: EventListener): this {
    const listeners = this.eventListeners.get(event);
    if (!listeners) {
      return this;
    }

    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }

    // Clean up empty listener arrays
    if (listeners.length === 0) {
      this.eventListeners.delete(event);
    }

    return this;
  }

  /**
   * Emit an event to all listeners
   */
  emit(event: string, ...args: any[]): boolean {
    const listeners = this.eventListeners.get(event);
    if (!listeners || listeners.length === 0) {
      return false;
    }

    // Create a copy of listeners to avoid issues if listeners are removed during emission
    const listenersCopy = [...listeners];
    listenersCopy.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });

    return true;
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
    return this;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): string[] {
    return Array.from(this.eventListeners.keys());
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: string): number {
    return this.eventListeners.get(event)?.length || 0;
  }

  /**
   * Get all listeners for an event
   */
  listeners(event: string): EventListener[] {
    return this.eventListeners.get(event) ? [...this.eventListeners.get(event)!] : [];
  }

  /**
   * Set max listeners (no-op in browser version for compatibility)
   */
  setMaxListeners(_max: number): this {
    return this;
  }

  /**
   * Get max listeners (no-op in browser version for compatibility)
   */
  getMaxListeners(): number {
    return 0;
  }
}
