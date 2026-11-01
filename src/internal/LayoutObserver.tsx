import { useEffect, useRef, type RefObject } from 'react';
import { useBoxMetrics, type DOMElement } from 'ink';
import { createSyntheticEvent, type LayoutChangeEvent } from './events.js';

interface LayoutObserverProps {
  target: RefObject<DOMElement | null>;
  onLayout: (event: LayoutChangeEvent) => void;
}

/** Renders nothing; calls `onLayout` whenever the target's layout changes (like React Native). */
export function LayoutObserver({ target, onLayout }: LayoutObserverProps) {
  const metrics = useBoxMetrics(target);
  const callback = useRef(onLayout);
  callback.current = onLayout;
  const { left, top, width, height, hasMeasured } = metrics;
  useEffect(() => {
    if (!hasMeasured) return;
    callback.current(
      createSyntheticEvent(
        'layout',
        { layout: { x: left, y: top, width, height } },
        target.current,
      ),
    );
  }, [left, top, width, height, hasMeasured, target]);
  return null;
}
