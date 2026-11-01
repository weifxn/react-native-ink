import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { FlatList, SectionList, type FlatListInstance } from '../src/components/Lists/index.js';
import { Pressable } from '../src/components/Pressable/index.js';
import { ScrollView, type ScrollViewInstance } from '../src/components/ScrollView/index.js';
import { RefreshControl } from '../src/components/simple.js';
import { Text } from '../src/components/Text/index.js';
import { View } from '../src/components/View/index.js';
import { keys, press, renderInteractive, tick } from './helpers.js';

afterEach(() => {
  cleanup();
});

const linesOf = (count: number) => Array.from({ length: count }, (_, index) => <Text key={index}>line {index}</Text>);

describe('ScrollView', () => {
  it('clips to its height and scrolls with the keyboard while focused', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView style={{ height: 3, width: 12 }}>{linesOf(10)}</ScrollView>,
    );
    await tick(60);
    expect(lastFrame()).toBe('line 0     ┃\nline 1     │\nline 2     │');
    await press(stdin, keys.tab, keys.down, keys.down);
    await tick();
    expect(lastFrame()?.split('\n')[0]).toMatch(/^line 2/);
    await press(stdin, keys.end);
    await tick();
    expect(lastFrame()?.split('\n').map((line) => line.slice(0, 6))).toEqual(['line 7', 'line 8', 'line 9']);
    await press(stdin, keys.pageUp);
    await tick();
    expect(lastFrame()?.split('\n')[0]).toMatch(/^line 4/);
    await press(stdin, keys.home);
    await tick();
    expect(lastFrame()?.split('\n')[0]).toMatch(/^line 0/);
  });

  it('scrolls programmatically and reports onScroll', async () => {
    const offsets: number[] = [];
    const handle: { current: ScrollViewInstance | null } = { current: null };
    const { lastFrame } = renderInteractive(
      <ScrollView
        ref={handle}
        style={{ height: 2 }}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => offsets.push(event.nativeEvent.contentOffset.y)}
      >
        {linesOf(5)}
      </ScrollView>,
    );
    await tick(60);
    handle.current!.scrollTo({ y: 2 });
    await tick(60);
    expect(lastFrame()).toBe('line 2\nline 3');
    handle.current!.scrollToEnd();
    await tick(60);
    expect(lastFrame()).toBe('line 3\nline 4');
    expect(offsets).toEqual([0, 2, 3]);
  });

  it('scrolls focused descendants into view', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView style={{ height: 2 }} showsVerticalScrollIndicator={false}>
        {Array.from({ length: 5 }, (_, index) => (
          <Pressable key={index} focusable>
            {({ focused }) => <Text>{focused ? `>item ${index}` : ` item ${index}`}</Text>}
          </Pressable>
        ))}
      </ScrollView>,
    );
    await tick(60);
    await press(stdin, keys.tab, keys.tab, keys.tab, keys.tab);
    await tick(60);
    expect(lastFrame()).toBe(' item 2\n>item 3');
  });

  it('scrolls horizontally', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <ScrollView horizontal style={{ width: 6 }} showsHorizontalScrollIndicator={false}>
        <Text>abcdefghij</Text>
      </ScrollView>,
    );
    await tick(60);
    expect(lastFrame()).toBe('abcdef');
    await press(stdin, keys.tab, keys.right, keys.right);
    await tick();
    expect(lastFrame()).toBe('cdefgh');
  });

  it('shows a spinner while refreshing', async () => {
    const { lastFrame } = renderInteractive(
      <ScrollView refreshControl={<RefreshControl refreshing />}>
        <Text>content</Text>
      </ScrollView>,
    );
    await tick();
    expect(lastFrame()).toMatch(/^⠋\ncontent/);
  });
});

describe('FlatList', () => {
  const data = [
    { id: 'a', title: 'Apple' },
    { id: 'b', title: 'Banana' },
    { id: 'c', title: 'Cherry' },
  ];

  it('renders items, separators, header and footer', async () => {
    const { lastFrame } = renderInteractive(
      <FlatList
        data={data}
        renderItem={({ item, index }) => (
          <Text>
            {index}. {item.title}
          </Text>
        )}
        ItemSeparatorComponent={() => <Text>--</Text>}
        ListHeaderComponent={<Text>Fruits</Text>}
        ListFooterComponent={() => <Text>end</Text>}
      />,
    );
    await tick();
    expect(lastFrame()).toBe('Fruits\n0. Apple\n--\n1. Banana\n--\n2. Cherry\nend');
  });

  it('renders ListEmptyComponent without data', async () => {
    const { lastFrame } = renderInteractive(
      <FlatList data={[]} renderItem={() => null} ListEmptyComponent={<Text>Nothing here</Text>} />,
    );
    await tick();
    expect(lastFrame()).toBe('Nothing here');
  });

  it('lays out numColumns and inverted lists', async () => {
    const grid = renderInteractive(
      <View style={{ width: 20 }}>
        <FlatList data={[1, 2, 3, 4]} numColumns={2} renderItem={({ item }) => <Text>#{item}</Text>} />
      </View>,
    );
    await tick();
    expect(grid.lastFrame()).toBe('#1        #2\n#3        #4');
    grid.unmount();
    const inverted = renderInteractive(
      <FlatList inverted data={data} renderItem={({ item }) => <Text>{item.title}</Text>} />,
    );
    await tick();
    expect(inverted.lastFrame()).toBe('Cherry\nBanana\nApple');
  });

  it('calls onEndReached and scrolls to an index', async () => {
    const onEndReached = vi.fn();
    const handle: { current: FlatListInstance | null } = { current: null };
    const many = Array.from({ length: 20 }, (_, index) => ({ key: String(index) }));
    const { lastFrame } = renderInteractive(
      <FlatList
        ref={handle}
        style={{ height: 3 }}
        showsVerticalScrollIndicator={false}
        data={many}
        renderItem={({ item }) => <Text>item {item.key}</Text>}
        onEndReached={onEndReached}
        onEndReachedThreshold={1}
      />,
    );
    await tick(60);
    expect(onEndReached).not.toHaveBeenCalled();
    handle.current!.scrollToIndex({ index: 12 });
    await tick(60);
    expect(lastFrame()).toBe('item 12\nitem 13\nitem 14');
    handle.current!.scrollToIndex({ index: 19, viewPosition: 1 });
    await tick(60);
    expect(lastFrame()).toBe('item 17\nitem 18\nitem 19');
    expect(onEndReached).toHaveBeenCalledOnce();
  });
});

describe('SectionList', () => {
  it('renders sections with headers, footers and separators', async () => {
    const { lastFrame } = renderInteractive(
      <SectionList
        sections={[
          { title: 'Fruits', data: ['Apple', 'Pear'] },
          { title: 'Vegetables', data: ['Leek'] },
        ]}
        renderSectionHeader={({ section }) => <Text>[{section.title}]</Text>}
        renderSectionFooter={({ section }) => <Text>({section.data.length})</Text>}
        renderItem={({ item }) => <Text>- {item}</Text>}
        ItemSeparatorComponent={() => <Text>~</Text>}
      />,
    );
    await tick();
    expect(lastFrame()).toBe('[Fruits]\n- Apple\n~\n- Pear\n(2)\n[Vegetables]\n- Leek\n(1)');
  });
});
