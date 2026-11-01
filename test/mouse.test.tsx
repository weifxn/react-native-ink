import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instance } from 'ink';
import { Modal } from '../src/components/Modal/index.js';
import { Pressable } from '../src/components/Pressable/index.js';
import { ScrollView } from '../src/components/ScrollView/index.js';
import { Text } from '../src/components/Text/index.js';
import { TextInput } from '../src/components/TextInput/index.js';
import { View } from '../src/components/View/index.js';
import { MOUSE_OFF, MOUSE_ON, scanMouse } from '../src/internal/mouse.js';
import { render, type RenderOptions } from '../src/render.js';
import { FakeStdin, FakeStdout, keys, settle, tick, waitFor } from './helpers.js';

describe('scanMouse', () => {
  it('takes button reports out of the input, in 0-based cells', () => {
    const scan = scanMouse('a\u001B[<0;40;12Mb\u001B[<0;41;12mc');
    expect(scan.keys).toBe('abc');
    expect(scan.pending).toBe('');
    expect(scan.events).toEqual([
      { type: 'down', button: 'left', column: 39, row: 11, shift: false, meta: false, ctrl: false },
      { type: 'up', button: 'left', column: 40, row: 11, shift: false, meta: false, ctrl: false },
    ]);
  });

  it('reads the wheel, sideways too, and modifiers', () => {
    const { events } = scanMouse(
      '\u001B[<64;1;1M\u001B[<65;1;1M\u001B[<66;1;1M\u001B[<67;1;1M\u001B[<68;1;1M\u001B[<18;1;1M',
    );
    expect(
      events.map((event) => (event.type === 'wheel' ? event.direction : event.button)),
    ).toEqual(['up', 'down', 'left', 'right', 'up', 'right']);
    expect(events[4]).toMatchObject({ type: 'wheel', shift: true });
    expect(events[5]).toMatchObject({ type: 'down', button: 'right', ctrl: true });
  });

  it('drops motion, extra buttons and a wheel "release"', () => {
    const scan = scanMouse('\u001B[<32;5;5M\u001B[<128;5;5M\u001B[<64;5;5m\u001B[<3;5;5M');
    expect(scan.events).toEqual([]);
    expect(scan.keys).toBe('');
  });

  it('holds back a report cut off by the end of a chunk, but never a lone Escape', () => {
    const first = scanMouse('x\u001B[<0;12');
    expect(first).toMatchObject({ keys: 'x', pending: '\u001B[<0;12', events: [] });
    const second = scanMouse(`${first.pending};3M`);
    expect(second.events).toMatchObject([{ type: 'down', column: 11, row: 2 }]);
    expect(scanMouse('\u001B').keys).toBe('\u001B');
  });
});

/** A terminal's stdin: what it's sent arrives as `data`, as from a real one. */
class TerminalStdin extends FakeStdin {
  rawMode = false;
  override setRawMode(mode?: boolean) {
    this.rawMode = Boolean(mode);
  }
  send(data: string) {
    this.emit('data', data);
  }
}

const press = (column: number, row: number) => `\u001B[<0;${column + 1};${row + 1}M`;
const release = (column: number, row: number) => `\u001B[<0;${column + 1};${row + 1}m`;
const wheel = (direction: 'up' | 'down', column: number, row: number) =>
  `\u001B[<${direction === 'up' ? 64 : 65};${column + 1};${row + 1}M`;

let running: Instance | undefined;
afterEach(async () => {
  running?.unmount();
  await running?.waitUntilExit().catch(() => {});
  running = undefined;
});

async function renderWithMouse(element: React.ReactElement, options: RenderOptions = {}) {
  const stdin = new TerminalStdin();
  const stdout = new FakeStdout();
  running = render(element, {
    stdin: stdin as never,
    stdout: stdout as never,
    mouse: true,
    alternateScreen: true,
    interactive: true,
    patchConsole: false,
    exitOnCtrlC: false,
    ...options,
  });
  await tick(100);
  const send = async (...sequence: string[]) => {
    for (const data of sequence) {
      await settle();
      stdin.send(data);
      await tick(50);
      await settle();
    }
  };
  const click = (column: number, row: number) => send(press(column, row), release(column, row));
  return { stdin, stdout, send, click, instance: running };
}

function Buttons({ onPress }: { onPress: (label: string) => void }) {
  return (
    <View>
      <Pressable onPress={() => onPress('first')}>
        <Text>first</Text>
      </Pressable>
      <Pressable onPress={() => onPress('second')}>
        <Text>second</Text>
      </Pressable>
    </View>
  );
}

describe('the mouse', () => {
  it('turns reporting on, and off again when the app ends', async () => {
    const { stdout, instance } = await renderWithMouse(<Text>hi</Text>);
    expect(stdout.frames.join('')).toContain(MOUSE_ON);
    expect(stdout.frames.join('')).not.toContain(MOUSE_OFF);
    instance.unmount();
    await instance.waitUntilExit();
    expect(stdout.frames.join('')).toContain(MOUSE_OFF);
  });

  it('presses what a click lands on', async () => {
    const pressed = vi.fn();
    const { click } = await renderWithMouse(<Buttons onPress={pressed} />);
    await click(2, 1);
    expect(pressed).toHaveBeenLastCalledWith('second');
    await click(0, 0);
    expect(pressed).toHaveBeenLastCalledWith('first');
    expect(pressed).toHaveBeenCalledTimes(2);
  });

  it('presses in, out and then presses, with where the click was', async () => {
    const calls: string[] = [];
    let where: { locationX: number; locationY: number; pageX: number; pageY: number } | undefined;
    const { send } = await renderWithMouse(
      <View style={{ paddingTop: 2, paddingLeft: 4 }}>
        <Pressable
          onPressIn={() => calls.push('in')}
          onPressOut={() => calls.push('out')}
          onPress={(event) => {
            calls.push('press');
            where = event.nativeEvent;
          }}
        >
          <Text>a wide button</Text>
        </Pressable>
      </View>,
    );
    await send(press(7, 2));
    expect(calls).toEqual(['in']);
    await send(release(7, 2));
    expect(calls).toEqual(['in', 'out', 'press']);
    expect(where).toMatchObject({ locationX: 3, locationY: 0, pageX: 7, pageY: 2 });
  });

  it('cancels a press released somewhere else', async () => {
    const pressed = vi.fn();
    const pressedOut = vi.fn();
    const { send } = await renderWithMouse(
      <Pressable onPress={pressed} onPressOut={pressedOut}>
        <Text>button</Text>
      </Pressable>,
    );
    await send(press(1, 0), release(30, 5));
    expect(pressedOut).toHaveBeenCalledTimes(1);
    expect(pressed).not.toHaveBeenCalled();
  });

  it('long-presses a button held down, instead of pressing it', async () => {
    const pressed = vi.fn();
    const longPressed = vi.fn();
    const { send } = await renderWithMouse(
      <Pressable onPress={pressed} onLongPress={longPressed} delayLongPress={100}>
        <Text>hold me</Text>
      </Pressable>,
    );
    await send(press(1, 0));
    await tick(150);
    expect(longPressed).toHaveBeenCalledTimes(1);
    await send(release(1, 0));
    expect(pressed).not.toHaveBeenCalled();
  });

  it('presses the innermost pressable, and the one around it outside that', async () => {
    const pressed = vi.fn();
    const { click } = await renderWithMouse(
      <Pressable onPress={() => pressed('outer')} style={{ padding: 1 }}>
        <Pressable onPress={() => pressed('inner')}>
          <Text>inner</Text>
        </Pressable>
        <Pressable disabled onPress={() => pressed('disabled')}>
          <Text>disabled</Text>
        </Pressable>
      </Pressable>,
    );
    await click(2, 1);
    expect(pressed).toHaveBeenLastCalledWith('inner');
    await click(0, 0);
    expect(pressed).toHaveBeenLastCalledWith('outer');
    // A disabled one lets the click through to the one around it.
    await click(2, 2);
    expect(pressed).toHaveBeenLastCalledWith('outer');
    expect(pressed).not.toHaveBeenCalledWith('disabled');
  });

  it('presses pressable Text', async () => {
    const pressed = vi.fn();
    const { click } = await renderWithMouse(<Text onPress={pressed}>a link</Text>);
    await click(3, 0);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('focuses a TextInput, with the cursor where it was clicked, and blurs it on a click outside', async () => {
    const changed = vi.fn();
    const { click, send } = await renderWithMouse(
      <View>
        <TextInput defaultValue="hello" onChangeText={changed} />
        <Text>below</Text>
      </View>,
    );
    await click(2, 0);
    await send('X');
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith('heXllo'));
    await click(20, 1);
    await send('Y');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('lets the keyboard work alongside', async () => {
    const pressed = vi.fn();
    const { send } = await renderWithMouse(<Buttons onPress={pressed} />);
    await send(keys.tab, keys.enter);
    await waitFor(() => expect(pressed).toHaveBeenLastCalledWith('first'));
  });

  it('scrolls the ScrollView under the pointer, before the page', async () => {
    const page = vi.fn();
    const inner = vi.fn();
    const rows = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => <Text key={index}>{`${prefix} ${index}`}</Text>);
    const { send } = await renderWithMouse(
      <ScrollView
        style={{ height: 8 }}
        onScroll={(event) => page(event.nativeEvent.contentOffset.y)}
      >
        <ScrollView
          style={{ height: 3 }}
          onScroll={(event) => inner(event.nativeEvent.contentOffset.y)}
        >
          {rows('inner', 10)}
        </ScrollView>
        {rows('page', 20)}
      </ScrollView>,
    );
    await send(wheel('down', 1, 1));
    await waitFor(() => expect(inner).toHaveBeenLastCalledWith(3));
    expect(page).not.toHaveBeenCalledWith(3);
    // Below the inner one, the page scrolls.
    await send(wheel('down', 1, 5));
    await waitFor(() => expect(page).toHaveBeenLastCalledWith(3));
    expect(inner).toHaveBeenLastCalledWith(3);
  });

  it('clicks what a scrolled ScrollView shows now', async () => {
    const pressed = vi.fn();
    const { send, click } = await renderWithMouse(
      <ScrollView style={{ height: 4 }}>
        {Array.from({ length: 12 }, (_, index) => (
          <Pressable key={index} onPress={() => pressed(index)}>
            <Text>{`item ${index}`}</Text>
          </Pressable>
        ))}
      </ScrollView>,
    );
    await send(wheel('down', 1, 1));
    await click(1, 0);
    expect(pressed).toHaveBeenLastCalledWith(3);
  });

  it('keeps clicks inside an open modal', async () => {
    const pressed = vi.fn();
    function App() {
      const [open, setOpen] = useState(false);
      return (
        <View>
          <Pressable onPress={() => setOpen(true)}>
            <Text>open</Text>
          </Pressable>
          <Modal transparent visible={open}>
            <View style={{ paddingTop: 3 }}>
              <Pressable onPress={() => pressed('in modal')}>
                <Text>inside</Text>
              </Pressable>
            </View>
          </Modal>
        </View>
      );
    }
    const { click } = await renderWithMouse(<App />);
    await click(1, 0);
    await tick(100);
    // The button behind the (transparent) modal is covered by it.
    await click(1, 0);
    expect(pressed).not.toHaveBeenCalled();
    await click(1, 3);
    expect(pressed).toHaveBeenLastCalledWith('in modal');
  });

  it("ignores clicks on the main screen when it can't know where the app is", async () => {
    const pressed = vi.fn();
    const { click } = await renderWithMouse(<Buttons onPress={pressed} />, {
      alternateScreen: false,
    });
    await click(1, 0);
    expect(pressed).not.toHaveBeenCalled();
  });

  it('maps clicks on an app as tall as the window, on the main screen too', async () => {
    const pressed = vi.fn();
    const { click } = await renderWithMouse(
      <View style={{ height: 12 }}>
        <View style={{ flexGrow: 1 }} />
        <Pressable onPress={pressed}>
          <Text>at the bottom</Text>
        </Pressable>
      </View>,
      { alternateScreen: false },
    );
    await click(1, 11);
    expect(pressed).toHaveBeenCalledTimes(1);
  });
});
