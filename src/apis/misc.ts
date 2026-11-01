import { warnOnce } from '../internal/warn.js';
import { Dimensions } from './Dimensions.js';

export const DeviceInfo = {
  getConstants() {
    const size = Dimensions.get('window');
    return {
      Dimensions: { window: size, screen: size },
      isIPhoneX_deprecated: false,
    };
  },
};

export const DevMenu = {
  show(): void {},
};

export const DevSettings = {
  addMenuItem(_title: string, _handler: () => unknown): void {},
  reload(_reason?: string): void {
    warnOnce(
      'DevSettings.reload',
      'DevSettings.reload is not supported; restart the process instead.',
    );
  },
  onFastRefresh(): void {},
};

type LayoutAnimationConfig = {
  duration: number;
  create?: object;
  update?: object;
  delete?: object;
};

const preset = (duration: number): LayoutAnimationConfig => ({ duration });

/** Layout changes apply instantly in a terminal; the API is accepted for compatibility. */
export const LayoutAnimation = {
  configureNext(_config: LayoutAnimationConfig, onAnimationDidEnd?: () => void): void {
    if (onAnimationDidEnd) queueMicrotask(onAnimationDidEnd);
  },
  create(duration: number, _type?: string, _property?: string): LayoutAnimationConfig {
    return preset(duration);
  },
  Types: {
    spring: 'spring',
    linear: 'linear',
    easeInEaseOut: 'easeInEaseOut',
    easeIn: 'easeIn',
    easeOut: 'easeOut',
    keyboard: 'keyboard',
  },
  Properties: { opacity: 'opacity', scaleX: 'scaleX', scaleY: 'scaleY', scaleXY: 'scaleXY' },
  Presets: { easeInEaseOut: preset(300), linear: preset(500), spring: preset(700) },
  easeInEaseOut(onAnimationDidEnd?: () => void): void {
    if (onAnimationDidEnd) queueMicrotask(onAnimationDidEnd);
  },
  linear(onAnimationDidEnd?: () => void): void {
    if (onAnimationDidEnd) queueMicrotask(onAnimationDidEnd);
  },
  spring(onAnimationDidEnd?: () => void): void {
    if (onAnimationDidEnd) queueMicrotask(onAnimationDidEnd);
  },
  setEnabled(_value: boolean): void {},
};

/** There are no touches in a terminal; handlers are never called. */
export const PanResponder = {
  create(_config: object): { panHandlers: Record<string, never> } {
    warnOnce('PanResponder', 'PanResponder gestures are not available in terminals.');
    return { panHandlers: {} };
  },
};

export const PermissionsAndroid = {
  PERMISSIONS: {} as Record<string, string>,
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' } as const,
  check(_permission: string): Promise<boolean> {
    return Promise.resolve(false);
  },
  request(_permission: string): Promise<'denied'> {
    return Promise.resolve('denied');
  },
  requestMultiple(permissions: string[]): Promise<Record<string, 'denied'>> {
    return Promise.resolve(
      Object.fromEntries(permissions.map((permission) => [permission, 'denied'])),
    );
  },
};

export const PushNotificationIOS = new Proxy(
  {},
  {
    get(_target, property) {
      warnOnce('PushNotificationIOS', 'PushNotificationIOS is not available in terminals.');
      return property === 'then' ? undefined : () => undefined;
    },
  },
) as Record<string, (...args: unknown[]) => unknown>;

export const ToastDurations = { SHORT: 2000, LONG: 3500 } as const;

export const Systrace = {
  isEnabled: (): boolean => false,
  setEnabled(_enabled: boolean): void {},
  beginEvent(_name?: string | (() => string), _args?: unknown): void {},
  endEvent(_args?: unknown): void {},
  beginAsyncEvent(_name?: string | (() => string), _args?: unknown): number {
    return 0;
  },
  endAsyncEvent(_name?: string | (() => string), _cookie?: number, _args?: unknown): void {},
  counterEvent(_name?: string | (() => string), _value?: number): void {},
};

export const UTFSequence = Object.freeze({
  BOM: '﻿',
  BULLET: '•',
  BULLET_SP: ' • ',
  MIDDOT: '·',
  MIDDOT_SP: ' · ',
  MIDDOT_KATAKANA: '・',
  MDASH: '—',
  MDASH_SP: ' — ',
  NDASH: '–',
  NDASH_SP: ' – ',
  NEWLINE: '\n',
  NBSP: ' ',
  PIZZA: '🍕',
  TRIANGLE_LEFT: '◀',
  TRIANGLE_RIGHT: '▶',
});

export const VirtualViewMode = Object.freeze({ Visible: 0, Prerender: 1, Hidden: 2 });

/** React Native's internal pressability hook; terminals have no pointer events. */
export function usePressability(_config: unknown): Record<string, never> {
  return {};
}

export function unstable_getScrollParent(_node: unknown): null {
  return null;
}

export const unstable_DEFAULT_INITIAL_NUM_TO_RENDER = 10;
