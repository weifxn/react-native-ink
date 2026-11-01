import {
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Box,
  Text as InkText,
  useBoxMetrics,
  useInput,
  usePaste,
  type DOMElement,
  type Key,
} from 'ink';
import stringWidth from 'string-width';
import { resolveAccessibility } from '../../internal/accessibility.js';
import { createSyntheticEvent, type NativeSyntheticEvent } from '../../internal/events.js';
import { useFocusable } from '../../internal/focus.js';
import { usePointerTarget } from '../../internal/pointer.js';
import { LayoutObserver } from '../../internal/LayoutObserver.js';
import { attachNativeMethods, type HostInstance } from '../../internal/nativeMethods.js';
import { blendColor, resolveColor, withBorderBackground } from '../../style/colors.js';
import { BackgroundColorContext } from '../../internal/contexts.js';
import { flattenStyle } from '../../style/flatten.js';
import { resolveTextStyle, splitTextStyle } from '../../style/text.js';
import type { ColorValue, StyleProp, TextStyle } from '../../style/types.js';
import { resolveViewStyle } from '../../style/view.js';
import { FlexDirectionContext, getCellSize } from '../../internal/units.js';
import type { ViewProps } from '../View/index.js';
import {
  backspace,
  cursorToOffset,
  deleteForward,
  deleteToLineEnd,
  deleteToLineStart,
  deleteWordBackward,
  graphemes,
  insert,
  moveDown,
  moveEnd,
  moveHome,
  moveLeft,
  moveRight,
  moveUp,
  moveWordLeft,
  moveWordRight,
  offsetToCursor,
  sanitize,
  type EditState,
} from './editing.js';

export type TextInputChangeEvent = NativeSyntheticEvent<{
  text: string;
  eventCount: number;
  target: number;
}>;
export type TextInputFocusEvent = NativeSyntheticEvent<{ text: string; target: number }>;
export type TextInputSubmitEditingEvent = NativeSyntheticEvent<{ text: string; target: number }>;
export type TextInputEndEditingEvent = NativeSyntheticEvent<{ text: string; target: number }>;
export type TextInputKeyPressEvent = NativeSyntheticEvent<{ key: string }>;
export type TextInputSelectionChangeEvent = NativeSyntheticEvent<{
  selection: { start: number; end: number };
  target: number;
}>;

export interface TextInputInstance extends HostInstance {
  focus(): void;
  blur(): void;
  clear(): void;
  isFocused(): boolean;
  setSelection(start: number, end: number): void;
  getNativeRef(): HostInstance | null;
}

export interface TextInputProps extends Omit<ViewProps, 'style' | 'ref' | 'children'> {
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  onChange?: (event: TextInputChangeEvent) => void;
  onSubmitEditing?: (event: TextInputSubmitEditingEvent) => void;
  onEndEditing?: (event: TextInputEndEditingEvent) => void;
  onFocus?: (event: TextInputFocusEvent) => void;
  onBlur?: (event: TextInputFocusEvent) => void;
  onKeyPress?: (event: TextInputKeyPressEvent) => void;
  onSelectionChange?: (event: TextInputSelectionChangeEvent) => void;
  placeholder?: string;
  placeholderTextColor?: ColorValue;
  /** Default true. When false the input can't be focused or edited. */
  editable?: boolean;
  readOnly?: boolean;
  /** Maximum length in UTF-16 code units, like React Native. */
  maxLength?: number;
  /** Shows `•` for each character. */
  secureTextEntry?: boolean;
  /** Enter inserts a newline (unless `submitBehavior` says otherwise); ↑/↓ move between lines. */
  multiline?: boolean;
  /** With `multiline`, the minimum height in lines. */
  numberOfLines?: number;
  /** Defaults: `blurAndSubmit` for single-line inputs, `newline` for multiline ones. */
  submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
  /** @deprecated Use `submitBehavior`. */
  blurOnSubmit?: boolean;
  autoFocus?: boolean;
  caretHidden?: boolean;
  /** Color of the cursor cell; inverse video when unset. */
  cursorColor?: ColorValue | null;
  /** Controlled cursor position (UTF-16 offsets; ranges collapse to `end`). */
  selection?: { start: number; end?: number };
  clearTextOnFocus?: boolean;
  /** Only `characters` has an effect (typed text is uppercased). */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: StyleProp<TextStyle>;
  /** @remarks Ignored in terminals. */
  selectionColor?: ColorValue;
  /** @remarks Ignored in terminals. */
  selectTextOnFocus?: boolean;
  /** @remarks Ignored in terminals. */
  keyboardType?: string;
  /** @remarks Ignored in terminals. */
  inputMode?: string;
  /** @remarks Ignored in terminals. */
  returnKeyType?: string;
  /** @remarks Ignored in terminals. */
  enterKeyHint?: string;
  /** @remarks Ignored in terminals. */
  autoCorrect?: boolean;
  /** @remarks Ignored in terminals. */
  autoComplete?: string;
  /** @remarks Ignored in terminals. */
  spellCheck?: boolean;
  /** @remarks Ignored in terminals. */
  textContentType?: string;
  /** @remarks Ignored in terminals. */
  keyboardAppearance?: 'default' | 'light' | 'dark';
  /** @remarks Ignored in terminals. */
  contextMenuHidden?: boolean;
  /** @remarks Ignored in terminals. */
  allowFontScaling?: boolean;
  ref?: Ref<TextInputInstance | null>;
}

const INPUT_BOX_DEFAULTS = { flexDirection: 'row', flexGrow: 0, flexShrink: 1 };

let eventCount = 0;
let focusedInput: TextInputInstance | null = null;

const numeric = (value: unknown) => (typeof value === 'number' ? value : 0);

function keyName(input: string, key: Key): string | undefined {
  if (key.return) return 'Enter';
  if (key.backspace) return 'Backspace';
  if (key.delete) return 'Delete';
  if (key.leftArrow) return 'ArrowLeft';
  if (key.rightArrow) return 'ArrowRight';
  if (key.upArrow) return 'ArrowUp';
  if (key.downArrow) return 'ArrowDown';
  if (key.home) return 'Home';
  if (key.end) return 'End';
  if (input.length === 1 && !key.ctrl && !key.meta) return input;
  return undefined;
}

/** Yoga's Edge.Left. */
const EDGE_LEFT = 0;

/**
 * A text field. Typing, pasting, ←/→, Home/End (Ctrl+A/E), Backspace/Delete, Ctrl+U/K/W and,
 * when multiline, ↑/↓ are supported. Tab moves focus away; Esc blurs. With the mouse on, a click
 * focuses it, with the cursor on the clicked character of a single-line input.
 */
export function TextInput(props: TextInputProps) {
  const {
    value: controlledValue,
    defaultValue,
    onChangeText,
    onChange,
    onSubmitEditing,
    onEndEditing,
    onFocus,
    onBlur,
    onKeyPress,
    onSelectionChange,
    placeholder,
    placeholderTextColor,
    editable,
    readOnly,
    maxLength,
    secureTextEntry,
    multiline = false,
    numberOfLines,
    submitBehavior,
    blurOnSubmit,
    autoFocus,
    caretHidden,
    cursorColor,
    selection,
    clearTextOnFocus,
    autoCapitalize,
    style,
    onLayout,
    ref,
  } = props;
  const canEdit = editable !== false && !readOnly;
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const value = controlledValue ?? internalValue;
  const parts = useMemo(() => graphemes(value), [value]);
  const [cursorState, setCursorState] = useState(() => parts.length);
  const cursor = Math.min(cursorState, parts.length);

  const valueRef = useRef(value);
  valueRef.current = value;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const boxRef = useRef<DOMElement>(null);
  const parentDirection = useContext(FlexDirectionContext);
  const inheritedBackground = useContext(BackgroundColorContext);
  const instanceRef = useRef<TextInputInstance | null>(null);
  const scrollRef = useRef(0);
  /** What a single-line input shows, for placing the cursor where it's clicked. */
  const visibleRef = useRef<{ start: number; widths: number[] }>({ start: 0, widths: [] });

  const textEvent = (type: string) =>
    createSyntheticEvent(type, { text: valueRef.current, target: 0 }, instanceRef.current);

  const commit = (next: EditState) => {
    if (next.value !== valueRef.current) {
      valueRef.current = next.value;
      if (controlledValue === undefined) setInternalValue(next.value);
      onChange?.(
        createSyntheticEvent(
          'change',
          { text: next.value, eventCount: ++eventCount, target: 0 },
          instanceRef.current,
        ),
      );
      onChangeText?.(next.value);
    }
    if (next.cursor !== cursorRef.current) {
      cursorRef.current = next.cursor;
      setCursorState(next.cursor);
      const offset = cursorToOffset(next.value, next.cursor);
      onSelectionChange?.(
        createSyntheticEvent(
          'selectionChange',
          { selection: { start: offset, end: offset }, target: 0 },
          instanceRef.current,
        ),
      );
    }
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const focusable = useFocusable({
    enabled: canEdit,
    autoFocus,
    nodeRef: boxRef,
    onFocus: () => {
      focusedInput = instanceRef.current;
      if (clearTextOnFocus) commitRef.current({ value: '', cursor: 0 });
      onFocus?.(textEvent('focus'));
    },
    onBlur: () => {
      if (focusedInput === instanceRef.current) focusedInput = null;
      onBlur?.(textEvent('blur'));
      onEndEditing?.(textEvent('endEditing'));
    },
  });
  const focusableRef = useRef(focusable);
  focusableRef.current = focusable;

  const selectionStart = selection?.start;
  const selectionEnd = selection?.end;
  useEffect(() => {
    if (selectionStart === undefined) return;
    const next = offsetToCursor(valueRef.current, selectionEnd ?? selectionStart);
    cursorRef.current = next;
    setCursorState(next);
  }, [selectionStart, selectionEnd]);

  const behavior =
    submitBehavior ??
    (blurOnSubmit !== undefined
      ? blurOnSubmit
        ? 'blurAndSubmit'
        : multiline
          ? 'newline'
          : 'submit'
      : multiline
        ? 'newline'
        : 'blurAndSubmit');

  const typed = (text: string) => {
    let clean = sanitize(text, multiline);
    if (autoCapitalize === 'characters') clean = clean.toUpperCase();
    if (clean)
      commit(insert({ value: valueRef.current, cursor: cursorRef.current }, clean, maxLength));
  };

  const active = focusable.receivesInput && canEdit;
  useInput(
    (input, key) => {
      const state: EditState = { value: valueRef.current, cursor: cursorRef.current };
      const name = keyName(input, key);
      if (name) onKeyPress?.(createSyntheticEvent('keyPress', { key: name }, instanceRef.current));
      if (key.tab || key.escape) return;
      if (key.return) {
        if (multiline && behavior === 'newline') {
          commit(insert(state, '\n', maxLength));
          return;
        }
        onSubmitEditing?.(textEvent('submitEditing'));
        if (behavior === 'blurAndSubmit') focusable.blur();
        return;
      }
      if (key.backspace)
        return commit(key.meta || key.ctrl ? deleteWordBackward(state) : backspace(state));
      if (key.delete) return commit(deleteForward(state));
      if (key.leftArrow)
        return commit(key.ctrl || key.meta ? moveWordLeft(state) : moveLeft(state));
      if (key.rightArrow)
        return commit(key.ctrl || key.meta ? moveWordRight(state) : moveRight(state));
      if (key.upArrow) return multiline ? commit(moveUp(state)) : undefined;
      if (key.downArrow) return multiline ? commit(moveDown(state)) : undefined;
      if (key.home || (key.ctrl && input === 'a')) return commit(moveHome(state));
      if (key.end || (key.ctrl && input === 'e')) return commit(moveEnd(state));
      if (key.ctrl && input === 'u') return commit(deleteToLineStart(state));
      if (key.ctrl && input === 'k') return commit(deleteToLineEnd(state));
      if (key.ctrl && input === 'w') return commit(deleteWordBackward(state));
      if (key.ctrl || key.meta || key.pageUp || key.pageDown) return;
      if (input) typed(input);
    },
    { isActive: active },
  );
  usePaste(typed, { isActive: active });

  // The instance exists whether or not a ref asks for it: TextInput.State reports it, and React
  // only builds a ref's handle when there is a ref.
  useLayoutEffect(() => {
    const node = boxRef.current;
    if (!node || instanceRef.current) return;
    instanceRef.current = Object.assign(
      attachNativeMethods(node, {
        focus: () => focusableRef.current.focus(),
        blur: () => focusableRef.current.blur(),
      }),
      {
        clear: () => commitRef.current({ value: '', cursor: 0 }),
        isFocused: () => focusableRef.current.isFocused,
        setSelection: (start: number, end: number) => {
          const next = offsetToCursor(valueRef.current, end ?? start);
          cursorRef.current = next;
          setCursorState(next);
        },
        getNativeRef: () => instanceRef.current,
      },
    ) as TextInputInstance;
  }, []);
  // An input removed while focused gets no blur: it mustn't stay "the focused input".
  useLayoutEffect(
    () => () => {
      if (focusedInput && focusedInput === instanceRef.current) focusedInput = null;
    },
    [],
  );
  useImperativeHandle(ref, () => instanceRef.current ?? (null as unknown as TextInputInstance), []);

  // Styles: text props go to the text, layout props to the surrounding box.
  const { text: textStyle, layout } = splitTextStyle(flattenStyle(style));
  const resolved = resolveTextStyle(textStyle, 'TextInput', inheritedBackground);
  const view = resolveViewStyle(layout, {
    component: 'TextInput',
    defaults: INPUT_BOX_DEFAULTS,
    cellSize: getCellSize(),
    parentDirection,
    // The box's background is the text's own: borders are drawn over it.
    background: resolved.backgroundColor ?? inheritedBackground,
  });
  let box = { ...view.box, ...resolveAccessibility({ accessibilityRole: 'textbox', ...props }) };
  if (resolved.backgroundColor) box.backgroundColor = resolved.backgroundColor;
  box = withBorderBackground(box, inheritedBackground);
  if (multiline && numberOfLines) {
    box.minHeight =
      numberOfLines +
      numeric(box.paddingTop) +
      numeric(box.paddingBottom) +
      (box.borderTop ? 1 : 0) +
      (box.borderBottom ? 1 : 0);
  }
  const metrics = useBoxMetrics(boxRef);
  const available = metrics.hasMeasured
    ? Math.max(1, metrics.clientWidth - numeric(box.paddingLeft) - numeric(box.paddingRight))
    : undefined;

  const shown = secureTextEntry ? parts.map((part) => (part === '\n' ? part : '•')) : parts;
  const showCursor = focusable.isFocused && !caretHidden && canEdit;
  // Over the input's own background (translucent colors are mixed with it).
  const inputBackground = (box.backgroundColor as string | undefined) ?? inheritedBackground;
  const opaque = (value: typeof cursorColor) => {
    const resolved = value ? resolveColor(value) : undefined;
    return resolved ? blendColor(resolved, inputBackground) : undefined;
  };
  const cursorColorValue = opaque(cursorColor);
  const cursorProps = cursorColorValue ? { backgroundColor: cursorColorValue } : { inverse: true };
  const placeholderColor = opaque(placeholderTextColor);
  const placeholderProps = placeholderColor ? { color: placeholderColor } : { dimColor: true };

  // Single-line inputs scroll horizontally to keep the cursor visible.
  let start = 0;
  let end = shown.length;
  const widths = multiline ? [] : shown.map((part) => stringWidth(part));
  if (!multiline && available !== undefined) {
    start = Math.min(scrollRef.current, cursor);
    let used =
      widths.slice(start, cursor).reduce((sum, width) => sum + width, 0) + (widths[cursor] ?? 1);
    while (used > available && start < cursor) {
      used -= widths[start] ?? 0;
      start++;
    }
    end = Math.min(shown.length, cursor + 1);
    while (end < shown.length && used + (widths[end] ?? 0) <= available) {
      used += widths[end] ?? 0;
      end++;
    }
    scrollRef.current = start;
  }
  visibleRef.current = { start, widths };

  // A click focuses the input and, on a single line, puts the cursor on the clicked character.
  usePointerTarget(
    boxRef,
    canEdit
      ? {
          pressIn(at) {
            const yoga = boxRef.current?.yogaNode;
            if (!multiline && yoga) {
              const { start: first, widths: shownWidths } = visibleRef.current;
              const column =
                at.cellX - yoga.getComputedBorder(EDGE_LEFT) - yoga.getComputedPadding(EDGE_LEFT);
              let index = first;
              let used = 0;
              while (index < shownWidths.length && used + shownWidths[index]! <= column) {
                used += shownWidths[index]!;
                index++;
              }
              commitRef.current({ value: valueRef.current, cursor: index });
            }
            focusableRef.current.focus();
          },
          pressOut() {},
        }
      : null,
  );

  let content: ReactNode;
  if (shown.length === 0) {
    const placeholderParts = graphemes(placeholder ?? '');
    content = showCursor ? (
      <>
        <InkText {...placeholderProps} {...cursorProps}>
          {placeholderParts[0] ?? ' '}
        </InkText>
        <InkText {...placeholderProps}>{placeholderParts.slice(1).join('')}</InkText>
      </>
    ) : placeholder ? (
      <InkText {...placeholderProps}>{placeholder}</InkText>
    ) : (
      ''
    );
  } else if (showCursor) {
    const at = shown[cursor];
    content = (
      <>
        {shown.slice(start, cursor).join('')}
        <InkText {...cursorProps}>{at === undefined || at === '\n' ? ' ' : at}</InkText>
        {at === '\n' ? '\n' : ''}
        {shown.slice(cursor + 1, end).join('')}
      </>
    );
  } else {
    content = shown.slice(start, end).join('');
  }

  return (
    <Box ref={boxRef} {...box}>
      <InkText
        {...resolved.ink}
        dimColor={resolved.dim || undefined}
        wrap={multiline ? 'wrap' : 'truncate-end'}
      >
        {content}
      </InkText>
      {onLayout ? <LayoutObserver target={boxRef} onLayout={onLayout} /> : null}
    </Box>
  );
}

/** React Native's `TextInput.State`: tracks the focused input. */
TextInput.State = {
  currentlyFocusedInput: (): TextInputInstance | null => focusedInput,
  currentlyFocusedField: (): null => null,
  focusTextInput: (input?: TextInputInstance | null): void => input?.focus(),
  blurTextInput: (input?: TextInputInstance | null): void => input?.blur(),
};
