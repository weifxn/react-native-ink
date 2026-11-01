import { useCallback, useContext, useEffect, useId, useRef, type RefObject } from 'react';
import { useFocus, useFocusManager, useStdin, type DOMElement } from 'ink';
import { FocusScopeContext, ScrollIntoViewContext } from './contexts.js';

export interface FocusableOptions {
  /** Whether the component can take focus right now (focusable and not disabled). */
  enabled: boolean;
  autoFocus?: boolean;
  /** Host node, used to scroll the component into view inside a ScrollView. */
  nodeRef?: RefObject<DOMElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface Focusable {
  id: string;
  isFocused: boolean;
  /** True when focused and stdin can deliver keypresses (raw mode supported). */
  receivesInput: boolean;
  focus(): void;
  blur(): void;
}

/**
 * Registers a component with Ink's focus manager (Tab / Shift+Tab / Esc), respecting modal
 * focus scopes, and fires onFocus/onBlur on transitions.
 */
export function useFocusable(options: FocusableOptions): Focusable {
  const scopeActive = useContext(FocusScopeContext);
  const scroll = useContext(ScrollIntoViewContext);
  const { isRawModeSupported } = useStdin();
  const id = `rni${useId()}`;
  const { isFocused } = useFocus({
    isActive: options.enabled && scopeActive,
    autoFocus: options.autoFocus ?? false,
    id,
  });
  const { focus: focusId, disableFocus, enableFocus } = useFocusManager();

  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const callbacks = useRef(options);
  callbacks.current = options;

  const previous = useRef(false);
  useEffect(() => {
    if (previous.current === isFocused) return;
    previous.current = isFocused;
    if (isFocused) {
      const node = callbacks.current.nodeRef?.current;
      if (node && scroll) scroll.scrollIntoView(node);
      callbacks.current.onFocus?.();
    } else {
      callbacks.current.onBlur?.();
    }
  }, [isFocused, scroll]);

  const focus = useCallback(() => focusId(id), [focusId, id]);
  const blur = useCallback(() => {
    if (focusedRef.current) {
      disableFocus();
      enableFocus();
    }
  }, [disableFocus, enableFocus]);

  return { id, isFocused, receivesInput: isFocused && isRawModeSupported, focus, blur };
}
