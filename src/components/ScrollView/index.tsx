import {
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from 'react';
import { Box, Text as InkText, useBoxMetrics, useInput, type DOMElement } from 'ink';
import { FocusScopeContext, ScrollIntoViewContext } from '../../internal/contexts.js';
import {
  ScrollDepthContext,
  registerScroller,
  type ScrollAction,
} from '../../internal/scrollers.js';
import { createSyntheticEvent, type NativeSyntheticEvent } from '../../internal/events.js';
import { useFocusable } from '../../internal/focus.js';
import { attachNativeMethods, type HostInstance } from '../../internal/nativeMethods.js';
import { isUnicodeSupported } from '../../internal/terminal.js';
import { FlexDirectionContext, fromCells, getCellSize, toCells } from '../../internal/units.js';
import type { StyleProp, ViewStyle } from '../../style/types.js';
import { ActivityIndicator } from '../ActivityIndicator/index.js';
import type { RefreshControlProps } from '../simple.js';
import { View, type ViewProps } from '../View/index.js';

export interface NativeScrollPoint {
  x: number;
  y: number;
}
export interface NativeScrollSize {
  width: number;
  height: number;
}
export interface NativeScrollEvent {
  contentInset: { top: number; left: number; bottom: number; right: number };
  contentOffset: NativeScrollPoint;
  contentSize: NativeScrollSize;
  layoutMeasurement: NativeScrollSize;
  zoomScale: number;
}

export interface ScrollViewInstance extends HostInstance {
  scrollTo(
    options?: { x?: number; y?: number; animated?: boolean } | number,
    x?: number,
    animated?: boolean,
  ): void;
  scrollToEnd(options?: { animated?: boolean }): void;
  flashScrollIndicators(): void;
  getScrollResponder(): ScrollViewInstance;
  getScrollableNode(): DOMElement | null;
  getInnerViewNode(): DOMElement | null;
}

export interface ScrollViewProps extends Omit<ViewProps, 'ref'> {
  horizontal?: boolean | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  /** Keyboard scrolling (↑/↓, PgUp/PgDn, Home/End while focused). Default true. */
  scrollEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  /** Initial scroll position. */
  contentOffset?: NativeScrollPoint;
  /** While its `refreshing` prop is true, a spinner shows above the content. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Terminal extension: take focus on mount if nothing else is focused. */
  autoFocus?: boolean;
  /** @remarks Ignored in terminals. */
  keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
  /** @remarks Ignored in terminals. */
  keyboardDismissMode?: 'none' | 'interactive' | 'on-drag';
  /** @remarks Ignored in terminals. */
  bounces?: boolean;
  /** Arrow keys move a whole page (the viewport), landing on page boundaries. */
  pagingEnabled?: boolean;
  /** @remarks Ignored in terminals. */
  scrollEventThrottle?: number;
  /** @remarks Ignored in terminals. */
  decelerationRate?: 'fast' | 'normal' | number;
  /** @remarks Ignored in terminals. */
  snapToInterval?: number;
  /** @remarks Ignored in terminals. */
  stickyHeaderIndices?: number[];
  /** @remarks Ignored in terminals. */
  nestedScrollEnabled?: boolean;
  /** @remarks Ignored in terminals. */
  persistentScrollbar?: boolean;
  /** @remarks Ignored in terminals. */
  indicatorStyle?: 'default' | 'black' | 'white';
  /** @remarks Ignored in terminals. */
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Called when a scroll from the keyboard has landed, before `onMomentumScrollEnd`. */
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** @remarks Ignored in terminals. */
  onMomentumScrollBegin?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Called when a scroll from the keyboard has landed (a terminal's equivalent of a fling ending). */
  onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  ref?: Ref<ScrollViewInstance | null>;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(Math.round(value), max));

/** Yoga's Overflow.Scroll: children are measured without a limit along the scroll axis. */
const YOGA_OVERFLOW_SCROLL = 2;

interface IndicatorProps {
  horizontal: boolean;
  size: number;
  contentSize: number;
  offset: number;
  focused: boolean;
}

function ScrollIndicator({ horizontal, size, contentSize, offset, focused }: IndicatorProps) {
  if (size <= 0 || contentSize <= size) return null;
  const unicode = isUnicodeSupported();
  const [track, thumb] = horizontal
    ? unicode
      ? ['─', '━']
      : ['-', '=']
    : unicode
      ? ['│', '┃']
      : ['|', '#'];
  const thumbSize = Math.max(1, Math.round((size * size) / contentSize));
  const maxOffset = contentSize - size;
  const thumbStart = Math.round(((size - thumbSize) * offset) / maxOffset);
  const cells = Array.from(
    { length: size },
    (_, index) => index >= thumbStart && index < thumbStart + thumbSize,
  );
  const color = focused ? 'cyan' : undefined;
  if (horizontal) {
    return (
      <Box position="absolute" bottom={0} left={0} flexDirection="row">
        <InkText>
          {cells.map((isThumb, index) => (
            <InkText key={index} color={isThumb ? color : undefined} dimColor={!isThumb}>
              {isThumb ? thumb : track}
            </InkText>
          ))}
        </InkText>
      </Box>
    );
  }
  return (
    <Box position="absolute" top={0} right={0} flexDirection="column">
      {cells.map((isThumb, index) => (
        <InkText key={index} color={isThumb ? color : undefined} dimColor={!isThumb}>
          {isThumb ? thumb : track}
        </InkText>
      ))}
    </Box>
  );
}

/** Position of `node` relative to `ancestor`, or undefined when it is not a descendant. */
function offsetWithin(node: DOMElement, ancestor: DOMElement) {
  let x = 0;
  let y = 0;
  let current: DOMElement | undefined = node;
  while (current && current !== ancestor) {
    x += current.yogaNode?.getComputedLeft() ?? 0;
    y += current.yogaNode?.getComputedTop() ?? 0;
    current = current.parentNode;
  }
  if (current !== ancestor) return undefined;
  return {
    x,
    y,
    width: node.yogaNode?.getComputedWidth() ?? 1,
    height: node.yogaNode?.getComputedHeight() ?? 1,
  };
}

/**
 * A bounded, scrollable container. Give it a height (or put it in a bounded parent). While
 * focused, ↑/↓ (←/→ when horizontal), PgUp/PgDn and Home/End scroll it; focused descendants are
 * scrolled into view automatically.
 */
export function ScrollView(props: ScrollViewProps) {
  const {
    horizontal: horizontalProp,
    contentContainerStyle,
    onScroll,
    onContentSizeChange,
    scrollEnabled = true,
    showsVerticalScrollIndicator = true,
    showsHorizontalScrollIndicator = true,
    contentOffset,
    refreshControl,
    autoFocus,
    style,
    children,
    ref,
    keyboardShouldPersistTaps: _a,
    keyboardDismissMode: _b,
    bounces: _c,
    pagingEnabled,
    scrollEventThrottle: _e,
    decelerationRate: _f,
    snapToInterval: _g,
    stickyHeaderIndices: _h,
    nestedScrollEnabled: _i,
    persistentScrollbar: _j,
    indicatorStyle: _k,
    onScrollBeginDrag: _l,
    onScrollEndDrag,
    onMomentumScrollBegin: _n,
    onMomentumScrollEnd,
    ...viewProps
  } = props;
  const horizontal = Boolean(horizontalProp);
  const outerRef = useRef<DOMElement>(null);
  const viewportRef = useRef<DOMElement>(null);
  const contentRef = useRef<DOMElement>(null);
  const viewport = useBoxMetrics(viewportRef);
  const content = useBoxMetrics(contentRef);

  // Ink only clips overflow at render time; tell Yoga the viewport scrolls (like React Native)
  // so content can extend past it along the scroll axis, then lay out again.
  const [, relayout] = useReducer((count: number) => count + 1, 0);
  useLayoutEffect(() => {
    const yoga = viewportRef.current?.yogaNode;
    if (yoga && yoga.getOverflow() !== YOGA_OVERFLOW_SCROLL) {
      yoga.setOverflow(YOGA_OVERFLOW_SCROLL);
      relayout();
    }
  });
  // Offsets are kept in cells; the props, events and ref methods speak layout units.
  const cell = getCellSize();
  const [offset, setOffset] = useState<NativeScrollPoint>(() => ({
    x: toCells(contentOffset?.x ?? 0, cell, 'x', 'space'),
    y: toCells(contentOffset?.y ?? 0, cell, 'y', 'space'),
  }));

  const maxX = Math.max(0, content.width - viewport.width);
  const maxY = Math.max(0, content.height - viewport.height);
  const measured = viewport.hasMeasured && content.hasMeasured;
  const current = measured ? { x: clamp(offset.x, maxX), y: clamp(offset.y, maxY) } : offset;
  const overflows = horizontal ? maxX > 0 : maxY > 0;

  const live = useRef({ maxX, maxY, current, width: viewport.width, height: viewport.height });
  live.current = { maxX, maxY, current, width: viewport.width, height: viewport.height };

  const focus = useFocusable({ enabled: scrollEnabled && overflows, autoFocus, nodeRef: outerRef });
  const depth = useContext(ScrollDepthContext);
  const scopeActive = useContext(FocusScopeContext);

  const scrollTo = useCallback((x?: number, y?: number) => {
    setOffset((previous) => {
      const next = {
        x: clamp(x ?? previous.x, live.current.maxX),
        y: clamp(y ?? previous.y, live.current.maxY),
      };
      return next.x === previous.x && next.y === previous.y ? previous : next;
    });
  }, []);

  // Set by a scroll from the keyboard, so the scroll events it causes also report it as ended.
  const userScroll = useRef(false);
  const paging = Boolean(pagingEnabled);

  /** A step from the keyboard: a cell (a page when paging), a page, or to either end. */
  const scrollBy = useCallback(
    (action: ScrollAction) => {
      const { current: position, width, height, maxX: limitX, maxY: limitY } = live.current;
      const at = horizontal ? position.x : position.y;
      const page = horizontal ? width : height;
      const limit = horizontal ? limitX : limitY;
      // Paging lands on page boundaries, as a paging scroll view does after a swipe.
      const toPage = (direction: 1 | -1) =>
        page > 0 ? (Math.round(at / page) + direction) * page : at;
      const targets: Record<ScrollAction, number> = {
        up: paging ? toPage(-1) : at - 1,
        down: paging ? toPage(1) : at + 1,
        pageUp: paging ? toPage(-1) : at - page,
        pageDown: paging ? toPage(1) : at + page,
        home: 0,
        end: limit,
      };
      const target = clamp(targets[action], limit);
      if (target === at) return;
      userScroll.current = true;
      if (horizontal) scrollTo(target);
      else scrollTo(undefined, target);
    },
    [horizontal, paging, scrollTo],
  );

  useInput(
    (_input, key) => {
      const back = horizontal ? key.leftArrow : key.upArrow;
      const forward = horizontal ? key.rightArrow : key.downArrow;
      const action: ScrollAction | undefined = back
        ? 'up'
        : forward
          ? 'down'
          : key.pageUp
            ? 'pageUp'
            : key.pageDown
              ? 'pageDown'
              : key.home
                ? 'home'
                : key.end
                  ? 'end'
                  : undefined;
      if (action) scrollBy(action);
    },
    { isActive: focus.receivesInput && scrollEnabled },
  );

  // A vertical ScrollView can be the page's: with nothing focused, the arrow keys scroll the
  // outermost one (see AppRoot), as they scroll a browser's page.
  const scrollable = useRef(false);
  scrollable.current = scrollEnabled && overflows && scopeActive;
  const latestScrollBy = useRef(scrollBy);
  latestScrollBy.current = scrollBy;
  useEffect(() => {
    if (horizontal) return undefined;
    return registerScroller({
      depth,
      canScroll: () => scrollable.current,
      scroll: (action) => latestScrollBy.current(action),
    });
  }, [horizontal, depth]);

  const callbacks = useRef({ onScroll, onContentSizeChange, onScrollEndDrag, onMomentumScrollEnd });
  callbacks.current = { onScroll, onContentSizeChange, onScrollEndDrag, onMomentumScrollEnd };
  useEffect(() => {
    if (!measured) return;
    const event = () =>
      createSyntheticEvent(
        'scroll',
        {
          contentOffset: { x: fromCells(current.x, cell, 'x'), y: fromCells(current.y, cell, 'y') },
          contentSize: {
            width: fromCells(content.width, cell, 'x'),
            height: fromCells(content.height, cell, 'y'),
          },
          layoutMeasurement: {
            width: fromCells(viewport.width, cell, 'x'),
            height: fromCells(viewport.height, cell, 'y'),
          },
          contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
          zoomScale: 1,
        },
        outerRef.current,
      );
    callbacks.current.onScroll?.(event());
    if (userScroll.current) {
      // A keyboard step lands at once: the drag and the momentum that follow it both end here.
      userScroll.current = false;
      callbacks.current.onScrollEndDrag?.(event());
      callbacks.current.onMomentumScrollEnd?.(event());
    }
    // Only offset changes fire onScroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.x, current.y, measured]);
  useEffect(() => {
    if (content.hasMeasured) {
      callbacks.current.onContentSizeChange?.(
        fromCells(content.width, cell, 'x'),
        fromCells(content.height, cell, 'y'),
      );
    }
    // The cell size is fixed before the app renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.width, content.height, content.hasMeasured]);

  const outerScroll = useContext(ScrollIntoViewContext);
  const scrollIntoView = useMemo(
    () => ({
      scrollIntoView(
        node: DOMElement,
        part?: { x: number; y: number; width: number; height: number },
      ) {
        const container = contentRef.current;
        const viewportNode = viewportRef.current;
        if (!container || !viewportNode) return;
        const at = offsetWithin(node, container);
        if (!at) return;
        const rect = part
          ? { x: at.x + part.x, y: at.y + part.y, width: part.width, height: part.height }
          : at;
        const { current: position, width, height, maxX: limitX, maxY: limitY } = live.current;
        let next = { ...position };
        if (horizontal) {
          if (rect.x < position.x) next.x = rect.x;
          else if (rect.x + rect.width > position.x + width) next.x = rect.x + rect.width - width;
        } else if (rect.y < position.y) next.y = rect.y;
        else if (rect.y + rect.height > position.y + height) next.y = rect.y + rect.height - height;
        next = { x: clamp(next.x, limitX), y: clamp(next.y, limitY) };
        if (next.x !== position.x || next.y !== position.y) scrollTo(next.x, next.y);
        // Then the ScrollView around this one, for the part of this viewport the target now fills.
        outerScroll?.scrollIntoView(viewportNode, {
          x: rect.x - next.x,
          y: rect.y - next.y,
          width: rect.width,
          height: rect.height,
        });
      },
    }),
    [horizontal, scrollTo, outerScroll],
  );

  useImperativeHandle(ref, () => {
    const node = outerRef.current;
    if (!node) return null as unknown as ScrollViewInstance;
    const cellX = (value?: number) =>
      value === undefined ? undefined : toCells(value, getCellSize(), 'x', 'space');
    const cellY = (value?: number) =>
      value === undefined ? undefined : toCells(value, getCellSize(), 'y', 'space');
    const instance = Object.assign(attachNativeMethods(node), {
      // Deprecated React Native signature: scrollTo(y, x, animated).
      scrollTo(options?: { x?: number; y?: number } | number, x?: number) {
        if (typeof options === 'number') scrollTo(cellX(x), cellY(options));
        else scrollTo(cellX(options?.x), cellY(options?.y));
      },
      scrollToEnd() {
        if (horizontal) scrollTo(live.current.maxX);
        else scrollTo(undefined, live.current.maxY);
      },
      flashScrollIndicators() {},
      getScrollResponder: () => instance,
      getScrollableNode: () => viewportRef.current,
      getInnerViewNode: () => contentRef.current,
    }) as ScrollViewInstance;
    return instance;
  }, [horizontal, scrollTo]);

  const refreshing = isValidElement(refreshControl) && Boolean(refreshControl.props.refreshing);
  const showIndicator = horizontal ? showsHorizontalScrollIndicator : showsVerticalScrollIndicator;

  return (
    <View
      {...viewProps}
      style={[{ flexGrow: 1, flexShrink: 1 }, style]}
      boxRef={outerRef}
      component="ScrollView"
    >
      <Box flexGrow={1} flexShrink={1} flexDirection="column">
        <Box
          ref={viewportRef}
          flexGrow={1}
          flexShrink={1}
          flexDirection={horizontal ? 'row' : 'column'}
          overflow="hidden"
          contentOffsetX={current.x}
          contentOffsetY={current.y}
        >
          <ScrollIntoViewContext.Provider value={scrollIntoView}>
            <ScrollDepthContext.Provider value={depth + 1}>
              <FlexDirectionContext.Provider value={horizontal ? 'row' : 'column'}>
                <View
                  style={[
                    { flexShrink: 0, flexDirection: horizontal ? 'row' : 'column' },
                    contentContainerStyle,
                  ]}
                  boxRef={contentRef}
                  component="ScrollView contentContainerStyle"
                >
                  {refreshing ? (
                    <View style={{ alignItems: 'center' }}>
                      <ActivityIndicator color={refreshControl.props.tintColor} />
                    </View>
                  ) : null}
                  {children}
                </View>
              </FlexDirectionContext.Provider>
            </ScrollDepthContext.Provider>
          </ScrollIntoViewContext.Provider>
        </Box>
        {showIndicator && measured ? (
          <ScrollIndicator
            horizontal={horizontal}
            size={horizontal ? viewport.width : viewport.height}
            contentSize={horizontal ? content.width : content.height}
            offset={horizontal ? current.x : current.y}
            focused={focus.isFocused}
          />
        ) : null}
      </Box>
    </View>
  );
}
