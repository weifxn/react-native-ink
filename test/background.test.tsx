import { describe, expect, it } from 'vitest';
import { Text } from '../src/components/Text/index.js';
import { TextInput } from '../src/components/TextInput/index.js';
import { View } from '../src/components/View/index.js';
import { renderColored } from './helpers.js';

// #112233 as a truecolor background escape.
const BG = '\u001B[48;2;17;34;51m';
const RED_BG = '\u001B[48;2;255;0;0m';

/** Each line's cells as [character, has-background] pairs, with escape codes resolved. */
function cells(output: string, background = BG): Array<Array<[string, boolean]>> {
  return output.split('\n').map((line) => {
    const row: Array<[string, boolean]> = [];
    let painted = false;
    for (const part of line.split(/(\u001B\[[\d;]*m)/)) {
      if (part.startsWith('\u001B[')) {
        if (part === background) painted = true;
        else if (part === '\u001B[49m' || part === '\u001B[0m') painted = false;
        continue;
      }
      for (const char of part) row.push([char, painted]);
    }
    return row;
  });
}

describe('backgrounds behind what the library draws', () => {
  it("paints border glyphs with the background behind the box, like React Native's", () => {
    const rows = cells(
      renderColored(
        <View style={{ backgroundColor: '#112233', width: 8 }}>
          <View style={{ borderWidth: 1 }}>
            <Text>hi</Text>
          </View>
        </View>,
      ),
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.every(([, painted]) => painted)).toBe(true);
    }
  });

  it("paints a box's border with its own background when it has one", () => {
    const rows = cells(
      renderColored(
        <View style={{ backgroundColor: '#ff0000', borderWidth: 1, width: 6 }}>
          <Text>x</Text>
        </View>,
      ),
      RED_BG,
    );
    expect(rows[0]!.every(([, painted]) => painted)).toBe(true);
  });

  it('paints the padding of centered and right-aligned text', () => {
    const rows = cells(
      renderColored(
        <View style={{ backgroundColor: '#112233', width: 9 }}>
          <Text style={{ textAlign: 'center' }}>mid</Text>
          <Text style={{ textAlign: 'right' }}>end</Text>
        </View>,
      ),
    );
    for (const row of rows) {
      const text = row.map(([char]) => char).join('');
      const firstLetter = text.search(/\S/);
      expect(firstLetter).toBeGreaterThan(0);
      expect(row.slice(0, firstLetter).every(([, painted]) => painted)).toBe(true);
    }
  });

  it("paints a text field's border with the background behind it", () => {
    const rows = cells(
      renderColored(
        <View style={{ backgroundColor: '#112233', width: 12 }}>
          <TextInput style={{ borderWidth: 1 }} placeholder="name" />
        </View>,
      ),
    );
    expect(rows[0]!.every(([, painted]) => painted)).toBe(true);
  });

  it('leaves borders alone when nothing behind them has a background', () => {
    const output = renderColored(
      <View style={{ borderWidth: 1, width: 4 }}>
        <Text>x</Text>
      </View>,
    );
    expect(output).not.toContain('\u001B[48;');
  });
});

describe('translucent colors', () => {
  it('mixes a border with the background under it, as on a phone', () => {
    const output = renderColored(
      <View style={{ backgroundColor: '#ffffff' }}>
        <View style={{ borderWidth: 1, borderColor: '#00000040', width: 6 }}>
          <Text>hi</Text>
        </View>
      </View>,
      10,
    );
    // Black at a quarter over white.
    expect(output).toContain('\u001B[38;2;191;191;191m');
    expect(output).not.toContain('\u001B[38;2;0;0;0m');
  });

  it("mixes a view's background with the one behind it", () => {
    const output = renderColored(
      <View style={{ backgroundColor: '#000000' }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.4)', width: 4 }}>
          <Text>hi</Text>
        </View>
      </View>,
      10,
    );
    expect(output).toContain('\u001B[48;2;102;102;102m');
  });
});
