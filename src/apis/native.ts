import { warnOnce } from '../internal/warn.js';

const unsupported = (name: string) =>
  new Error(
    `${name} is not available in react-native-ink: terminals have no native modules or views.`,
  );

/** There are no native modules; property lookups return undefined, like a missing module. */
export const NativeModules: Record<string, any> = {};

export const TurboModuleRegistry = {
  get<T>(_name: string): T | null {
    return null;
  },
  getEnforcing<T>(name: string): T {
    throw unsupported(`TurboModuleRegistry.getEnforcing('${name}')`);
  },
};

export const UIManager = {
  getViewManagerConfig(_name: string): null {
    return null;
  },
  hasViewManagerConfig(_name: string): boolean {
    return false;
  },
  measure(): void {},
  measureInWindow(): void {},
  measureLayout(): void {},
  dispatchViewManagerCommand(): void {},
  setLayoutAnimationEnabledExperimental(): void {},
};

export function requireNativeComponent(name: string): never {
  throw unsupported(`requireNativeComponent('${name}')`);
}

export function codegenNativeComponent(name: string): never {
  throw unsupported(`codegenNativeComponent('${name}')`);
}

export function codegenNativeCommands(): never {
  throw unsupported('codegenNativeCommands');
}

export const NativeComponentRegistry = {
  get(name: string): never {
    throw unsupported(`NativeComponentRegistry.get('${name}')`);
  },
  getWithFallback_DEPRECATED(name: string): never {
    throw unsupported(`NativeComponentRegistry.getWithFallback_DEPRECATED('${name}')`);
  },
  setRuntimeConfigProvider(): void {},
  unstable_hasStaticViewConfig(): boolean {
    return false;
  },
};

/** Returns the host node itself (there are no native view tags). */
export function findNodeHandle(componentOrHandle: unknown): unknown {
  return componentOrHandle ?? null;
}

export function registerCallableModule(_name: string, _module: object | (() => object)): void {}

const assets: unknown[] = [];
export const AssetRegistry = {
  registerAsset(asset: unknown): number {
    return assets.push(asset);
  },
  getAssetByID(assetId: number): unknown {
    return assets[assetId - 1];
  },
};

export const Networking = {
  sendRequest(): void {
    warnOnce('Networking', 'Networking is not available; use fetch() instead.');
  },
  abortRequest(): void {},
  clearCookies(callback?: (result: boolean) => void): void {
    callback?.(false);
  },
  addListener() {
    return { remove() {} };
  },
};
