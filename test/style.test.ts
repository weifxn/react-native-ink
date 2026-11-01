import { describe, expect, it, vi } from 'vitest';
import { resolveBorders, NAMED_BOX_STYLES } from '../src/style/borders.js';
import { createPlatformColor, processColor, resolveColor } from '../src/style/colors.js';
import { flattenStyle } from '../src/style/flatten.js';
import { STYLE_SUPPORT } from '../src/style/support.js';
import {
  applyTextTransform,
  resolveFontWeight,
  resolveTextStyle,
  splitTextStyle,
} from '../src/style/text.js';
import { resolveViewStyle } from '../src/style/view.js';
import type { ViewStyle } from '../src/style/types.js';

const view = (style: ViewStyle | undefined) =>
  resolveViewStyle(style, { component: 'View', unicode: true });

const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('flattenStyle', () => {
  it('returns undefined for falsy styles', () => {
    for (const value of [undefined, null, false, ''] as const) {
      expect(flattenStyle(value)).toBeUndefined();
    }
  });

  it('returns a plain object unchanged', () => {
    const style = { width: 1 };
    expect(flattenStyle(style)).toBe(style);
  });

  it('merges nested arrays left to right, skipping falsy entries', () => {
    expect(
      flattenStyle<ViewStyle>([{ width: 1, height: 2 }, false, [null, { width: 3 }, [{ margin: 4 }]]]),
    ).toEqual({ width: 3, height: 2, margin: 4 });
  });

  it('warns about numeric style handles', () => {
    const warn = spyWarn();
    expect(flattenStyle(12 as never)).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('resolveColor', () => {
  it.each([
    ['red', { color: 'red', alpha: 1 }],
    ['gray', { color: 'gray', alpha: 1 }],
    ['orange', { color: '#ffa500', alpha: 1 }],
    ['#0af', { color: '#00aaff', alpha: 1 }],
    ['#00aaff', { color: '#00aaff', alpha: 1 }],
    ['rgb(255, 0, 0)', { color: '#ff0000', alpha: 1 }],
    ['hsl(120, 100%, 50%)', { color: '#00ff00', alpha: 1 }],
    ['transparent', { color: undefined, alpha: 0 }],
    [0x336699ff, { color: '#336699', alpha: 1 }],
  ])('%s', (input, expected) => {
    expect(resolveColor(input)).toEqual(expected);
  });

  it('keeps the alpha channel', () => {
    expect(resolveColor('rgba(255, 0, 0, 0.5)')).toEqual({ color: '#ff0000', alpha: 128 / 255 });
  });

  it('returns undefined when unset and null when invalid', () => {
    expect(resolveColor(undefined)).toBeUndefined();
    expect(resolveColor(null)).toBeUndefined();
    expect(resolveColor('not-a-color')).toBeNull();
  });

  it('resolves PlatformColor to terminal palette names', () => {
    expect(resolveColor(createPlatformColor(['redBright']))).toEqual({ color: 'redBright', alpha: 1 });
    expect(resolveColor(createPlatformColor(['ansi256(208)']))).toEqual({
      color: 'ansi256(208)',
      alpha: 1,
    });
    expect(resolveColor(createPlatformColor(['systemBlue', 'blue']))).toEqual({ color: 'blue', alpha: 1 });
    expect(resolveColor(createPlatformColor(['systemBlue']))).toBeNull();
  });
});

describe('processColor', () => {
  it('returns 0xAARRGGBB integers like React Native', () => {
    expect(processColor('red')).toBe(0xffff0000);
    expect(processColor('#00ff0080')).toBe(0x8000ff00);
  });

  it('passes through unset values and platform colors', () => {
    const platform = createPlatformColor(['red']);
    expect(processColor(undefined)).toBeUndefined();
    expect(processColor(null)).toBeNull();
    expect(processColor(platform)).toBe(platform);
    expect(processColor('nope')).toBeNull();
  });
});

describe('resolveViewStyle', () => {
  it('applies React Native defaults', () => {
    expect(view(undefined).box).toEqual({ flexDirection: 'column', flexGrow: 0, flexShrink: 0 });
  });

  it.each([
    [{ flex: 1 }, { flexGrow: 1, flexShrink: 0, flexBasis: 0 }],
    [{ flex: 2 }, { flexGrow: 2, flexShrink: 0, flexBasis: 0 }],
    [{ flex: 0 }, { flexGrow: 0, flexShrink: 0 }],
    [{ flex: -1 }, { flexGrow: 0, flexShrink: 1 }],
    [{ flex: 1, flexShrink: 1 }, { flexGrow: 1, flexShrink: 1, flexBasis: 0 }],
    [{ flex: 1, flexBasis: 5 }, { flexGrow: 1, flexShrink: 0, flexBasis: 5 }],
  ] as Array<[ViewStyle, Record<string, unknown>]>)('expands flex %j', (style, expected) => {
    expect(view(style).box).toMatchObject(expected);
  });

  it('resolves margins with React Native precedence', () => {
    expect(view({ margin: 1, marginHorizontal: 2, marginLeft: 3, marginStart: 4 }).box).toMatchObject({
      marginTop: 1,
      marginBottom: 1,
      marginLeft: 4,
      marginRight: 2,
    });
    expect(view({ marginVertical: 2, marginBottom: 5 }).box).toMatchObject({
      marginTop: 2,
      marginBottom: 5,
    });
  });

  it("supports percentage and 'auto' margins and percentage paddings", () => {
    expect(view({ marginLeft: 'auto', marginRight: '10%', paddingTop: '50%' }).box).toMatchObject({
      marginLeft: 'auto',
      marginRight: '10%',
      paddingTop: '50%',
    });
  });

  it("rejects 'auto' padding with a warning", () => {
    const warn = spyWarn();
    expect(view({ padding: 'auto' }).box).not.toHaveProperty('paddingTop');
    expect(warn).toHaveBeenCalled();
  });

  it('resolves insets, start and end', () => {
    expect(view({ position: 'absolute', inset: 1, top: 2, start: 3 }).box).toMatchObject({
      position: 'absolute',
      top: 2,
      bottom: 1,
      left: 3,
      right: 1,
    });
  });

  it('validates sizes', () => {
    const warn = spyWarn();
    expect(view({ width: '50%', height: 3 }).box).toMatchObject({ width: '50%', height: 3 });
    expect(view({ width: 'auto' }).box).not.toHaveProperty('width');
    expect(view({ width: 'wide' as never }).box).not.toHaveProperty('width');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('parses aspectRatio', () => {
    expect(view({ aspectRatio: '16/9' }).box.aspectRatio).toBeCloseTo(16 / 9);
    expect(view({ aspectRatio: '2' }).box.aspectRatio).toBe(2);
    expect(view({ aspectRatio: 1.5 }).box.aspectRatio).toBe(1.5);
    const warn = spyWarn();
    expect(view({ aspectRatio: 'x' }).box).not.toHaveProperty('aspectRatio');
    expect(warn).toHaveBeenCalled();
  });

  it('maps gaps, display and overflow', () => {
    expect(view({ gap: 2, rowGap: 1, display: 'none', overflow: 'scroll' }).box).toMatchObject({
      gap: 2,
      rowGap: 1,
      display: 'none',
      overflow: 'hidden',
    });
    const warn = spyWarn();
    expect(view({ gap: '10%', display: 'contents' }).box).not.toHaveProperty('gap');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('validates enumerated values', () => {
    const warn = spyWarn();
    expect(view({ flexDirection: 'diagonal' as never }).box.flexDirection).toBe('column');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('resolves background colors', () => {
    expect(view({ backgroundColor: 'blue' }).box.backgroundColor).toBe('blue');
    expect(view({ backgroundColor: '#123456' }).box.backgroundColor).toBe('#123456');
    expect(view({ backgroundColor: 'transparent' }).box).not.toHaveProperty('backgroundColor');
    const warn = spyWarn();
    expect(view({ backgroundColor: 'bogus' }).box).not.toHaveProperty('backgroundColor');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('maps opacity to dim and hidden', () => {
    expect(view({ opacity: 0.5 })).toMatchObject({ dim: true, hidden: false });
    const hidden = view({ opacity: 0, backgroundColor: 'red' });
    expect(hidden).toMatchObject({ dim: true, hidden: true });
    expect(hidden.box).not.toHaveProperty('backgroundColor');
  });

  it('turns translate transforms into relative offsets', () => {
    expect(view({ transform: [{ translateX: 3 }, { translateY: -1 }] }).box).toMatchObject({
      position: 'relative',
      left: 3,
      top: -1,
    });
    expect(view({ left: 2, transform: [{ translateX: 3 }] }).box.left).toBe(5);
    expect(view({ right: 2, transform: [{ translateX: 3 }] }).box.right).toBe(-1);
    expect(view({ position: 'absolute', transform: [{ translateY: 2 }] }).box).toMatchObject({
      position: 'absolute',
      top: 2,
    });
  });

  it('warns about non-translate transforms', () => {
    const warn = spyWarn();
    expect(view({ transform: 'translateX(4px) rotate(10deg)' }).box.left).toBe(4);
    expect(view({ transform: [{ scale: 2 }] }).box).not.toHaveProperty('left');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns once about ignored and unknown props, but not text props', () => {
    const warn = spyWarn();
    view({ shadowColor: 'red', fontSize: 12, color: 'red' } as ViewStyle);
    view({ shadowColor: 'blue' });
    view({ foo: 1 } as never);
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[react-native-ink] View style "shadowColor" is not supported in terminals and was ignored.',
      '[react-native-ink] View style "foo" is not a known style property and was ignored.',
    ]);
  });

  it('skips keys handled elsewhere', () => {
    const warn = spyWarn();
    resolveViewStyle({ foo: 1 } as never, { component: 'Text', skipKeys: new Set(['foo']) });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('resolveBorders', () => {
  const borders = (style: ViewStyle, options: { unicode?: boolean; dim?: boolean; hidden?: boolean } = {}) =>
    resolveBorders(style, { component: 'View', unicode: true, ...options });

  it('draws nothing without a width', () => {
    expect(borders({ borderColor: 'red', borderStyle: 'dashed' })).toEqual({});
  });

  it('picks glyph sets', () => {
    expect(borders({ borderWidth: 1 }).borderStyle).toBe('single');
    expect(borders({ borderWidth: 1, borderRadius: 4 }).borderStyle).toBe('round');
    expect(borders({ borderWidth: 2 }).borderStyle).toBe('bold');
    expect(borders({ borderWidth: 1, borderStyle: 'double' }).borderStyle).toBe('double');
    expect(borders({ borderWidth: 1, borderStyle: 'dashed' }).borderStyle).toMatchObject({
      top: '┄',
      left: '┆',
      topLeft: '┌',
    });
    expect(borders({ borderWidth: 1, borderStyle: 'dotted', borderRadius: 2 }).borderStyle).toMatchObject({
      top: '┈',
      topLeft: '╭',
    });
    expect(borders({ borderWidth: 1, borderStyle: 'double' }, { unicode: false }).borderStyle).toBe('classic');
  });

  it('draws only the sides with a width', () => {
    expect(borders({ borderBottomWidth: 1 })).toMatchObject({
      borderTop: false,
      borderRight: false,
      borderBottom: true,
      borderLeft: false,
    });
    expect(borders({ borderWidth: 1, borderStartWidth: 0 })).toMatchObject({ borderLeft: false });
  });

  it('resolves per-side colors with precedence', () => {
    expect(borders({ borderWidth: 1, borderColor: 'red', borderTopColor: 'blue', borderStartColor: '#fff' })).toMatchObject({
      borderTopColor: 'blue',
      borderRightColor: 'red',
      borderBottomColor: 'red',
      borderLeftColor: '#ffffff',
    });
  });

  it('draws transparent sides with spaces', () => {
    const style = borders({ borderWidth: 1, borderColor: 'red', borderTopColor: 'transparent' }).borderStyle;
    expect(style).toEqual({
      ...NAMED_BOX_STYLES.single,
      top: ' ',
      topLeft: '│',
      topRight: '│',
    });
  });

  it('dims or hides borders for opacity', () => {
    expect(borders({ borderWidth: 1 }, { dim: true }).borderDimColor).toBe(true);
    expect(borders({ borderWidth: 1 }, { hidden: true }).borderStyle).toMatchObject({ top: ' ', topLeft: ' ' });
  });
});

describe('resolveTextStyle', () => {
  it('maps text styles to Ink props', () => {
    expect(
      resolveTextStyle({
        color: 'green',
        backgroundColor: '#000',
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecorationLine: 'underline line-through',
      }),
    ).toEqual({
      ink: { color: 'green', bold: true, italic: true, underline: true, strikethrough: true },
      backgroundColor: '#000000',
      dim: false,
      hidden: false,
    });
  });

  it.each([
    ['bold', 'bold'],
    ['semibold', 'bold'],
    [700, 'bold'],
    ['600', 'bold'],
    ['light', 'dim'],
    ['200', 'dim'],
    ['normal', undefined],
    ['500', undefined],
  ])('fontWeight %s → %s', (weight, expected) => {
    expect(resolveFontWeight(weight)).toBe(expected);
  });

  it('handles translucency and opacity', () => {
    expect(resolveTextStyle({ color: 'rgba(255,255,255,0.4)' })).toMatchObject({ dim: true, hidden: false });
    expect(resolveTextStyle({ color: 'transparent' })).toMatchObject({ hidden: true });
    expect(resolveTextStyle({ opacity: 0.5 })).toMatchObject({ dim: true });
    expect(resolveTextStyle({ opacity: 0 })).toMatchObject({ hidden: true });
  });

  it('maps textTransform and textAlign', () => {
    expect(resolveTextStyle({ textTransform: 'uppercase', textAlign: 'center' })).toMatchObject({
      transform: 'uppercase',
      align: 'center',
    });
    expect(resolveTextStyle({ textAlign: 'justify' }).align).toBe('left');
  });

  it('warns about ignored text props', () => {
    const warn = spyWarn();
    resolveTextStyle({ fontSize: 20, lineHeight: 2 });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('splits text and layout styles', () => {
    expect(splitTextStyle({ color: 'red', padding: 1, opacity: 0.5, width: 3 })).toEqual({
      text: { color: 'red', opacity: 0.5 },
      layout: { padding: 1, width: 3 },
    });
  });
});

describe('applyTextTransform', () => {
  it.each([
    ['uppercase', 'hello World', 'HELLO WORLD'],
    ['lowercase', 'Hello World', 'hello world'],
    ['capitalize', "hello world-wide, don't", "Hello World-Wide, Don't"],
    ['none', 'Keep It', 'Keep It'],
  ] as const)('%s', (transform, input, expected) => {
    expect(applyTextTransform(input, transform)).toBe(expected);
  });
});

describe('STYLE_SUPPORT', () => {
  it('classifies every documented prop', () => {
    expect(Object.keys(STYLE_SUPPORT).length).toBeGreaterThan(120);
    for (const [key, entry] of Object.entries(STYLE_SUPPORT)) {
      expect(['mapped', 'approximated', 'ignored'], key).toContain(entry.level);
      expect(entry.note.length, key).toBeGreaterThan(3);
    }
  });
});
