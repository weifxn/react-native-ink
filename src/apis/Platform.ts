import { release } from 'node:os';
import { currentStdout } from '../internal/root.js';

export type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web' | 'native' | 'cli';

export type PlatformSelectSpecifics<T> = { [platform in PlatformOSType]?: T } & { default?: T };

export const ReactNativeVersion = {
  version: { major: 0, minor: 88, patch: 1, prerelease: null as string | null },
  getVersionString(): string {
    return '0.88.1';
  },
};

function colorDepth(): number {
  const stream = currentStdout();
  return typeof stream.getColorDepth === 'function' && stream.isTTY ? stream.getColorDepth() : 1;
}

/** React Native's `Platform`, with `OS === 'cli'`. */
export const Platform = {
  OS: 'cli' as const,
  /** The Node.js version running the app. */
  Version: process.versions.node,
  isTV: false,
  isVision: false,
  isPad: false,
  get isTesting(): boolean {
    return process.env.NODE_ENV === 'test';
  },
  get constants() {
    const stream = currentStdout();
    return {
      reactNativeVersion: ReactNativeVersion.version,
      isTesting: process.env.NODE_ENV === 'test',
      isTTY: Boolean(stream.isTTY),
      colorDepth: colorDepth(),
      terminal: process.env.TERM_PROGRAM ?? process.env.TERM ?? 'unknown',
      platform: process.platform,
      osVersion: release(),
    };
  },
  /** Returns `specifics.cli` when present, otherwise `specifics.default`. */
  select<T>(specifics: PlatformSelectSpecifics<T>): T {
    return ('cli' in specifics ? specifics.cli : specifics.default) as T;
  },
};
