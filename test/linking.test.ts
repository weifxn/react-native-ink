import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const spawn = vi.fn();
vi.mock('node:child_process', () => ({ spawn }));

const { Linking } = await import('../src/apis/Linking.js');

function fakeChild(outcome: 'spawn' | 'error') {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
  queueMicrotask(() => {
    if (outcome === 'spawn') child.emit('spawn');
    else child.emit('error', new Error('ENOENT'));
  });
  return child;
}

describe('Linking.openURL', () => {
  it('opens URLs with the platform opener, without a shell', async () => {
    spawn.mockImplementationOnce(() => fakeChild('spawn'));
    await Linking.openURL('https://example.com/a b');
    const [command, args, options] = spawn.mock.calls[0]!;
    const expected =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'rundll32.exe'
          : 'xdg-open';
    expect(command).toBe(expected);
    expect(args.at(-1)).toBe('https://example.com/a%20b');
    expect(options).toMatchObject({ detached: true, stdio: 'ignore' });
  });

  it('rejects when the opener is missing', async () => {
    spawn.mockImplementationOnce(() => fakeChild('error'));
    await expect(Linking.openURL('https://example.com')).rejects.toThrow('ENOENT');
  });

  it('rejects unsupported operations', async () => {
    await expect(Linking.openSettings()).rejects.toThrow();
    await expect(Linking.sendIntent('x')).rejects.toThrow();
    expect(() => Linking.addEventListener('url', () => {}).remove()).not.toThrow();
  });
});
