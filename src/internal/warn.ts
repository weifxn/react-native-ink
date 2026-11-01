const PREFIX = '[react-native-ink]';

const seen = new Set<string>();
let ignorePatterns: Array<string | RegExp> = [];
let ignoreAll = false;

export const isDev = (): boolean => process.env.NODE_ENV !== 'production';

const isIgnored = (message: string): boolean =>
  ignoreAll ||
  ignorePatterns.some((pattern) =>
    typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message),
  );

/**
 * Logs a development warning once per `key`. Warnings go through `console.warn`, which Ink
 * patches so the message appears above the UI instead of corrupting the frame.
 */
export function warnOnce(key: string, message: string): void {
  if (!isDev() || seen.has(key)) {
    return;
  }
  seen.add(key);
  const text = `${PREFIX} ${message}`;
  if (!isIgnored(text)) {
    console.warn(text);
  }
}

/** Used by `LogBox.ignoreLogs`. */
export function addIgnorePatterns(patterns: ReadonlyArray<string | RegExp>): void {
  ignorePatterns = [...ignorePatterns, ...patterns];
}

/** Used by `LogBox.ignoreAllLogs`. */
export function setIgnoreAll(value: boolean): void {
  ignoreAll = value;
}

/** Test helper: forget which warnings were already shown and clear LogBox filters. */
export function resetWarnings(): void {
  seen.clear();
  ignorePatterns = [];
  ignoreAll = false;
}
