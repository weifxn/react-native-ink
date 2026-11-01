import { currentRoot } from '../internal/root.js';
import type { EmitterSubscription } from './EventEmitter.js';

const no = (): Promise<boolean> => Promise.resolve(false);

/** Reflects Ink's screen-reader mode (`INK_SCREEN_READER=true` or the render option). */
export const AccessibilityInfo = {
  isScreenReaderEnabled(): Promise<boolean> {
    return Promise.resolve(currentRoot()?.isScreenReaderEnabled ?? process.env.INK_SCREEN_READER === 'true');
  },
  isAccessibilityServiceEnabled: no,
  isBoldTextEnabled: no,
  isGrayscaleEnabled: no,
  isInvertColorsEnabled: no,
  isReduceMotionEnabled: no,
  isReduceTransparencyEnabled: no,
  isHighTextContrastEnabled: no,
  isDarkerSystemColorsEnabled: no,
  prefersCrossFadeTransitions: no,
  addEventListener(_eventName: string, _handler: (value: unknown) => void): EmitterSubscription {
    return { remove() {} };
  },
  setAccessibilityFocus(_reactTag: number): void {},
  announceForAccessibility(_announcement: string): void {},
  announceForAccessibilityWithOptions(_announcement: string, _options: { queue?: boolean }): void {},
  getRecommendedTimeoutMillis(originalTimeout: number): Promise<number> {
    return Promise.resolve(originalTimeout);
  },
  sendAccessibilityEvent(_handle: unknown, _eventType: string): void {},
};
