export interface EventSubscription {
  remove(): void;
}
export type EmitterSubscription = EventSubscription;

type Listener = (...args: any[]) => unknown;

/** React Native's `EventEmitter`. */
export class EventEmitter {
  #listeners = new Map<string, Set<Listener>>();

  addListener(eventType: string, listener: Listener, context?: unknown): EmitterSubscription {
    const bound: Listener = context === undefined ? listener : listener.bind(context);
    let set = this.#listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.#listeners.set(eventType, set);
    }
    set.add(bound);
    return {
      remove: () => {
        this.#listeners.get(eventType)?.delete(bound);
      },
    };
  }

  emit(eventType: string, ...args: unknown[]): void {
    for (const listener of [...(this.#listeners.get(eventType) ?? [])]) {
      listener(...args);
    }
  }

  removeAllListeners(eventType?: string): void {
    if (eventType === undefined) this.#listeners.clear();
    else this.#listeners.delete(eventType);
  }

  listenerCount(eventType: string): number {
    return this.#listeners.get(eventType)?.size ?? 0;
  }
}

/** Global emitter, like React Native's `DeviceEventEmitter`. */
export const DeviceEventEmitter = new EventEmitter();
export const NativeAppEventEmitter = DeviceEventEmitter;

/** Subscribes through the global `DeviceEventEmitter`, like React Native. */
export class NativeEventEmitter {
  constructor(_nativeModule?: unknown) {}

  addListener(eventType: string, listener: Listener, context?: unknown): EmitterSubscription {
    return DeviceEventEmitter.addListener(eventType, listener, context);
  }

  emit(eventType: string, ...args: unknown[]): void {
    DeviceEventEmitter.emit(eventType, ...args);
  }

  removeAllListeners(eventType: string): void {
    DeviceEventEmitter.removeAllListeners(eventType);
  }

  listenerCount(eventType: string): number {
    return DeviceEventEmitter.listenerCount(eventType);
  }
}
