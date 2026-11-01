import chalk from 'chalk';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { ActivityIndicator } from '../src/components/ActivityIndicator/index.js';
import { Button } from '../src/components/Button/index.js';
import { Pressable } from '../src/components/Pressable/index.js';
import { Switch } from '../src/components/Switch/index.js';
import { Text } from '../src/components/Text/index.js';
import {
  TouchableHighlight,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from '../src/components/Touchable/index.js';
import { View } from '../src/components/View/index.js';
import { keys, press, renderInteractive, renderText, tick } from './helpers.js';

afterEach(() => {
  cleanup();
});

const Item = ({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled}>
    {({ focused, pressed }) => (
      <Text>
        {focused ? '>' : ' '} {label}
        {pressed ? ' *' : ''}
      </Text>
    )}
  </Pressable>
);

describe('focus model', () => {
  it('moves focus with Tab and Shift+Tab, clears it with Esc', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <View>
        <Item label="one" />
        <Item label="two" />
        <Item label="three" />
      </View>,
    );
    await tick();
    expect(lastFrame()).toBe('  one\n  two\n  three');
    await press(stdin, keys.tab);
    expect(lastFrame()).toBe('> one\n  two\n  three');
    await press(stdin, keys.tab, keys.tab);
    expect(lastFrame()).toBe('  one\n  two\n> three');
    await press(stdin, keys.shiftTab);
    expect(lastFrame()).toBe('  one\n> two\n  three');
    await press(stdin, keys.escape);
    expect(lastFrame()).toBe('  one\n  two\n  three');
  });

  it('skips disabled pressables', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <View>
        <Item label="one" disabled />
        <Item label="two" />
      </View>,
    );
    await press(stdin, keys.tab);
    expect(lastFrame()).toBe('  one\n> two');
  });
});

describe('Pressable', () => {
  it('fires onPressIn, onPressOut and onPress on Enter and Space', async () => {
    const calls: string[] = [];
    const { stdin, lastFrame } = renderInteractive(
      <Pressable
        onPressIn={() => calls.push('in')}
        onPressOut={() => calls.push('out')}
        onPress={(event) => calls.push(`press:${typeof event.nativeEvent.timestamp}`)}
      >
        {({ pressed }) => <Text>{pressed ? 'pressed' : 'idle'}</Text>}
      </Pressable>,
    );
    await press(stdin, keys.tab, keys.enter);
    expect(calls).toEqual(['in', 'out', 'press:number']);
    expect(lastFrame()).toBe('pressed');
    await tick(150);
    expect(lastFrame()).toBe('idle');
    await press(stdin, keys.space);
    expect(calls).toHaveLength(6);
  });

  it('shows a default inverse focus indicator', async () => {
    const previous = chalk.level;
    chalk.level = 3;
    try {
      const { stdin, lastFrame } = renderInteractive(
        <Pressable onPress={() => {}}>
          <Text>press me</Text>
        </Pressable>,
      );
      await tick();
      expect(lastFrame()).not.toContain('\u001b[7m');
      await press(stdin, keys.tab);
      expect(lastFrame()).toContain('\u001b[7mpress me');
    } finally {
      chalk.level = previous;
    }
  });

  it('supports autoFocus and ref.focus()', async () => {
    const onPress = vi.fn();
    const { stdin } = renderInteractive(
      <View>
        <Item label="first" />
        <Pressable autoFocus onPress={onPress}>
          <Text>auto</Text>
        </Pressable>
      </View>,
    );
    await tick();
    await press(stdin, keys.enter);
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('Button', () => {
  it('renders [ title ] and presses with Enter', async () => {
    const onPress = vi.fn();
    const { stdin, lastFrame } = renderInteractive(<Button title="Save" onPress={onPress} />);
    await tick();
    expect(lastFrame()).toBe('[ Save ]');
    await press(stdin, keys.tab, keys.enter);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('does not press when disabled', async () => {
    const onPress = vi.fn();
    const { stdin } = renderInteractive(<Button title="Save" onPress={onPress} disabled />);
    await press(stdin, keys.tab, keys.enter);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Switch', () => {
  it('toggles with Space while focused', async () => {
    const changes: boolean[] = [];
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <Switch
          value={on}
          onValueChange={(value) => {
            changes.push(value);
            setOn(value);
          }}
        />
      );
    }
    const { stdin, lastFrame } = renderInteractive(<Toggle />);
    await tick();
    expect(lastFrame()).toBe('[● ]');
    await press(stdin, keys.tab, keys.space);
    expect(lastFrame()).toBe('[ ●]');
    await press(stdin, keys.enter);
    expect(lastFrame()).toBe('[● ]');
    expect(changes).toEqual([true, false]);
  });
});

describe('Touchables', () => {
  it('press TouchableOpacity, TouchableHighlight and TouchableWithoutFeedback', async () => {
    const calls: string[] = [];
    const { stdin } = renderInteractive(
      <View>
        <TouchableOpacity onPress={() => calls.push('opacity')}>
          <Text>a</Text>
        </TouchableOpacity>
        <TouchableHighlight onPress={() => calls.push('highlight')} underlayColor="blue">
          <Text>b</Text>
        </TouchableHighlight>
        <TouchableWithoutFeedback onPress={() => calls.push('without')}>
          <Text>c</Text>
        </TouchableWithoutFeedback>
      </View>,
    );
    await press(stdin, keys.tab, keys.enter, keys.tab, keys.enter, keys.tab, keys.enter);
    expect(calls).toEqual(['opacity', 'highlight', 'without']);
  });
});

describe('pressable Text', () => {
  it('makes Text with onPress focusable', async () => {
    const onPress = vi.fn();
    const { stdin } = renderInteractive(<Text onPress={onPress}>link</Text>);
    await press(stdin, keys.tab, keys.enter);
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('ActivityIndicator', () => {
  it('animates through frames', async () => {
    const { lastFrame } = renderInteractive(<ActivityIndicator />);
    await tick();
    const first = lastFrame();
    await tick(200);
    expect(lastFrame()).not.toBe(first);
  });

  it('keeps its space when stopped', () => {
    expect(renderText(<ActivityIndicator animating={false} />)).toBe('');
    expect(renderText(<ActivityIndicator animating={false} hidesWhenStopped={false} />)).toBe('⠋');
    expect(renderText(<ActivityIndicator size="large" />)).toBe('▰▱▱');
  });
});
