import { currentRoot } from '../internal/root.js';
import type { EmitterSubscription } from './EventEmitter.js';

type BackPressHandler = () => boolean | null | undefined;

const handlers: BackPressHandler[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Android's back button maps to Esc: when no component is focused and no modal is open,
 * Esc calls the handlers (most recent first) until one returns true.
 */
export const BackHandler = {
  exitApp(): void {
    currentRoot()?.exit();
  },
  addEventListener(
    _eventName: 'hardwareBackPress',
    handler: BackPressHandler,
  ): EmitterSubscription {
    handlers.push(handler);
    notify();
    return {
      remove: () => BackHandler.removeEventListener('hardwareBackPress', handler),
    };
  },
  /** @deprecated Use the subscription returned by `addEventListener`. */
  removeEventListener(_eventName: 'hardwareBackPress', handler: BackPressHandler): void {
    const index = handlers.lastIndexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
      notify();
    }
  },
};

/** Runs the back handlers; returns true when one handled the event. */
export function dispatchBackPress(): boolean {
  for (const handler of [...handlers].reverse()) {
    if (handler()) return true;
  }
  return false;
}

export const hasBackHandlers = (): boolean => handlers.length > 0;

export function subscribeBackHandlers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
