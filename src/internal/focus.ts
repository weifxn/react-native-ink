import { useCallback, useContext, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useFocus, useFocusManager, useStdin, type DOMElement } from 'ink';
import { FocusScopeContext, ScrollIntoViewContext } from './contexts.js';

export interface FocusableOptions {
  /** Whether the component can take focus right now (focusable and not disabled). */
  enabled: boolean;
  autoFocus?: boolean;
  /**
   * Host node, used to scroll the component into view inside a ScrollView and to keep Tab in
   * the order components appear on screen.
   */
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
 * Tab order. Ink moves focus in the order components registered, which is the order they
 * mounted — so a button that appears once its data has loaded would come after everything that
 * was already on screen, wherever it is. To keep Tab in tree order (as a browser follows the
 * DOM), a focusable that mounts ahead of others in the tree makes those re-register, which moves
 * them back behind it in Ink's list.
 */
interface Registration {
  node(): DOMElement | null | undefined;
  /** Registers again under a new id, which puts it last in Ink's list. */
  reregister(): void;
}

const registrations: Registration[] = [];

/** Child indexes from the root down to `node`. */
function treePath(node: DOMElement): number[] {
  const path: number[] = [];
  let current: DOMElement = node;
  while (current.parentNode) {
    path.unshift(current.parentNode.childNodes.indexOf(current));
    current = current.parentNode;
  }
  return path;
}

/**
 * Negative when `a` comes first in the order React mounts things: depth-first, a parent after
 * its children (a ScrollView after the buttons in it), siblings in order.
 */
export function compareTreeOrder(a: readonly number[], b: readonly number[]): number {
  const shared = Math.min(a.length, b.length);
  for (let index = 0; index < shared; index++) {
    if (a[index] !== b[index]) return a[index]! - b[index]!;
  }
  return b.length - a.length;
}

function rootOf(node: DOMElement): DOMElement {
  let current = node;
  while (current.parentNode) current = current.parentNode;
  return current;
}

function placeInTreeOrder(added: Registration): void {
  const node = added.node();
  if (!node) return;
  const root = rootOf(node);
  const position = treePath(node);
  const behind = registrations
    .filter((other) => other !== added)
    .map((other) => ({ other, node: other.node() }))
    .filter(
      (entry): entry is { other: Registration; node: DOMElement } =>
        entry.node !== null &&
        entry.node !== undefined &&
        rootOf(entry.node) === root &&
        compareTreeOrder(position, treePath(entry.node)) < 0,
    );
  // React re-registers them in tree order, all in the same commit.
  for (const { other } of behind) other.reregister();
}

/**
 * Registers a component with Ink's focus manager (Tab / Shift+Tab / Esc), respecting modal
 * focus scopes, and fires onFocus/onBlur on transitions.
 */
export function useFocusable(options: FocusableOptions): Focusable {
  const scopeActive = useContext(FocusScopeContext);
  const scroll = useContext(ScrollIntoViewContext);
  const { isRawModeSupported } = useStdin();
  const [generation, setGeneration] = useState(0);
  const id = `rni${useId()}${generation === 0 ? '' : `.${generation}`}`;
  const { isFocused } = useFocus({
    isActive: options.enabled && scopeActive,
    // Only on mount: registering again must not take focus from whatever has it.
    autoFocus: generation === 0 && (options.autoFocus ?? false),
    id,
  });
  const { focus: focusId, disableFocus, enableFocus } = useFocusManager();

  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const callbacks = useRef(options);
  callbacks.current = options;

  // Tab order (see above). Runs after Ink's own registration, which useFocus did first.
  const refocus = useRef(false);
  useEffect(() => {
    const registration: Registration = {
      node: () => callbacks.current.nodeRef?.current,
      reregister: () => {
        refocus.current = focusedRef.current;
        setGeneration((value) => value + 1);
      },
    };
    registrations.push(registration);
    if (refocus.current) {
      // Ink dropped focus with the old id; this is the same component.
      refocus.current = false;
      focusId(id);
    }
    placeInTreeOrder(registration);
    return () => {
      const index = registrations.indexOf(registration);
      if (index !== -1) registrations.splice(index, 1);
    };
  }, [id, focusId]);

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
