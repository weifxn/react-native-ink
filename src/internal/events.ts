/** React Native–shaped event objects. */

export interface NativeSyntheticEvent<T> {
  nativeEvent: T;
  currentTarget: unknown;
  target: unknown;
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented: boolean;
  eventPhase: number;
  isTrusted: boolean;
  timeStamp: number;
  type: string;
  preventDefault(): void;
  isDefaultPrevented(): boolean;
  stopPropagation(): void;
  isPropagationStopped(): boolean;
  persist(): void;
}

export interface NativeTouchEvent {
  changedTouches: NativeTouchEvent[];
  identifier: string;
  locationX: number;
  locationY: number;
  pageX: number;
  pageY: number;
  target: string;
  timestamp: number;
  touches: NativeTouchEvent[];
  force?: number;
}

export type GestureResponderEvent = NativeSyntheticEvent<NativeTouchEvent>;

export interface LayoutRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutChangeEventData {
  layout: LayoutRectangle;
}

export type LayoutChangeEvent = NativeSyntheticEvent<LayoutChangeEventData>;

export function createSyntheticEvent<T>(
  type: string,
  nativeEvent: T,
  target: unknown = null,
): NativeSyntheticEvent<T> {
  let defaultPrevented = false;
  let propagationStopped = false;
  return {
    nativeEvent,
    currentTarget: target,
    target,
    bubbles: false,
    cancelable: false,
    get defaultPrevented() {
      return defaultPrevented;
    },
    eventPhase: 2,
    isTrusted: true,
    timeStamp: Date.now(),
    type,
    preventDefault() {
      defaultPrevented = true;
    },
    isDefaultPrevented() {
      return defaultPrevented;
    },
    stopPropagation() {
      propagationStopped = true;
    },
    isPropagationStopped() {
      return propagationStopped;
    },
    persist() {},
  };
}

/** A keyboard-triggered press, shaped like React Native's touch event. */
export function createPressEvent(type: string, target: unknown = null): GestureResponderEvent {
  const timestamp = Date.now();
  const touch: NativeTouchEvent = {
    changedTouches: [],
    identifier: '0',
    locationX: 0,
    locationY: 0,
    pageX: 0,
    pageY: 0,
    target: '',
    timestamp,
    touches: [],
  };
  return createSyntheticEvent(type, touch, target);
}
