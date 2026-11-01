import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { Alert } from '../src/apis/dialogs.js';
import { Dimensions, useWindowDimensions } from '../src/apis/Dimensions.js';
import { FlatList, type FlatListInstance } from '../src/components/Lists/index.js';
import { ScrollView, type ScrollViewInstance } from '../src/components/ScrollView/index.js';
import { Text } from '../src/components/Text/index.js';
import { View } from '../src/components/View/index.js';
import type { HostInstance } from '../src/internal/nativeMethods.js';
import { getCellSize, setCellSize, toCells } from '../src/internal/units.js';
import { resolveViewStyle } from '../src/style/view.js';
import { lines, renderInteractive, renderText, tick, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
});

const CELL = { width: 8, height: 16 };
const box = (style: object, parentDirection?: string) =>
  resolveViewStyle(style, { component: 'View', cellSize: CELL, parentDirection }).box;

describe('setCellSize', () => {
  it('defaults to one unit per cell and validates what it is given', () => {
    expect(getCellSize()).toEqual({ width: 1, height: 1 });
    setCellSize(CELL);
    expect(getCellSize()).toEqual(CELL);
    setCellSize(4);
    expect(getCellSize()).toEqual({ width: 4, height: 4 });
    setCellSize(null);
    expect(getCellSize()).toEqual({ width: 1, height: 1 });
    expect(() => setCellSize({ width: 0, height: 16 })).toThrow(TypeError);
    expect(() => setCellSize({ width: 8, height: Number.NaN })).toThrow(TypeError);
    expect(() => setCellSize(-1)).toThrow(TypeError);
  });

  it('rounds lengths to whole cells, keeping a positive size at least one cell', () => {
    expect(toCells(16, CELL, 'x', 'space')).toBe(2);
    expect(toCells(12, CELL, 'x', 'space')).toBe(2);
    expect(toCells(16, CELL, 'y', 'space')).toBe(1);
    expect(toCells(4, CELL, 'y', 'space')).toBe(0);
    expect(toCells(-24, CELL, 'x', 'space')).toBe(-3);
    expect(toCells(4, CELL, 'y', 'size')).toBe(1);
    expect(toCells(0, CELL, 'y', 'size')).toBe(0);
    // 1×1 leaves the value alone (fractions included) for Yoga to round.
    expect(toCells(2.5, { width: 1, height: 1 }, 'x', 'space')).toBe(2.5);
  });
});

describe('style conversion', () => {
  it('converts widths along rows and heights down columns', () => {
    expect(box({ width: 160, height: 48, minWidth: 80, maxHeight: 320 })).toMatchObject({
      width: 20,
      height: 3,
      minWidth: 10,
      maxHeight: 20,
    });
  });

  it('converts each side of margins, paddings and offsets on its own axis', () => {
    expect(
      box({ paddingHorizontal: 16, paddingVertical: 16, marginTop: 32, marginLeft: -8 }),
    ).toMatchObject({
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      marginTop: 2,
      marginLeft: -1,
    });
    expect(box({ position: 'absolute', top: 16, left: 24 })).toMatchObject({ top: 1, left: 3 });
  });

  it('splits gap into a row gap and a column gap', () => {
    expect(box({ gap: 16 })).toMatchObject({ rowGap: 1, columnGap: 2 });
    expect(box({ gap: 16 })).not.toHaveProperty('gap');
    expect(box({ gap: 16, rowGap: 48 })).toMatchObject({ rowGap: 3, columnGap: 2 });
    // A square cell keeps the shorthand.
    expect(
      resolveViewStyle({ gap: 16 }, { component: 'View', cellSize: { width: 8, height: 8 } }).box,
    ).toMatchObject({ gap: 2 });
  });

  it("scales flexBasis along the parent's main axis", () => {
    expect(box({ flexBasis: 80 }, 'row')).toMatchObject({ flexBasis: 10 });
    expect(box({ flexBasis: 80 }, 'column')).toMatchObject({ flexBasis: 5 });
    expect(box({ flexBasis: 80 })).toMatchObject({ flexBasis: 5 });
  });

  it('keeps percentages, auto margins and the flex shorthand as they are', () => {
    expect(box({ width: '50%', marginLeft: 'auto', flex: 1 })).toMatchObject({
      width: '50%',
      marginLeft: 'auto',
      flexGrow: 1,
      flexBasis: 0,
    });
  });

  it('turns an aspect ratio of units into a ratio of cells', () => {
    // A square is twice as many columns as rows when a cell is twice as tall as it is wide.
    expect(box({ aspectRatio: 1 })).toMatchObject({ aspectRatio: 2 });
    expect(box({ aspectRatio: '16/9' }).aspectRatio).toBeCloseTo(32 / 9);
  });

  it('shifts translate transforms by whole cells', () => {
    expect(box({ transform: [{ translateX: 16 }, { translateY: 32 }] })).toMatchObject({
      position: 'relative',
      left: 2,
      top: 2,
    });
  });

  it('leaves borders one cell thick', () => {
    expect(box({ borderWidth: 1 })).toMatchObject({ borderStyle: 'single' });
  });
});

describe('rendering with a cell size', () => {
  it('lays out a dp-styled card in cells', () => {
    setCellSize(CELL);
    expect(
      renderText(
        <View style={{ width: 160, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 6, height: 6, backgroundColor: 'red' }} />
            <Text style={{ fontSize: 12 }}>TOTAL</Text>
          </View>
        </View>,
      ),
    ).toBe(
      lines(
        '┌──────────────────┐',
        '│                  │',
        // Border, 2 columns of padding, the 1-cell dot, a 1-column gap, then the text.
        '│    TOTAL         │',
        '│                  │',
        '└──────────────────┘',
      ),
    );
  });

  it('scales the layout box of a top-level Text', () => {
    setCellSize(CELL);
    expect(renderText(<Text style={{ paddingLeft: 32, width: 80 }}>hello</Text>)).toBe('    hello');
  });

  it('reports onLayout and measure in layout units', async () => {
    setCellSize(CELL);
    const onLayout = vi.fn();
    const ref: { current: HostInstance | null } = { current: null };
    renderInteractive(
      <View style={{ paddingTop: 16, paddingLeft: 16 }}>
        <View ref={ref} onLayout={onLayout} style={{ width: 80, height: 32 }} />
      </View>,
    );
    await waitFor(() =>
      expect(onLayout).toHaveBeenLastCalledWith(
        expect.objectContaining({
          nativeEvent: { layout: { x: 16, y: 16, width: 80, height: 32 } },
        }),
      ),
    );
    const measured = await new Promise<number[]>((resolve) =>
      ref.current?.measure((...values) => resolve(values)),
    );
    expect(measured).toEqual([16, 16, 80, 32, 16, 16]);
  });

  it('reports the window in layout units', () => {
    setCellSize(CELL);
    const window = Dimensions.get('window');
    expect(window.width % 8).toBe(0);
    expect(window.height % 16).toBe(0);
    function Size() {
      const { width, height } = useWindowDimensions();
      return <Text>{`${width}x${height}`}</Text>;
    }
    // renderToString has no stdout size of its own: 80×24 cells.
    expect(renderText(<Size />)).toBe('640x384');
  });

  it('scrolls and reports offsets in layout units', async () => {
    setCellSize(CELL);
    const offsets: number[] = [];
    const sizes: number[] = [];
    const handle: { current: ScrollViewInstance | null } = { current: null };
    const { lastFrame } = renderInteractive(
      <ScrollView
        ref={handle}
        style={{ height: 32 }}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => offsets.push(event.nativeEvent.contentOffset.y)}
        onContentSizeChange={(_width, height) => sizes.push(height)}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <Text key={index}>row {index}</Text>
        ))}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()).toBe(lines('row 0', 'row 1')));
    // Six rows of content, reported in layout units, before scrolling into them.
    await waitFor(() => expect(sizes.at(-1)).toBe(96));
    handle.current?.scrollTo({ y: 48 });
    await waitFor(() => expect(lastFrame()).toBe(lines('row 3', 'row 4')));
    expect(offsets.at(-1)).toBe(48);
  });

  it('starts at a contentOffset given in layout units', async () => {
    setCellSize(CELL);
    const { lastFrame } = renderInteractive(
      <ScrollView style={{ height: 16 }} contentOffset={{ x: 0, y: 32 }}>
        {Array.from({ length: 4 }, (_, index) => (
          <Text key={index}>row {index}</Text>
        ))}
      </ScrollView>,
    );
    await waitFor(() => expect(lastFrame()?.startsWith('row 2')).toBe(true));
  });

  it('scrolls a list to an index whatever the cell size', async () => {
    setCellSize(CELL);
    const handle: { current: FlatListInstance<number> | null } = { current: null };
    const { lastFrame } = renderInteractive(
      <FlatList
        ref={handle}
        style={{ height: 32 }}
        showsVerticalScrollIndicator={false}
        data={[0, 1, 2, 3, 4, 5]}
        keyExtractor={(item) => String(item)}
        renderItem={({ item }) => <Text>item {item}</Text>}
      />,
    );
    await waitFor(() => expect(lastFrame()).toBe(lines('item 0', 'item 1')));
    handle.current?.scrollToIndex({ index: 4 });
    await waitFor(() => expect(lastFrame()).toBe(lines('item 4', 'item 5')));
  });

  it("keeps the library's own dialogs in cells", async () => {
    setCellSize(CELL);
    const { lastFrame } = renderInteractive(<Text>app</Text>);
    Alert.alert('Title', 'Message');
    await tick(80);
    await waitFor(() => expect(lastFrame()).toContain('│  Title'));
    expect(lastFrame()).toContain('[ OK ]');
  });
});
