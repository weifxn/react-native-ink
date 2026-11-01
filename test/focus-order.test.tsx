import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { Pressable } from '../src/components/Pressable/index.js';
import { Text } from '../src/components/Text/index.js';
import { TextInput } from '../src/components/TextInput/index.js';
import { View } from '../src/components/View/index.js';
import { compareTreeOrder } from '../src/internal/focus.js';
import { keys, press, renderInteractive, tick, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
});

function Button({ label, onPress }: { label: string; onPress: (label: string) => void }) {
  return (
    <Pressable onPress={() => onPress(label)}>
      <Text>{label}</Text>
    </Pressable>
  );
}

/** Renders its child only after a delay, like a card that waits for its data. */
function Later({ children, ms }: { children: React.ReactNode; ms: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return shown ? <>{children}</> : null;
}

describe('Tab order', () => {
  it('orders a parent after its children and siblings in order', () => {
    expect(compareTreeOrder([0, 1], [0, 2])).toBeLessThan(0);
    expect(compareTreeOrder([0, 2, 5], [0, 2])).toBeLessThan(0);
    expect(compareTreeOrder([0, 2], [0, 1, 9])).toBeGreaterThan(0);
  });

  it('follows the screen, not the order things finished loading', async () => {
    const pressed = vi.fn();
    const { stdin } = renderInteractive(
      <View>
        <Button label="top" onPress={pressed} />
        <Later ms={80}>
          <Button label="middle" onPress={pressed} />
        </Later>
        <Button label="bottom" onPress={pressed} />
      </View>,
    );
    await tick(200);
    await press(stdin, keys.tab, keys.enter);
    await waitFor(() => expect(pressed).toHaveBeenLastCalledWith('top'));
    await press(stdin, keys.tab, keys.enter);
    await waitFor(() => expect(pressed).toHaveBeenLastCalledWith('middle'));
    await press(stdin, keys.tab, keys.enter);
    await waitFor(() => expect(pressed).toHaveBeenLastCalledWith('bottom'));
  });

  it('keeps focus on a component that moves back in the order', async () => {
    const pressed = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <View>
        <Later ms={150}>
          <Button label="late" onPress={pressed} />
        </Later>
        <TextInput placeholder="name" />
        <Button label="after" onPress={pressed} />
      </View>,
    );
    await tick(50);
    // Focus the field and start typing before the button above it appears.
    await press(stdin, keys.tab, 'a', 'b');
    await tick(200);
    await waitFor(() => expect(lastFrame()).toContain('late'));
    await press(stdin, 'c');
    await waitFor(() => expect(lastFrame()).toContain('abc'));
    // And the next stop is still the one after it.
    await press(stdin, keys.tab, keys.enter);
    await waitFor(() => expect(pressed).toHaveBeenLastCalledWith('after'));
  });

  it("doesn't remount a pressable's content when focus turns it inverse", async () => {
    let mounts = 0;
    function Mounted() {
      const [mount] = useState(() => ++mounts);
      return <Text>{`mount ${mount}`}</Text>;
    }
    const { stdin, lastFrame } = renderInteractive(
      <View style={{ backgroundColor: '#112233' }}>
        <Pressable onPress={() => {}}>
          <Mounted />
        </Pressable>
      </View>,
    );
    await waitFor(() => expect(lastFrame()).toBe('mount 1'));
    await press(stdin, keys.tab);
    await tick(100);
    await press(stdin, keys.escape);
    await tick(100);
    expect(lastFrame()).toBe('mount 1');
    expect(mounts).toBe(1);
  });
});
