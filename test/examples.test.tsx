import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { App as Counter } from '../examples/counter/App.js';
import { App as Dashboard } from '../examples/dashboard/App.js';
import { App as Form } from '../examples/form/App.js';
import { App as Hello } from '../examples/hello/App.js';
import { App as List } from '../examples/list/App.js';
import { Greeting } from '../examples/shared-code/Greeting.js';
import { keys, press, renderInteractive, renderText, tick, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
});

describe('examples', () => {
  it('hello renders a card', () => {
    const output = renderText(<Hello name="Ada" />, 80);
    expect(output).toContain('Hello, Ada!');
    expect(output).toContain('╭');
  });

  it('counter counts up and exits', async () => {
    const { frames } = renderInteractive(<Counter until={3} interval={5} />);
    await tick(150);
    // The app exits after reaching 3; Ink writes an empty frame on exit.
    await waitFor(() =>
      expect(frames.some((frame) => frame.includes('3 tests passed'))).toBe(true),
    );
  });

  it('form signs up', async () => {
    const { stdin, lastFrame } = renderInteractive(<Form />);
    await tick();
    await press(stdin, 'Ada', keys.tab, 'secret', keys.tab, keys.space, keys.tab, keys.enter);
    await tick();
    await waitFor(() => expect(lastFrame()).toContain('Welcome, Ada!'));
    await waitFor(() => expect(lastFrame()).toContain('Newsletter: no'));
  });

  it('list scrolls and selects', async () => {
    const { stdin, lastFrame } = renderInteractive(<List height={6} />);
    await tick(60);
    for (let i = 0; i < 6; i++) {
      await press(stdin, keys.tab);
      await tick(40);
    }
    await press(stdin, keys.enter);
    await tick(60);
    await waitFor(() => expect(lastFrame()).toContain('Selected package-06'));
    expect(lastFrame()).not.toContain('package-01');
  });

  it('dashboard lays out panels', () => {
    const output = renderText(<Dashboard autoStart={false} />, 72);
    expect(output).toContain('deploy-dashboard');
    expect(output).toContain('Services');
    expect(output).toContain('Deploying…');
  });

  it('shared code imports from react-native', () => {
    expect(renderText(<Greeting name="you" />, 60)).toContain('this component runs on cli');
  });

  it('runs an example end to end as a process', async () => {
    const script = fileURLToPath(new URL('../scripts/example.mjs', import.meta.url));
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [script, 'hello', '--name', 'CI'],
      {
        timeout: 30_000,
        env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '0', CI: 'true' },
      },
    );
    await waitFor(() => expect(stdout).toContain('Hello, CI!'));
  }, 40_000);
});
