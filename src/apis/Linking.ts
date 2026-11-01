import { spawn } from 'node:child_process';
import type { EmitterSubscription } from './EventEmitter.js';

function parseUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  return parsed;
}

function opener(url: string): [string, string[]] {
  switch (process.platform) {
    case 'darwin':
      return ['open', [url]];
    case 'win32':
      return ['rundll32.exe', ['url.dll,FileProtocolHandler', url]];
    default:
      return ['xdg-open', [url]];
  }
}

/** Opens URLs with the operating system's default handler (no shell involved). */
export const Linking = {
  openURL(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let target: string;
      try {
        target = parseUrl(url).href;
      } catch (error) {
        reject(error);
        return;
      }
      const [command, args] = opener(target);
      const child = spawn(command, args, { stdio: 'ignore', detached: true });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  },
  canOpenURL(url: string): Promise<boolean> {
    try {
      parseUrl(url);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  },
  getInitialURL(): Promise<string | null> {
    return Promise.resolve(null);
  },
  openSettings(): Promise<void> {
    return Promise.reject(new Error('Linking.openSettings is not supported in terminals.'));
  },
  sendIntent(
    _action: string,
    _extras?: Array<{ key: string; value: string | number | boolean }>,
  ): Promise<void> {
    return Promise.reject(new Error('Linking.sendIntent is only available on Android.'));
  },
  addEventListener(_type: 'url', _handler: (event: { url: string }) => void): EmitterSubscription {
    return { remove() {} };
  },
};
