import chalk from 'chalk';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import {
  backspace,
  cursorToOffset,
  deleteToLineEnd,
  deleteToLineStart,
  deleteWordBackward,
  graphemes,
  insert,
  moveDown,
  moveUp,
  moveWordLeft,
  offsetToCursor,
  sanitize,
} from '../src/components/TextInput/editing.js';
import { TextInput, type TextInputInstance } from '../src/components/TextInput/index.js';
import { Text } from '../src/components/Text/index.js';
import { View } from '../src/components/View/index.js';
import { keys, press, renderInteractive, tick } from './helpers.js';

afterEach(() => {
  cleanup();
});

describe('editing operations', () => {
  it('treats grapheme clusters as single characters', () => {
    expect(graphemes('a👍🏽é')).toEqual(['a', '👍🏽', 'é']);
    expect(backspace({ value: 'a👍🏽', cursor: 2 })).toEqual({ value: 'a', cursor: 1 });
  });

  it('inserts at the cursor and respects maxLength', () => {
    expect(insert({ value: 'ac', cursor: 1 }, 'b')).toEqual({ value: 'abc', cursor: 2 });
    expect(insert({ value: 'abc', cursor: 3 }, 'defg', 5)).toEqual({ value: 'abcde', cursor: 5 });
    expect(insert({ value: 'abc', cursor: 3 }, 'x', 3)).toEqual({ value: 'abc', cursor: 3 });
  });

  it('moves between lines keeping the column', () => {
    const text = 'abcd\nef\nghij';
    expect(moveUp({ value: text, cursor: 10 })).toEqual({ value: text, cursor: 7 });
    expect(moveDown({ value: text, cursor: 3 })).toEqual({ value: text, cursor: 7 });
    expect(moveUp({ value: text, cursor: 2 })).toEqual({ value: text, cursor: 0 });
  });

  it('deletes words and to line boundaries', () => {
    expect(deleteWordBackward({ value: 'hello big world', cursor: 15 })).toEqual({ value: 'hello big ', cursor: 10 });
    expect(moveWordLeft({ value: 'hello big world', cursor: 10 }).cursor).toBe(6);
    expect(deleteToLineStart({ value: 'one\ntwo three', cursor: 8 })).toEqual({ value: 'one\nthree', cursor: 4 });
    expect(deleteToLineEnd({ value: 'one two\nx', cursor: 3 })).toEqual({ value: 'one\nx', cursor: 3 });
  });

  it('converts between offsets and cursors', () => {
    expect(offsetToCursor('a👍🏽b', 5)).toBe(2);
    expect(cursorToOffset('a👍🏽b', 2)).toBe(5);
  });

  it('sanitizes typed text', () => {
    expect(sanitize('a\r\nb\u0007c', false)).toBe('a bc');
    expect(sanitize('a\r\nb', true)).toBe('a\nb');
  });
});

describe('TextInput', () => {
  it('is uncontrolled with defaultValue and edits at the cursor', async () => {
    const onChangeText = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <TextInput defaultValue="ac" autoFocus onChangeText={onChangeText} />,
    );
    await tick();
    await press(stdin, keys.left, 'b');
    expect(lastFrame()).toBe('abc');
    expect(onChangeText).toHaveBeenLastCalledWith('abc');
    await press(stdin, keys.end, keys.backspace, keys.home, keys.delete);
    expect(lastFrame()).toBe('b');
  });

  it('works as a controlled input', async () => {
    function Controlled() {
      const [text, setText] = useState('');
      return (
        <View>
          <TextInput autoFocus value={text} onChangeText={(next) => setText(next.toUpperCase())} />
          <Text>value={text}</Text>
        </View>
      );
    }
    const { stdin, lastFrame } = renderInteractive(<Controlled />);
    await tick();
    await press(stdin, 'hi');
    expect(lastFrame()).toBe('HI\nvalue=HI');
  });

  it('submits on Enter and blurs by default', async () => {
    const onSubmitEditing = vi.fn();
    const onBlur = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <TextInput autoFocus onSubmitEditing={(event) => onSubmitEditing(event.nativeEvent.text)} onBlur={onBlur} />,
    );
    await tick();
    await press(stdin, 'done', keys.enter);
    expect(onSubmitEditing).toHaveBeenCalledWith('done');
    expect(onBlur).toHaveBeenCalledOnce();
    await press(stdin, 'x');
    expect(lastFrame()).toBe('done');
  });

  it("keeps focus with submitBehavior='submit'", async () => {
    const onSubmitEditing = vi.fn();
    const { stdin, lastFrame } = renderInteractive(
      <TextInput autoFocus submitBehavior="submit" onSubmitEditing={onSubmitEditing} />,
    );
    await tick();
    await press(stdin, 'a', keys.enter, 'b');
    expect(onSubmitEditing).toHaveBeenCalledOnce();
    expect(lastFrame()).toBe('ab');
  });

  it('inserts newlines when multiline', async () => {
    const { stdin, lastFrame } = renderInteractive(<TextInput autoFocus multiline />);
    await tick();
    await press(stdin, 'one', keys.enter, 'two', keys.up, 'X');
    expect(lastFrame()).toBe('oneX\ntwo');
  });

  it('masks secure entry and shows placeholders', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <View>
        <TextInput placeholder="Password" secureTextEntry />
      </View>,
    );
    await tick();
    expect(lastFrame()).toBe('Password');
    await press(stdin, keys.tab, 'secret');
    expect(lastFrame()).toBe('••••••');
  });

  it('limits length and reports key presses', async () => {
    const pressed: string[] = [];
    const { stdin, lastFrame } = renderInteractive(
      <TextInput autoFocus maxLength={3} onKeyPress={(event) => pressed.push(event.nativeEvent.key)} />,
    );
    await tick();
    await press(stdin, 'a', 'b', 'c', 'd', keys.backspace);
    expect(lastFrame()).toBe('ab');
    expect(pressed).toEqual(['a', 'b', 'c', 'd', 'Backspace']);
  });

  it('supports Ctrl+W, Ctrl+U and bracketed paste', async () => {
    const { stdin, lastFrame } = renderInteractive(<TextInput autoFocus />);
    await tick();
    await press(stdin, 'hello world', keys.ctrlW);
    expect(lastFrame()).toBe('hello');
    await press(stdin, keys.ctrlU, '\u001B[200~pasted\ntext\u001B[201~');
    expect(lastFrame()).toBe('pasted text');
  });

  it('moves focus between inputs with Tab', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <View>
        <TextInput placeholder="first" />
        <TextInput placeholder="second" />
      </View>,
    );
    await tick();
    await press(stdin, keys.tab, 'a', keys.tab, 'b');
    expect(lastFrame()).toBe('a\nb');
  });

  it('scrolls single-line inputs to keep the cursor visible', async () => {
    const { stdin, lastFrame } = renderInteractive(
      <View style={{ width: 10 }}>
        <TextInput autoFocus />
      </View>,
    );
    await tick();
    await press(stdin, 'abcdefghijklmnop');
    await tick();
    expect(lastFrame()).toBe('hijklmnop');
    await press(stdin, keys.home);
    await tick();
    expect(lastFrame()).toBe('abcdefghij');
  });

  it('draws the cursor in inverse video', async () => {
    const previous = chalk.level;
    chalk.level = 3;
    try {
      const { stdin, lastFrame } = renderInteractive(<TextInput autoFocus defaultValue="ab" />);
      await tick();
      await press(stdin, keys.left);
      expect(lastFrame()).toContain('a\u001b[7mb\u001b[27m');
    } finally {
      chalk.level = previous;
    }
  });

  it('exposes focus, blur, clear and isFocused on its ref', async () => {
    const handle: { current: TextInputInstance | null } = { current: null };
    const { lastFrame } = renderInteractive(<TextInput ref={handle} defaultValue="text" />);
    await tick();
    const input = handle.current!;
    expect(input.isFocused()).toBe(false);
    input.focus();
    await tick();
    expect(input.isFocused()).toBe(true);
    expect(TextInput.State.currentlyFocusedInput()).toBe(input);
    input.clear();
    await tick();
    expect(lastFrame()).toBe('');
    input.blur();
    await tick();
    expect(input.isFocused()).toBe(false);
  });
});
