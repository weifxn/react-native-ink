import { createContext, useContext, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Alert,
  BackHandler,
  Button,
  Modal,
  ScrollView,
  Text,
  ToastAndroid,
  View,
} from '../src/index.js';
import { keys, press, renderInteractive, tick, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
});

describe('Modal', () => {
  it('covers the app while visible and closes with Esc via onRequestClose', async () => {
    function App() {
      const [open, setOpen] = useState(true);
      return (
        <View>
          <Text>main screen</Text>
          <Modal visible={open} onRequestClose={() => setOpen(false)}>
            <Text>modal content</Text>
          </Modal>
        </View>
      );
    }
    const { stdin, lastFrame } = renderInteractive(<App />);
    await tick();
    await waitFor(() => expect(lastFrame()).toContain('modal content'));
    expect(lastFrame()).not.toContain('main screen');
    await press(stdin, keys.escape);
    await tick();
    await waitFor(() => expect(lastFrame()).toBe('main screen'));
  });

  it('shows the app through a transparent modal', async () => {
    const { lastFrame } = renderInteractive(
      <View>
        <Text>main screen</Text>
        <Modal transparent>
          <View style={{ alignItems: 'flex-end' }}>
            <Text>overlay</Text>
          </View>
        </Modal>
      </View>,
    );
    await tick();
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toMatch(/^main screen\s+overlay$/));
  });

  it('limits focus to the top modal', async () => {
    const outside = vi.fn();
    const inside = vi.fn();
    const { stdin } = renderInteractive(
      <View>
        <Button title="outside" onPress={outside} />
        <Modal>
          <Button title="inside" onPress={inside} />
        </Modal>
      </View>,
    );
    await tick();
    await press(stdin, keys.tab, keys.enter, keys.tab, keys.enter);
    await waitFor(() => expect(inside).toHaveBeenCalledTimes(2));
    expect(outside).not.toHaveBeenCalled();
  });

  it('calls onShow and onDismiss', async () => {
    const onShow = vi.fn();
    const onDismiss = vi.fn();
    function App() {
      const [open, setOpen] = useState(true);
      useEffect(() => {
        const timer = setTimeout(() => setOpen(false), 30);
        return () => clearTimeout(timer);
      }, []);
      return (
        <Modal visible={open} onShow={onShow} onDismiss={onDismiss}>
          <Text>x</Text>
        </Modal>
      );
    }
    renderInteractive(<App />);
    await tick(80);
    await waitFor(() => expect(onShow).toHaveBeenCalledOnce());
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });
});

describe('Modal content', () => {
  const Theme = createContext('default theme');

  function Themed() {
    return <Text>{useContext(Theme)}</Text>;
  }

  it("keeps the context of the Modal's ancestors, as in React Native", async () => {
    const { lastFrame } = renderInteractive(
      <Theme.Provider value="app theme">
        <Text>main</Text>
        <Modal visible>
          <Themed />
        </Modal>
      </Theme.Provider>,
    );
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('app theme'));
  });

  it('updates in place while open', async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        if (count < 3) {
          const timer = setTimeout(() => setCount(count + 1), 20);
          return () => clearTimeout(timer);
        }
        return undefined;
      }, [count]);
      return (
        <Modal visible>
          <Text>{`count ${count}`}</Text>
        </Modal>
      );
    }
    const { lastFrame } = renderInteractive(<Counter />);
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('count 3'));
  });

  it("doesn't take on the layout of where it is declared", async () => {
    const { lastFrame } = renderInteractive(
      <ScrollView style={{ height: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ opacity: 0.5, width: 4 }}>
          <Text>dim</Text>
          <Modal visible>
            <Text>a line wider than the view it was declared in</Text>
            <Text>and a second one</Text>
          </Modal>
        </View>
      </ScrollView>,
    );
    // Not clipped by the one-row ScrollView or the four-column View around the Modal.
    await waitFor(() =>
      expect(lastFrame()?.split('\n').slice(0, 2)).toEqual([
        'a line wider than the view it was declared in',
        'and a second one',
      ]),
    );
  });
});

describe('Alert', () => {
  it('shows a dialog and calls the pressed button', async () => {
    const onDelete = vi.fn();
    const { stdin, lastFrame } = renderInteractive(<Text>app</Text>);
    await tick();
    Alert.alert('Delete file?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
    await tick(100);
    await waitFor(() => expect(lastFrame()).toContain('Delete file?'));
    await waitFor(() => expect(lastFrame()).toContain('This cannot be undone.'));
    await waitFor(() => expect(lastFrame()).toContain('[ Cancel ]'));
    // The focused button subscribes to input in an effect after the frame that shows it: let
    // that land before pressing, as a person can't press within a few milliseconds anyway.
    await tick(100);
    await press(stdin, keys.enter);
    await tick();
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(lastFrame()).not.toContain('Delete file?');
  });

  it('cancels with Esc', async () => {
    const onCancel = vi.fn();
    const { stdin, lastFrame } = renderInteractive(<Text>app</Text>);
    await tick();
    Alert.alert('Quit?', undefined, [
      { text: 'No', style: 'cancel', onPress: onCancel },
      { text: 'Yes' },
    ]);
    await tick(100);
    await press(stdin, keys.escape);
    await tick();
    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    await waitFor(() => expect(lastFrame()).toBe('app'));
  });

  it('prompts for text', async () => {
    const onSubmit = vi.fn();
    const { stdin } = renderInteractive(<Text>app</Text>);
    await tick();
    Alert.prompt('Your name', undefined, onSubmit);
    await tick(100);
    await press(stdin, 'Ada', keys.enter);
    await tick();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Ada'));
  });
});

describe('ActionSheetIOS', () => {
  it('reports the chosen option index', async () => {
    const callback = vi.fn();
    const { stdin, lastFrame } = renderInteractive(<Text>app</Text>);
    await tick();
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Copy', 'Delete'], cancelButtonIndex: 0 },
      callback,
    );
    await tick(100);
    await waitFor(() => expect(lastFrame()).toContain('[ Copy ]'));
    await press(stdin, keys.tab, keys.enter);
    await tick();
    await waitFor(() => expect(callback).toHaveBeenCalledWith(1));
  });
});

describe('ToastAndroid', () => {
  it('shows a message below the app, then hides it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { lastFrame } = renderInteractive(<Text>app</Text>);
      await tick();
      ToastAndroid.show('Saved', ToastAndroid.SHORT);
      await tick();
      await waitFor(() => expect(lastFrame()).toBe('app\n Saved'));
      vi.advanceTimersByTime(2100);
      await tick();
      await waitFor(() => expect(lastFrame()).toBe('app'));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('BackHandler', () => {
  it('calls handlers on Esc when nothing is focused, most recent first', async () => {
    const calls: string[] = [];
    const first = BackHandler.addEventListener('hardwareBackPress', () => {
      calls.push('first');
      return false;
    });
    const second = BackHandler.addEventListener('hardwareBackPress', () => {
      calls.push('second');
      return false;
    });
    const { stdin } = renderInteractive(<Text>app</Text>);
    await tick();
    await press(stdin, keys.escape);
    await waitFor(() => expect(calls).toEqual(['second', 'first']));
    first.remove();
    second.remove();
  });
});

describe('AccessibilityInfo', () => {
  it('reports screen reader state', async () => {
    await expect(AccessibilityInfo.isScreenReaderEnabled()).resolves.toBe(false);
    await expect(AccessibilityInfo.isReduceMotionEnabled()).resolves.toBe(false);
  });
});
