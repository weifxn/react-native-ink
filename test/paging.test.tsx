import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { FlatList, type FlatListInstance } from '../src/components/Lists/index.js';
import { Pressable } from '../src/components/Pressable/index.js';
import { ScrollView } from '../src/components/ScrollView/index.js';
import { Text } from '../src/components/Text/index.js';
import { View } from '../src/components/View/index.js';
import { keys, lines, press, renderInteractive, tick, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
});

const linesOf = (count: number, label = 'line') =>
  Array.from({ length: count }, (_, index) => <Text key={index}>{`${label} ${index}`}</Text>);

describe('page scrolling with nothing focused', () => {
  it('scrolls the outermost vertical ScrollView with the arrow and page keys', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView style={{ height: 3 }} showsVerticalScrollIndicator={false}>
        {linesOf(10)}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()).toBe(lines('line 0', 'line 1', 'line 2')));
    await press(stdin, keys.down, keys.down);
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('line 2'));
    await press(stdin, keys.pageDown);
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('line 5'));
    await press(stdin, keys.end);
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('line 7'));
    await press(stdin, keys.home);
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('line 0'));
  });

  it('leaves nested ScrollViews and horizontal ones alone', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView style={{ height: 4 }} showsVerticalScrollIndicator={false}>
        <ScrollView style={{ height: 2 }} showsVerticalScrollIndicator={false}>
          {linesOf(5, 'inner')}
        </ScrollView>
        {linesOf(6, 'outer')}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('inner 0'));
    await press(stdin, keys.down);
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('inner 1'));
    // The outer one moved, which takes the inner one's first visible row with it.
    expect(lastFrame()?.split('\n')).toContain('outer 0');
  });

  it("doesn't take the arrow keys from a focused component", async () => {
    const onPress = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView style={{ height: 2 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onPress}>
          <Text>button</Text>
        </Pressable>
        {linesOf(5)}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('button'));
    await press(stdin, keys.tab, keys.down);
    await tick();
    expect(lastFrame()?.split('\n')[0]).toBe('button');
  });
});

describe('focus inside nested ScrollViews', () => {
  it('brings a focused item into view in every ScrollView around it', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView style={{ height: 3 }} showsVerticalScrollIndicator={false}>
        {linesOf(5, 'above')}
        <ScrollView horizontal style={{ width: 10 }} showsHorizontalScrollIndicator={false}>
          <View style={{ width: 10 }}>
            <Text>first</Text>
          </View>
          <View style={{ width: 10 }}>
            <Pressable onPress={() => {}}>
              <Text>target</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()?.split('\n')[0]).toBe('above 0'));
    await press(stdin, keys.tab);
    // The pager moved sideways to the target, and the page down to the pager.
    await waitFor(() => expect(lastFrame()?.split('\n').at(-1)).toBe('target'));
  });
});

describe('paging', () => {
  const page = (index: number) => (
    <View key={index} style={{ width: 10 }}>
      <Text>{`page ${index}`}</Text>
    </View>
  );

  it('moves a whole page per arrow key and reports when the scroll has landed', async () => {
    const onMomentumScrollEnd = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: 10 }}
        onMomentumScrollEnd={(event) => onMomentumScrollEnd(event.nativeEvent.contentOffset.x)}
      >
        {[0, 1, 2].map(page)}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()).toBe('page 0'));
    await press(stdin, keys.tab, keys.right);
    await waitFor(() => expect(lastFrame()).toBe('page 1'));
    expect(onMomentumScrollEnd).toHaveBeenLastCalledWith(10);
    await press(stdin, keys.right, keys.right);
    await waitFor(() => expect(lastFrame()).toBe('page 2'));
    await press(stdin, keys.left);
    await waitFor(() => expect(lastFrame()).toBe('page 1'));
    expect(onMomentumScrollEnd).toHaveBeenLastCalledWith(10);
  });

  it("doesn't report a programmatic scroll as one that landed", async () => {
    const onMomentumScrollEnd = vi.fn();
    const handle: { current: { scrollTo(options: { x: number }): void } | null } = {
      current: null,
    };
    const { lastFrame } = renderInteractive(
      <ScrollView
        ref={handle as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: 10 }}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {[0, 1].map(page)}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()).toBe('page 0'));
    handle.current?.scrollTo({ x: 10 });
    await waitFor(() => expect(lastFrame()).toBe('page 1'));
    expect(onMomentumScrollEnd).not.toHaveBeenCalled();
  });
});

describe('windowed FlatList (getItemLayout)', () => {
  const months = Array.from({ length: 49 }, (_, index) => index);

  it('renders only the window around the visible item', async () => {
    const rendered = new Set<number>();
    const { lastFrame } = renderInteractive(
      <FlatList
        horizontal
        pagingEnabled
        style={{ width: 10 }}
        showsHorizontalScrollIndicator={false}
        data={months}
        keyExtractor={(item) => String(item)}
        initialScrollIndex={24}
        windowSize={3}
        initialNumToRender={1}
        getItemLayout={(_, index) => ({ length: 10, offset: 10 * index, index })}
        renderItem={({ item }) => {
          rendered.add(item);
          return (
            <View style={{ width: 10 }}>
              <Text>{`month ${item}`}</Text>
            </View>
          );
        }}
      />,
    );
    await waitFor(() => expect(lastFrame()).toBe('month 24'));
    expect([...rendered].sort((a, b) => a - b)).toEqual([23, 24, 25]);
  });

  it('scrolls to an index it has not rendered', async () => {
    const handle: { current: FlatListInstance<number> | null } = { current: null };
    const { lastFrame } = renderInteractive(
      <FlatList
        ref={handle}
        style={{ height: 2 }}
        showsVerticalScrollIndicator={false}
        data={months}
        keyExtractor={(item) => String(item)}
        windowSize={1}
        getItemLayout={(_, index) => ({ length: 1, offset: index, index })}
        renderItem={({ item }) => <Text>{`row ${item}`}</Text>}
      />,
    );
    await waitFor(() => expect(lastFrame()).toBe(lines('row 0', 'row 1')));
    handle.current?.scrollToIndex({ index: 40 });
    await waitFor(() => expect(lastFrame()).toBe(lines('row 40', 'row 41')));
  });

  it('keeps Tab on the visible page while paging', async () => {
    const pressed = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <FlatList
        horizontal
        pagingEnabled
        style={{ width: 10 }}
        showsHorizontalScrollIndicator={false}
        data={[0, 1, 2]}
        keyExtractor={(item) => String(item)}
        windowSize={3}
        getItemLayout={(_, index) => ({ length: 10, offset: 10 * index, index })}
        renderItem={({ item }) => (
          <View style={{ width: 10 }}>
            <Pressable onPress={() => pressed(item)}>
              <Text>{`day ${item}`}</Text>
            </Pressable>
          </View>
        )}
      />,
    );
    await waitFor(() => expect(lastFrame()).toBe('day 0'));
    // Tab, Enter: the visible page's button. Tab again goes past the page, not onto page 1.
    await press(stdin, keys.tab, keys.enter);
    await waitFor(() => expect(pressed).toHaveBeenCalledWith(0));
    await press(stdin, keys.tab, keys.enter);
    await tick(150);
    expect(pressed).not.toHaveBeenCalledWith(1);
    expect(lastFrame()).toBe('day 0');
  });
});
