import { currentRoot, currentStdout } from '../internal/root.js';
import { addIgnorePatterns, setIgnoreAll, warnOnce } from '../internal/warn.js';
import type { EmitterSubscription } from './EventEmitter.js';

const noopSubscription = (): EmitterSubscription => ({ remove() {} });

/** Layout is always left-to-right in a terminal. */
export const I18nManager = {
  isRTL: false,
  doLeftAndRightSwapInRTL: true,
  allowRTL(_allowRTL: boolean): void {},
  forceRTL(forceRTL: boolean): void {
    if (forceRTL)
      warnOnce('I18nManager.forceRTL', 'Right-to-left layout is not supported in terminals.');
  },
  swapLeftAndRightInRTL(_flipStyles: boolean): void {},
  getConstants() {
    return {
      isRTL: false,
      doLeftAndRightSwapInRTL: true,
      localeIdentifier: Intl.DateTimeFormat().resolvedOptions().locale,
    };
  },
};

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
export type AppStateEvent = 'change' | 'memoryWarning' | 'blur' | 'focus';

/** A terminal app is always in the foreground. */
export const AppState = {
  currentState: 'active' as AppStateStatus,
  isAvailable: true,
  addEventListener(
    _type: AppStateEvent,
    _listener: (state: AppStateStatus) => void,
  ): EmitterSubscription {
    return noopSubscription();
  },
};

export type KeyboardEventName =
  | 'keyboardWillShow'
  | 'keyboardDidShow'
  | 'keyboardWillHide'
  | 'keyboardDidHide'
  | 'keyboardWillChangeFrame'
  | 'keyboardDidChangeFrame';

/** There is no on-screen keyboard; `dismiss()` blurs the focused input. */
export const Keyboard = {
  addListener(
    _eventName: KeyboardEventName,
    _listener: (event: unknown) => void,
  ): EmitterSubscription {
    return noopSubscription();
  },
  removeAllListeners(_eventName?: KeyboardEventName): void {},
  dismiss(): void {
    currentRoot()?.blur();
  },
  isVisible(): boolean {
    return false;
  },
  metrics(): undefined {
    return undefined;
  },
  scheduleLayoutAnimation(_event: unknown): void {},
};

/** `vibrate()` rings the terminal bell. */
export const Vibration = {
  vibrate(_pattern?: number | number[], _repeat?: boolean): void {
    const stream = currentStdout();
    if (stream.isTTY) stream.write('\u0007');
  },
  cancel(): void {},
};

/** Filters this library's development warnings. */
export const LogBox = {
  ignoreLogs(patterns: ReadonlyArray<string | RegExp>): void {
    addIgnorePatterns(patterns);
  },
  ignoreAllLogs(value = true): void {
    setIgnoreAll(value);
  },
  install(): void {},
  uninstall(): void {},
};

let clipboardContent = '';

/**
 * `setString` copies through the terminal's OSC 52 sequence (supported by most modern
 * terminals); `getString` returns the last value set by this app.
 */
export const Clipboard = {
  getString(): Promise<string> {
    return Promise.resolve(clipboardContent);
  },
  setString(content: string): void {
    clipboardContent = content;
    const stream = currentStdout();
    if (stream.isTTY) stream.write(`\u001B]52;c;${Buffer.from(content).toString('base64')}\u0007`);
  },
  hasString(): Promise<boolean> {
    return Promise.resolve(clipboardContent.length > 0);
  },
};

export type ShareContent = { title?: string; message?: string; url?: string };
export type ShareAction = {
  action: 'sharedAction' | 'dismissedAction';
  activityType?: string | null;
};

/** No share sheet in a terminal: resolves as dismissed. */
export const Share = {
  sharedAction: 'sharedAction' as const,
  dismissedAction: 'dismissedAction' as const,
  share(_content: ShareContent, _options?: object): Promise<ShareAction> {
    warnOnce('Share.share', 'Share.share is not supported in terminals.');
    return Promise.resolve({ action: 'dismissedAction' });
  },
};

const settingsStore = new Map<string, unknown>();
const settingsWatchers = new Map<number, { keys: string[]; callback: () => void }>();
let nextWatchId = 1;

/** In-memory key/value settings (iOS `Settings` API shape). */
export const Settings = {
  get(key: string): unknown {
    return settingsStore.get(key);
  },
  set(settings: Record<string, unknown>): void {
    const changed = Object.keys(settings);
    for (const [key, value] of Object.entries(settings)) settingsStore.set(key, value);
    for (const { keys, callback } of settingsWatchers.values()) {
      if (keys.some((key) => changed.includes(key))) callback();
    }
  },
  watchKeys(keys: string | string[], callback: () => void): number {
    const id = nextWatchId++;
    settingsWatchers.set(id, { keys: Array.isArray(keys) ? keys : [keys], callback });
    return id;
  },
  clearWatch(watchId: number): void {
    settingsWatchers.delete(watchId);
  },
};
