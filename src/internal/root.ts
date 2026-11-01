/**
 * Registry of mounted app roots, so imperative APIs (BackHandler.exitApp, Keyboard.dismiss,
 * Dimensions, Vibration, AccessibilityInfo) can reach the running Ink instance.
 */

export interface RootHandle {
  exit(error?: Error): void;
  blur(): void;
  stdout: NodeJS.WriteStream;
  isScreenReaderEnabled: boolean;
}

const roots: RootHandle[] = [];
const listeners = new Set<() => void>();

export function registerRoot(handle: RootHandle): () => void {
  roots.push(handle);
  listeners.forEach((listener) => listener());
  return () => {
    const index = roots.indexOf(handle);
    if (index !== -1) roots.splice(index, 1);
    listeners.forEach((listener) => listener());
  };
}

/** The most recently mounted root, if any. */
export function currentRoot(): RootHandle | undefined {
  return roots[roots.length - 1];
}

export function onRootsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The output stream of the running app, or `process.stdout`. */
export function currentStdout(): NodeJS.WriteStream {
  return currentRoot()?.stdout ?? process.stdout;
}
