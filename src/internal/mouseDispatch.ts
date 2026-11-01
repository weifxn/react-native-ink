import type { DOMElement } from 'ink';
import type { MouseEvent, WheelDirection } from './mouse.js';
import { hitTest, isWithin, locationIn, targetAt, type PointerTarget } from './pointer.js';
import { pageScroller, scrollerOf } from './scrollers.js';

/** React Native's default `delayLongPress`. */
const LONG_PRESS_DELAY_MS = 500;

/** What the dispatcher needs from the app root. */
export interface PointerRoot {
  /** Ink's root node, once the app has rendered. */
  node(): DOMElement | undefined;
  /** Rows in the terminal window. */
  rows(): number;
  /** True when Ink draws from the top of the window (its alternate screen). */
  fromTop: boolean;
  /** Takes focus away from whatever has it. */
  blur(): void;
}

export interface PointerDispatcher {
  dispatch(event: MouseEvent): void;
  dispose(): void;
}

interface Held {
  node: DOMElement;
  target: PointerTarget;
  long: boolean;
  timer?: NodeJS.Timeout;
}

/**
 * Turns mouse events into presses and scrolling: a press goes to the component that takes
 * clicks at the pointer (the one on top, or the nearest around it), pressed while the button is
 * held and activated if it comes up over the same component; a click on nothing that takes
 * clicks takes focus away, as in a browser. The wheel scrolls the ScrollView under the pointer
 * that can move that way, else the page.
 */
export function createPointerDispatcher(root: PointerRoot): PointerDispatcher {
  let held: Held | undefined;

  /** The layout point under the window's (column, row), if it can be known. */
  const layoutPoint = (event: MouseEvent) => {
    const node = root.node();
    if (!node) return undefined;
    const height = node.yogaNode?.getComputedHeight() ?? 0;
    // A frame taller than the window shows its last rows. A shorter one starts at the top of
    // the alternate screen, but on the main screen below whatever the shell printed, at a row
    // that isn't known: clicks there are ignored rather than sent to the wrong place.
    const hidden = height - root.rows();
    if (hidden < 0 && !root.fromTop) return undefined;
    return { node, column: event.column, row: event.row + Math.max(0, hidden) };
  };

  const end = (activate: boolean, column: number, row: number) => {
    const current = held;
    if (!current) return;
    held = undefined;
    clearTimeout(current.timer);
    current.target.pressOut(locationIn(current.node, column, row), activate && !current.long);
  };

  const wheel = (under: DOMElement | undefined, direction: WheelDirection, shift: boolean) => {
    // Shift turns the wheel sideways, as in most apps.
    const sideways = direction === 'left' || direction === 'right' || shift;
    const step = direction === 'up' || direction === 'left' ? -1 : 1;
    for (let current = under; current; current = current.parentNode) {
      const scroller = scrollerOf(current);
      if (scroller && scroller.horizontal === sideways && scroller.wheel(step)) return;
    }
    if (!sideways) pageScroller()?.wheel(step);
  };

  return {
    dispatch(event) {
      const point = layoutPoint(event);
      if (!point) return;
      const under = hitTest(point.node, point.column, point.row);
      if (event.type === 'wheel') {
        wheel(under, event.direction, event.shift);
        return;
      }
      if (event.button !== 'left') return;
      if (event.type === 'up') {
        if (held) end(isWithin(under, held.node), point.column, point.row);
        return;
      }
      // A press whose release never came (the button went up outside the window) ends here.
      end(false, point.column, point.row);
      const found = targetAt(under);
      if (!found) {
        root.blur();
        return;
      }
      const location = locationIn(found.node, point.column, point.row);
      const current: Held = { node: found.node, target: found.target, long: false };
      held = current;
      found.target.pressIn(location);
      const { longPress } = found.target;
      if (longPress) {
        current.timer = setTimeout(() => {
          if (held !== current) return;
          current.long = true;
          longPress(location);
        }, found.target.longPressDelay ?? LONG_PRESS_DELAY_MS);
      }
    },
    dispose() {
      clearTimeout(held?.timer);
      held = undefined;
    },
  };
}
