/**
 * Pure text-editing operations for TextInput. The cursor is an index into the value's
 * grapheme clusters, so emoji and combining characters move and delete as one unit.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export const graphemes = (text: string): string[] =>
  Array.from(segmenter.segment(text), (segment) => segment.segment);

export interface EditState {
  value: string;
  /** Grapheme index (0 = before the first character). */
  cursor: number;
}

const make = (parts: string[], cursor: number): EditState => ({
  value: parts.join(''),
  cursor: Math.max(0, Math.min(cursor, parts.length)),
});

/** Converts a UTF-16 offset (React Native's `selection`) to a grapheme index. */
export function offsetToCursor(value: string, offset: number): number {
  let consumed = 0;
  const parts = graphemes(value);
  for (let index = 0; index < parts.length; index++) {
    if (consumed >= offset) return index;
    consumed += parts[index]!.length;
  }
  return parts.length;
}

/** Converts a grapheme index to a UTF-16 offset. */
export const cursorToOffset = (value: string, cursor: number): number =>
  graphemes(value).slice(0, cursor).join('').length;

/** Inserts text at the cursor, truncated so the value stays within `maxLength` (UTF-16 units, like React Native). */
export function insert(state: EditState, text: string, maxLength?: number): EditState {
  const parts = graphemes(state.value);
  let inserted = graphemes(text);
  if (maxLength !== undefined && maxLength >= 0) {
    let room = maxLength - state.value.length;
    const allowed: string[] = [];
    for (const part of inserted) {
      if (part.length > room) break;
      allowed.push(part);
      room -= part.length;
    }
    inserted = allowed;
  }
  if (inserted.length === 0) return state;
  parts.splice(state.cursor, 0, ...inserted);
  return make(parts, state.cursor + inserted.length);
}

export function backspace(state: EditState): EditState {
  if (state.cursor === 0) return state;
  const parts = graphemes(state.value);
  parts.splice(state.cursor - 1, 1);
  return make(parts, state.cursor - 1);
}

export function deleteForward(state: EditState): EditState {
  const parts = graphemes(state.value);
  if (state.cursor >= parts.length) return state;
  parts.splice(state.cursor, 1);
  return make(parts, state.cursor);
}

export const moveLeft = (state: EditState): EditState => ({
  ...state,
  cursor: Math.max(0, state.cursor - 1),
});

export const moveRight = (state: EditState): EditState => ({
  ...state,
  cursor: Math.min(graphemes(state.value).length, state.cursor + 1),
});

const lineStart = (parts: string[], cursor: number) => {
  let index = cursor;
  while (index > 0 && parts[index - 1] !== '\n') index--;
  return index;
};

const lineEnd = (parts: string[], cursor: number) => {
  let index = cursor;
  while (index < parts.length && parts[index] !== '\n') index++;
  return index;
};

export const moveHome = (state: EditState): EditState => ({
  ...state,
  cursor: lineStart(graphemes(state.value), state.cursor),
});

export const moveEnd = (state: EditState): EditState => ({
  ...state,
  cursor: lineEnd(graphemes(state.value), state.cursor),
});

export function moveUp(state: EditState): EditState {
  const parts = graphemes(state.value);
  const start = lineStart(parts, state.cursor);
  if (start === 0) return { ...state, cursor: 0 };
  const column = state.cursor - start;
  const previousStart = lineStart(parts, start - 1);
  return { ...state, cursor: Math.min(previousStart + column, start - 1) };
}

export function moveDown(state: EditState): EditState {
  const parts = graphemes(state.value);
  const end = lineEnd(parts, state.cursor);
  if (end >= parts.length) return { ...state, cursor: parts.length };
  const column = state.cursor - lineStart(parts, state.cursor);
  const nextEnd = lineEnd(parts, end + 1);
  return { ...state, cursor: Math.min(end + 1 + column, nextEnd) };
}

const isSpace = (part: string | undefined) => part !== undefined && /^\s+$/u.test(part);

export function moveWordLeft(state: EditState): EditState {
  const parts = graphemes(state.value);
  let index = state.cursor;
  while (index > 0 && isSpace(parts[index - 1])) index--;
  while (index > 0 && !isSpace(parts[index - 1])) index--;
  return { ...state, cursor: index };
}

export function moveWordRight(state: EditState): EditState {
  const parts = graphemes(state.value);
  let index = state.cursor;
  while (index < parts.length && isSpace(parts[index])) index++;
  while (index < parts.length && !isSpace(parts[index])) index++;
  return { ...state, cursor: index };
}

export function deleteWordBackward(state: EditState): EditState {
  const target = moveWordLeft(state).cursor;
  const parts = graphemes(state.value);
  parts.splice(target, state.cursor - target);
  return make(parts, target);
}

export function deleteToLineStart(state: EditState): EditState {
  const parts = graphemes(state.value);
  const start = lineStart(parts, state.cursor);
  parts.splice(start, state.cursor - start);
  return make(parts, start);
}

export function deleteToLineEnd(state: EditState): EditState {
  const parts = graphemes(state.value);
  const end = lineEnd(parts, state.cursor);
  parts.splice(state.cursor, end - state.cursor);
  return make(parts, state.cursor);
}

/** Normalizes typed or pasted text: newlines become spaces in single-line inputs; control characters are dropped. */
export function sanitize(text: string, multiline: boolean): string {
  const normalized = text.replace(/\r\n?/g, '\n');
  const withNewlines = multiline ? normalized : normalized.replace(/\n/g, ' ');
  return withNewlines.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\t/g, '  ');
}
