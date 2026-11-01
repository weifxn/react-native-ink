import { describe, expect, it, vi } from 'vitest';
import { Text } from '../src/components/Text/index.js';
import { View } from '../src/components/View/index.js';
import { lines, renderColored, renderText } from './helpers.js';

describe('View layout', () => {
  it('stacks children in a column by default', () => {
    expect(
      renderText(
        <View>
          <Text>one</Text>
          <Text>two</Text>
        </View>,
      ),
    ).toBe(lines('one', 'two'));
  });

  it('draws borders with padding and wraps text inside', () => {
    expect(
      renderText(
        <View style={{ padding: 1, borderWidth: 1, borderRadius: 4, width: 30 }}>
          <Text style={{ fontWeight: 'bold' }}>
            3 passed, <Text>1 failed</Text>
          </Text>
          <Text>Some text that has to wrap here.</Text>
        </View>,
      ),
    ).toBe(
      lines(
        '╭────────────────────────────╮',
        '│                            │',
        '│ 3 passed, 1 failed         │',
        '│ Some text that has to wrap │',
        '│  here.                     │',
        '│                            │',
        '╰────────────────────────────╯',
      ),
    );
  });

  it('lays out rows with justifyContent and partial borders', () => {
    expect(
      renderText(
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: 20,
            borderBottomWidth: 1,
          }}
        >
          <Text>left</Text>
          <Text>right</Text>
        </View>,
      ),
    ).toBe(lines('left           right', '────────────────────'));
  });

  it('splits space with flex', () => {
    expect(
      renderText(
        <View style={{ flexDirection: 'row', width: 30 }}>
          <View style={{ flex: 1 }}>
            <Text>a</Text>
          </View>
          <View style={{ flex: 2, borderLeftWidth: 1 }}>
            <Text>b</Text>
          </View>
        </View>,
      ),
    ).toBe('a         │b');
  });

  it("centers with margin: 'auto' and shifts with translate", () => {
    expect(
      renderText(
        <View style={{ width: 30 }}>
          <View style={{ marginLeft: 'auto', marginRight: 'auto' }}>
            <Text>centered</Text>
          </View>
          <View style={{ transform: [{ translateX: 4 }] }}>
            <Text>shifted</Text>
          </View>
        </View>,
      ),
    ).toBe(lines('           centered', '    shifted'));
  });

  it('positions absolutely', () => {
    expect(
      renderText(
        <View style={{ width: 20, height: 3, borderWidth: 1 }}>
          <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
            <Text>BR</Text>
          </View>
          <Text>TL</Text>
        </View>,
      ),
    ).toBe(lines('┌──────────────────┐', '│TL              BR│', '└──────────────────┘'));
  });

  it('hides with display none', () => {
    expect(
      renderText(
        <View>
          <Text>a</Text>
          <View style={{ display: 'none' }}>
            <Text>gone</Text>
          </View>
          <Text>b</Text>
        </View>,
      ),
    ).toBe(lines('a', 'b'));
  });

  it('keeps the space of opacity: 0 content', () => {
    expect(
      renderText(
        <View style={{ flexDirection: 'row' }}>
          <View style={{ opacity: 0, borderWidth: 1 }}>
            <Text>hidden</Text>
          </View>
          <Text>|visible</Text>
        </View>,
      ),
    ).toBe(lines('        |visible', '', ''));
  });

  it('renders a View nested in Text inline, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      renderText(
        <Text>
          before{' '}
          <View>
            <Text>inside</Text>
          </View>{' '}
          after
        </Text>,
      ),
    ).toBe('before inside after');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('rejects bare strings in a View, like React Native', () => {
    expect(() => renderText(<View>{'bare'}</View>)).toThrow(/must be rendered inside <Text>/);
  });
});

describe('Text', () => {
  it('truncates with numberOfLines and ellipsizeMode', () => {
    expect(
      renderText(
        <View style={{ width: 16 }}>
          <Text numberOfLines={1}>tail the quick brown fox</Text>
          <Text numberOfLines={1} ellipsizeMode="head">
            head the quick brown fox
          </Text>
          <Text numberOfLines={1} ellipsizeMode="middle">
            middle the quick brown fox
          </Text>
          <Text numberOfLines={1} ellipsizeMode="clip">
            clip the quick brown fox
          </Text>
          <Text numberOfLines={2}>two lines of the quick brown fox jumps over</Text>
          <Text>after</Text>
        </View>,
      ),
    ).toBe(
      lines(
        'tail the quick …',
        '…quick brown fox',
        'middle t…own fox',
        'clip the quick b',
        'two lines of the',
        ' quick brown fox',
        'after',
      ),
    );
  });

  it('aligns text within its box', () => {
    expect(
      renderText(
        <View style={{ width: 20, borderWidth: 1 }}>
          <Text style={{ textAlign: 'center' }}>centered text that wraps around</Text>
          <Text style={{ textAlign: 'right' }}>right</Text>
        </View>,
      ),
    ).toBe(
      lines(
        '┌──────────────────┐',
        '│centered text that│',
        '│   wraps around   │',
        '│             right│',
        '└──────────────────┘',
      ),
    );
  });

  it('applies textTransform to nested text', () => {
    expect(
      renderText(
        <Text style={{ textTransform: 'uppercase' }}>
          hello <Text style={{ fontWeight: 'bold' }}>nested</Text> world
        </Text>,
      ),
    ).toBe('HELLO NESTED WORLD');
    expect(renderText(<Text style={{ textTransform: 'capitalize' }}>react native ink</Text>)).toBe(
      'React Native Ink',
    );
  });

  it('gives a top-level Text with layout styles its own box', () => {
    expect(renderText(<Text style={{ padding: 1, borderWidth: 1 }}>Padded</Text>, 24)).toBe(
      lines(
        '┌──────────────────────┐',
        '│                      │',
        '│ Padded               │',
        '│                      │',
        '└──────────────────────┘',
      ),
    );
  });

  it('renders numbers and joins nested text', () => {
    expect(
      renderText(
        <Text>
          {3} of {4} <Text>done</Text>
        </Text>,
      ),
    ).toBe('3 of 4 done');
  });
});

describe('Text styling (ANSI)', () => {
  it('nests colors and restores the parent color', () => {
    expect(
      renderColored(
        <Text style={{ color: 'green', fontWeight: 'bold' }}>
          a <Text style={{ color: 'red' }}>b</Text> c
        </Text>,
      ),
    ).toBe('\u001b[1m\u001b[32ma \u001b[31mb\u001b[32m c\u001b[39m\u001b[22m');
  });

  it('fills the box width with a top-level Text background, like React Native', () => {
    expect(
      renderColored(
        <View style={{ width: 8 }}>
          <Text style={{ backgroundColor: 'blue' }}>hi</Text>
        </View>,
      ),
    ).toBe('\u001b[44mhi      \u001b[49m');
  });

  it('colors only the glyphs of nested Text backgrounds', () => {
    expect(
      renderColored(
        <Text>
          x <Text style={{ backgroundColor: 'blue' }}>hi</Text>
        </Text>,
      ),
    ).toBe('x \u001b[44mhi\u001b[49m');
  });

  it('dims text for opacity and light weights', () => {
    expect(
      renderColored(
        <View style={{ opacity: 0.5 }}>
          <Text>dim</Text>
        </View>,
      ),
    ).toBe('\u001b[2mdim\u001b[22m');
    expect(renderColored(<Text style={{ fontWeight: '300' }}>light</Text>)).toBe(
      '\u001b[2mlight\u001b[22m',
    );
  });

  it('uses truecolor for CSS colors and the palette for ANSI names', () => {
    expect(renderColored(<Text style={{ color: 'orange' }}>o</Text>)).toBe(
      '\u001b[38;2;255;165;0mo\u001b[39m',
    );
    expect(renderColored(<Text style={{ color: 'red' }}>r</Text>)).toBe('\u001b[31mr\u001b[39m');
  });

  it('underlines and strikes through', () => {
    expect(
      renderColored(<Text style={{ textDecorationLine: 'underline line-through' }}>x</Text>),
    ).toBe('\u001b[9m\u001b[4mx\u001b[24m\u001b[29m');
  });
});
