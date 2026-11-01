import {
  isValidElement,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import type { DOMElement } from 'ink';
import type { NativeSyntheticEvent } from '../../internal/events.js';
import type { StyleProp, ViewStyle } from '../../style/types.js';
import {
  ScrollView,
  type NativeScrollEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
} from '../ScrollView/index.js';
import { RefreshControl } from '../simple.js';
import { View } from '../View/index.js';
import { fromCells, getCellSize } from '../../internal/units.js';
import { FocusScopeContext } from '../../internal/contexts.js';

export interface ViewToken<ItemT = any> {
  item: ItemT;
  key: string;
  index: number | null;
  isViewable: boolean;
  section?: unknown;
}

export interface Separators {
  highlight(): void;
  unhighlight(): void;
  updateProps(select: 'leading' | 'trailing', newProps: unknown): void;
}

export interface ListRenderItemInfo<ItemT> {
  item: ItemT;
  index: number;
  separators: Separators;
}
export type ListRenderItem<ItemT> = (info: ListRenderItemInfo<ItemT>) => ReactElement | null;

type ComponentOrElement = ComponentType<any> | ReactElement | null | undefined;

interface ScrollToParams {
  animated?: boolean | null;
  viewOffset?: number;
  viewPosition?: number;
}

export interface FlatListInstance<ItemT = any> extends ScrollViewInstance {
  scrollToIndex(params: { index: number } & ScrollToParams): void;
  scrollToItem(params: { item: ItemT } & ScrollToParams): void;
  scrollToOffset(params: { offset: number; animated?: boolean | null }): void;
  recordInteraction(): void;
  getNativeScrollRef(): ScrollViewInstance | null;
}

interface CommonListProps extends Omit<ScrollViewProps, 'ref' | 'children'> {
  ListHeaderComponent?: ComponentOrElement;
  ListHeaderComponentStyle?: StyleProp<ViewStyle>;
  ListFooterComponent?: ComponentOrElement;
  ListFooterComponentStyle?: StyleProp<ViewStyle>;
  ListEmptyComponent?: ComponentOrElement;
  ItemSeparatorComponent?: ComponentType<any> | null;
  /** Renders the list bottom-to-top and keeps it scrolled to the end (chat-style). */
  inverted?: boolean | null;
  extraData?: unknown;
  /** Called when the end of the content is within `onEndReachedThreshold` viewports. */
  onEndReached?: ((info: { distanceFromEnd: number }) => void) | null;
  onEndReachedThreshold?: number | null;
  refreshing?: boolean | null;
  onRefresh?: (() => void) | null;
  /** With `getItemLayout`: how many items render before the list has measured itself (default 10). */
  initialNumToRender?: number;
  /** @remarks Ignored: a windowed list renders its whole window at once. */
  maxToRenderPerBatch?: number;
  /**
   * With `getItemLayout`: how many viewports of items render, centered on the visible one
   * (default 21, as in React Native). Without it every item renders.
   */
  windowSize?: number;
  /** @remarks Ignored (items outside the window aren't rendered at all). */
  removeClippedSubviews?: boolean;
  /**
   * Item sizes known up front. A FlatList given this renders only the items within `windowSize`
   * viewports (spacers stand in for the rest), and with `pagingEnabled` only the visible page's
   * items take focus.
   */
  getItemLayout?: (data: any, index: number) => { length: number; offset: number; index: number };
  /** @remarks Ignored. */
  onViewableItemsChanged?:
    ((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => void) | null;
  /** @remarks Ignored. */
  viewabilityConfig?: unknown;
  /** @remarks Ignored. */
  stickySectionHeadersEnabled?: boolean;
}

export interface FlatListProps<ItemT> extends CommonListProps {
  data: ArrayLike<ItemT> | null | undefined;
  renderItem: ListRenderItem<ItemT> | null | undefined;
  keyExtractor?: ((item: ItemT, index: number) => string) | null;
  numColumns?: number;
  columnWrapperStyle?: StyleProp<ViewStyle>;
  initialScrollIndex?: number | null;
  ref?: Ref<FlatListInstance<ItemT> | null>;
}

const separators: Separators = { highlight() {}, unhighlight() {}, updateProps() {} };

function renderSlot(slot: ComponentOrElement): ReactNode {
  if (!slot) return null;
  if (isValidElement(slot)) return slot;
  const Slot = slot as ComponentType<any>;
  return <Slot />;
}

export function defaultKeyExtractor(item: unknown, index: number): string {
  if (item && typeof item === 'object') {
    const { key, id } = item as { key?: unknown; id?: unknown };
    if (typeof key === 'string' || typeof key === 'number') return String(key);
    if (typeof id === 'string' || typeof id === 'number') return String(id);
  }
  return String(index);
}

interface Row {
  key: string;
  node: ReactNode;
  /** Addressable id (for scrollToIndex / scrollToLocation). */
  id?: string;
}

interface ListApi {
  scrollToId(id: string, params?: ScrollToParams): void;
  scrollToOffset(offset: number): void;
  /** The viewport's length along the scroll axis, in layout units (0 before layout). */
  visibleLength(): number;
  scrollView(): ScrollViewInstance | null;
}

interface ListBaseProps extends CommonListProps {
  rows: Row[];
  isEmpty: boolean;
  initialScrollId?: string;
  /** Scrolled to once the list has measured itself, when there's no row to scroll to. */
  initialScrollOffset?: number;
  methods: (api: ListApi) => object;
  listRef?: Ref<any>;
  /** The visible span along the scroll axis, in layout units, whenever it changes. */
  onViewport?: (offset: number, length: number) => void;
}

/** Shared list implementation: rows inside a ScrollView with addressable cells. */
function ListBase(props: ListBaseProps) {
  const {
    rows,
    isEmpty,
    initialScrollId,
    initialScrollOffset,
    methods,
    listRef,
    onViewport,
    ListHeaderComponent,
    ListHeaderComponentStyle,
    ListFooterComponent,
    ListFooterComponentStyle,
    ListEmptyComponent,
    ItemSeparatorComponent: _separator,
    inverted,
    extraData: _extraData,
    onEndReached,
    onEndReachedThreshold,
    refreshing,
    onRefresh,
    onScroll,
    onContentSizeChange,
    horizontal,
    initialNumToRender: _a,
    maxToRenderPerBatch: _b,
    windowSize: _c,
    removeClippedSubviews: _d,
    getItemLayout: _e,
    onViewableItemsChanged: _f,
    viewabilityConfig: _g,
    stickySectionHeadersEnabled: _h,
    ...scrollProps
  } = props;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const cells = useRef(new Map<string, DOMElement>());
  const endReachedFor = useRef<number | null>(null);
  const stickToEnd = useRef(Boolean(inverted));
  const didInitialScroll = useRef(false);

  const api = useMemo<ListApi>(
    () => ({
      scrollToId(id, params = {}) {
        const scroll = scrollRef.current;
        const node = cells.current.get(id);
        const container = scroll?.getInnerViewNode();
        if (!scroll || !node || !container) return;
        let x = 0;
        let y = 0;
        let current: DOMElement | undefined = node;
        while (current && current !== container) {
          x += current.yogaNode?.getComputedLeft() ?? 0;
          y += current.yogaNode?.getComputedTop() ?? 0;
          current = current.parentNode;
        }
        const viewport = scroll.getScrollableNode()?.yogaNode;
        const cellSize = horizontal
          ? (node.yogaNode?.getComputedWidth() ?? 0)
          : (node.yogaNode?.getComputedHeight() ?? 0);
        const viewportSize = horizontal
          ? (viewport?.getComputedWidth() ?? 0)
          : (viewport?.getComputedHeight() ?? 0);
        // Measured in cells; viewOffset and scrollTo are in layout units.
        const cell = getCellSize();
        const axis = horizontal ? 'x' : 'y';
        const position =
          fromCells(
            (horizontal ? x : y) - (params.viewPosition ?? 0) * (viewportSize - cellSize),
            cell,
            axis,
          ) - (params.viewOffset ?? 0);
        scroll.scrollTo(horizontal ? { x: position } : { y: position });
      },
      scrollToOffset(offset) {
        scrollRef.current?.scrollTo(horizontal ? { x: offset } : { y: offset });
      },
      visibleLength() {
        const viewport = scrollRef.current?.getScrollableNode()?.yogaNode;
        if (!viewport) return 0;
        const cell = getCellSize();
        return horizontal
          ? fromCells(viewport.getComputedWidth(), cell, 'x')
          : fromCells(viewport.getComputedHeight(), cell, 'y');
      },
      scrollView: () => scrollRef.current,
    }),
    [horizontal],
  );

  useImperativeHandle(listRef, () => {
    const scroll = scrollRef.current;
    return scroll ? Object.assign(scroll, methods(api)) : null;
  }, [api, methods]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll?.(event);
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const offset = horizontal ? contentOffset.x : contentOffset.y;
      const content = horizontal ? contentSize.width : contentSize.height;
      const visible = horizontal ? layoutMeasurement.width : layoutMeasurement.height;
      // The first event comes before the initial scroll: window around where it's going.
      const settling = !didInitialScroll.current && initialScrollOffset !== undefined;
      onViewport?.(settling ? initialScrollOffset : offset, visible);
      const distanceFromEnd = content - offset - visible;
      stickToEnd.current = inverted ? distanceFromEnd <= 0 : false;
      const threshold = (onEndReachedThreshold ?? 0.5) * visible;
      if (onEndReached && distanceFromEnd <= threshold && endReachedFor.current !== content) {
        endReachedFor.current = content;
        onEndReached({ distanceFromEnd });
      }
      if (!didInitialScroll.current) {
        didInitialScroll.current = true;
        if (initialScrollOffset !== undefined) api.scrollToOffset(initialScrollOffset);
        else if (initialScrollId !== undefined) api.scrollToId(initialScrollId);
      }
    },
    [
      onScroll,
      onViewport,
      horizontal,
      inverted,
      onEndReached,
      onEndReachedThreshold,
      initialScrollId,
      initialScrollOffset,
      api,
    ],
  );

  const handleContentSizeChange = useCallback(
    (width: number, height: number) => {
      onContentSizeChange?.(width, height);
      if (stickToEnd.current) scrollRef.current?.scrollToEnd();
    },
    [onContentSizeChange],
  );

  const header = ListHeaderComponent ? (
    <View key="__header" style={ListHeaderComponentStyle}>
      {renderSlot(ListHeaderComponent)}
    </View>
  ) : null;
  const footer = ListFooterComponent ? (
    <View key="__footer" style={ListFooterComponentStyle}>
      {renderSlot(ListFooterComponent)}
    </View>
  ) : null;
  const body = isEmpty
    ? [<View key="__empty">{renderSlot(ListEmptyComponent)}</View>]
    : rows.map((row) => (
        <View
          key={row.key}
          boxRef={(node: DOMElement | null) => {
            if (!row.id) return;
            if (node) cells.current.set(row.id, node);
            else cells.current.delete(row.id);
          }}
        >
          {row.node}
        </View>
      ));
  const children = inverted ? [footer, ...body.reverse(), header] : [header, ...body, footer];

  return (
    <ScrollView
      {...scrollProps}
      horizontal={horizontal}
      ref={scrollRef}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      refreshControl={
        scrollProps.refreshControl ??
        (onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
        ) : undefined)
      }
    >
      {children}
    </ScrollView>
  );
}

/** A scrollable list of items (not virtualized). */
export function FlatList<ItemT>(props: FlatListProps<ItemT>) {
  const {
    data,
    renderItem,
    keyExtractor,
    numColumns = 1,
    columnWrapperStyle,
    initialScrollIndex,
    ItemSeparatorComponent,
    ref,
    ...rest
  } = props;
  const items = useMemo(() => (data ? Array.from(data) : []), [data]);
  const extract = keyExtractor ?? defaultKeyExtractor;
  const columns = Math.max(1, Math.floor(numColumns));
  const {
    getItemLayout,
    windowSize = 21,
    initialNumToRender = 10,
    horizontal,
    pagingEnabled,
  } = rest;

  // With item sizes known up front, render only a window of items around the visible span, as
  // React Native does; spacers keep the content as long as the whole list.
  const windowed = typeof getItemLayout === 'function' && columns === 1 && items.length > 0;
  const [viewport, setViewport] = useState<{ offset: number; length: number } | null>(null);
  const onViewport = useCallback((offset: number, length: number) => {
    setViewport((previous) =>
      previous && previous.offset === offset && previous.length === length
        ? previous
        : { offset, length },
    );
  }, []);
  const layoutOf = (index: number) => getItemLayout!(items, index);
  let first = 0;
  let last = items.length - 1;
  if (windowed) {
    if (viewport && viewport.length > 0) {
      const extra = (Math.max(1, windowSize) - 1) / 2;
      const from = viewport.offset - extra * viewport.length;
      const to = viewport.offset + viewport.length + extra * viewport.length;
      first = firstIndexEndingAfter(items.length, layoutOf, from);
      last = Math.max(first, firstIndexEndingAfter(items.length, layoutOf, to) - 1);
      // `to` falls inside the item it lands on, which is partly visible: keep it.
      if (last + 1 < items.length && layoutOf(last + 1).offset < to) last += 1;
    } else {
      first = Math.min(Math.max(0, initialScrollIndex ?? 0), items.length - 1);
      last = Math.min(items.length - 1, first + Math.max(1, initialNumToRender) - 1);
    }
  }
  // While paging, only the page in view takes focus (Tab doesn't wander into the next page).
  const inScope = useContext(FocusScopeContext);
  const onPage = (index: number) => {
    if (!windowed || !pagingEnabled || !viewport) return true;
    const { offset, length } = layoutOf(index);
    return offset < viewport.offset + viewport.length && offset + length > viewport.offset;
  };
  const spacer = (key: string, length: number): Row => ({
    key,
    node: <View style={horizontal ? { width: length } : { height: length }} />,
  });

  const rows: Row[] = [];
  const indexToId = (index: number) => `row:${Math.floor(index / columns)}`;
  if (windowed && first > 0) {
    rows.push(spacer('__before', layoutOf(first).offset - layoutOf(0).offset));
  }
  for (
    let start = windowed ? first : 0;
    start <= (windowed ? last : items.length - 1);
    start += columns
  ) {
    const group = items.slice(start, start + columns);
    const cells = group.map((item, offset) => {
      const index = start + offset;
      const element = renderItem ? renderItem({ item, index, separators }) : null;
      return columns > 1 ? (
        <View key={extract(item, index)} style={{ flex: 1 }}>
          {element}
        </View>
      ) : (
        element
      );
    });
    const key = group.map((item, offset) => extract(item, start + offset)).join('|');
    const node =
      columns > 1 ? (
        <View style={[{ flexDirection: 'row' }, columnWrapperStyle]}>{cells}</View>
      ) : (
        cells[0]
      );
    rows.push({
      key,
      id: indexToId(start),
      node:
        windowed && pagingEnabled ? (
          <FocusScopeContext.Provider value={inScope && onPage(start)}>
            {node}
          </FocusScopeContext.Provider>
        ) : (
          node
        ),
    });
    if (ItemSeparatorComponent && start + columns < items.length) {
      rows.push({
        key: `${key}:separator`,
        node: <ItemSeparatorComponent highlighted={false} leadingItem={group[group.length - 1]} />,
      });
    }
  }

  if (windowed && last < items.length - 1) {
    const end = layoutOf(items.length - 1);
    const lastShown = layoutOf(last);
    rows.push(spacer('__after', end.offset + end.length - (lastShown.offset + lastShown.length)));
  }

  const latestLayout = useRef(getItemLayout);
  latestLayout.current = getItemLayout;
  const methods = useCallback(
    (api: ListApi) => ({
      scrollToIndex: ({ index, ...params }: { index: number } & ScrollToParams) => {
        const layout = latestLayout.current;
        // A windowed list may not have rendered the row; its offset is known anyway.
        if (layout && columns === 1) {
          const { offset, length } = layout(items, index);
          const visible = api.visibleLength();
          api.scrollToOffset(
            offset - (params.viewPosition ?? 0) * (visible - length) - (params.viewOffset ?? 0),
          );
        } else api.scrollToId(indexToId(index), params);
      },
      scrollToItem: ({ item, ...params }: { item: ItemT } & ScrollToParams) => {
        const index = items.indexOf(item);
        if (index !== -1) api.scrollToId(indexToId(index), params);
      },
      scrollToOffset: ({ offset }: { offset: number }) => api.scrollToOffset(offset),
      recordInteraction() {},
      getNativeScrollRef: () => api.scrollView(),
    }),
    // indexToId only depends on `columns`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, columns],
  );

  return (
    <ListBase
      {...rest}
      rows={rows}
      isEmpty={items.length === 0}
      initialScrollId={initialScrollIndex != null ? indexToId(initialScrollIndex) : undefined}
      initialScrollOffset={
        windowed && initialScrollIndex != null
          ? layoutOf(Math.min(initialScrollIndex, items.length - 1)).offset
          : undefined
      }
      methods={methods}
      listRef={ref}
      onViewport={windowed ? onViewport : undefined}
    />
  );
}

/**
 * The first item that ends after `position` (binary search: item offsets only grow), or
 * `count` when none does.
 */
function firstIndexEndingAfter(
  count: number,
  layoutOf: (index: number) => { offset: number; length: number },
  position: number,
): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    const { offset, length } = layoutOf(middle);
    if (offset + length > position) high = middle;
    else low = middle + 1;
  }
  return low;
}

export interface VirtualizedListProps<ItemT> extends Omit<
  FlatListProps<ItemT>,
  'data' | 'numColumns'
> {
  data?: any;
  getItem: (data: any, index: number) => ItemT;
  getItemCount: (data: any) => number;
}

/** The base list in React Native; items come from `getItem`/`getItemCount`. */
export function VirtualizedList<ItemT>({
  data,
  getItem,
  getItemCount,
  ...props
}: VirtualizedListProps<ItemT>) {
  const count = getItemCount(data);
  const items = Array.from({ length: count }, (_, index) => getItem(data, index));
  return <FlatList {...props} data={items} />;
}

export type DefaultSectionT = Record<string, any>;

export interface SectionBase<ItemT, SectionT = DefaultSectionT> {
  data: ReadonlyArray<ItemT>;
  key?: string;
  renderItem?: SectionListRenderItem<ItemT, SectionT>;
  ItemSeparatorComponent?: ComponentType<any> | null;
  keyExtractor?: (item: ItemT, index: number) => string;
}

export type SectionListData<ItemT, SectionT = DefaultSectionT> = SectionBase<ItemT, SectionT> &
  SectionT;

export interface SectionListRenderItemInfo<
  ItemT,
  SectionT = DefaultSectionT,
> extends ListRenderItemInfo<ItemT> {
  section: SectionListData<ItemT, SectionT>;
}
export type SectionListRenderItem<ItemT, SectionT = DefaultSectionT> = (
  info: SectionListRenderItemInfo<ItemT, SectionT>,
) => ReactElement | null;

export interface SectionListInstance extends FlatListInstance {
  scrollToLocation(params: { sectionIndex: number; itemIndex: number } & ScrollToParams): void;
}

export interface SectionListProps<ItemT, SectionT = DefaultSectionT> extends CommonListProps {
  sections: ReadonlyArray<SectionListData<ItemT, SectionT>>;
  renderItem?: SectionListRenderItem<ItemT, SectionT>;
  renderSectionHeader?: (info: {
    section: SectionListData<ItemT, SectionT>;
  }) => ReactElement | null;
  renderSectionFooter?: (info: {
    section: SectionListData<ItemT, SectionT>;
  }) => ReactElement | null;
  /** Rendered at the top and bottom of each section. */
  SectionSeparatorComponent?: ComponentType<any> | null;
  keyExtractor?: (item: ItemT, index: number) => string;
  ref?: Ref<SectionListInstance | null>;
}

/** A list grouped into sections with optional headers and footers. */
export function SectionList<ItemT, SectionT = DefaultSectionT>(
  props: SectionListProps<ItemT, SectionT>,
) {
  const {
    sections,
    renderItem,
    renderSectionHeader,
    renderSectionFooter,
    SectionSeparatorComponent,
    ItemSeparatorComponent,
    keyExtractor,
    ref,
    ...rest
  } = props;
  const rows: Row[] = [];
  sections.forEach((section, sectionIndex) => {
    const sectionKey = section.key ?? String(sectionIndex);
    const header = renderSectionHeader?.({ section });
    if (header) rows.push({ key: `${sectionKey}:header`, id: `${sectionIndex}:-1`, node: header });
    if (SectionSeparatorComponent && section.data.length > 0) {
      rows.push({
        key: `${sectionKey}:top`,
        node: <SectionSeparatorComponent section={section} />,
      });
    }
    const extract = section.keyExtractor ?? keyExtractor ?? defaultKeyExtractor;
    const render = section.renderItem ?? renderItem;
    const Separator = section.ItemSeparatorComponent ?? ItemSeparatorComponent;
    section.data.forEach((item, index) => {
      const key = `${sectionKey}:${extract(item, index)}`;
      rows.push({
        key,
        id: `${sectionIndex}:${index}`,
        node: render ? render({ item, index, section, separators }) : null,
      });
      if (Separator && index < section.data.length - 1) {
        rows.push({
          key: `${key}:separator`,
          node: <Separator highlighted={false} leadingItem={item} section={section} />,
        });
      }
    });
    if (SectionSeparatorComponent && section.data.length > 0) {
      rows.push({
        key: `${sectionKey}:bottom`,
        node: <SectionSeparatorComponent section={section} />,
      });
    }
    const footer = renderSectionFooter?.({ section });
    if (footer) rows.push({ key: `${sectionKey}:footer`, node: footer });
  });

  const methods = useCallback(
    (api: ListApi) => ({
      scrollToLocation: ({
        sectionIndex,
        itemIndex,
        ...params
      }: { sectionIndex: number; itemIndex: number } & ScrollToParams) =>
        api.scrollToId(`${sectionIndex}:${itemIndex}`, params),
      scrollToOffset: ({ offset }: { offset: number }) => api.scrollToOffset(offset),
      recordInteraction() {},
      getNativeScrollRef: () => api.scrollView(),
    }),
    [],
  );

  const isEmpty = sections.every((section) => section.data.length === 0);
  return <ListBase {...rest} rows={rows} isEmpty={isEmpty} methods={methods} listRef={ref} />;
}

/** React Native's base for SectionList. */
export function VirtualizedSectionList<ItemT, SectionT = DefaultSectionT>(
  props: SectionListProps<ItemT, SectionT>,
) {
  return <SectionList {...props} />;
}
