# react-native-ink

**React Native's components and APIs for terminal apps and CLIs**, rendered with [Ink](https://github.com/vadimdemedes/ink).

[![CI](https://github.com/weifxn/react-native-ink/actions/workflows/ci.yml/badge.svg)](https://github.com/weifxn/react-native-ink/actions/workflows/ci.yml)

```tsx
import { AppRegistry, StyleSheet, Text, View } from '@weifxn/react-native-ink';

function App() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hello, terminal!</Text>
      <Text>Same components, same styles, same APIs.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#00aaff',
    padding: 1,
    alignSelf: 'flex-start',
  },
  title: { color: 'green', fontWeight: 'bold' },
});

AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main');
```

```
╭──────────────────────────────────────────╮
│                                          │
│ Hello, terminal!                         │
│ Same components, same styles, same APIs. │
│                                          │
╰──────────────────────────────────────────╯
```

- **The React Native API.** `View`, `Text`, `TextInput`, `Pressable`, `ScrollView`, `FlatList`, `Modal`, `Image`, `Animated`, `StyleSheet`, `AppRegistry`, `Alert` and the rest: all 96 exports of `react-native` 0.88 exist, so shared code always imports.
- **Real terminal behavior.** Keyboard focus, text editing, scrolling, dialogs, CI-safe output and clean exits come from Ink 8.
- **Predictable styling.** React Native styles map to terminal cells by documented rules. Anything a terminal can't do is ignored with a one-time warning instead of crashing ([compatibility table](docs/compat.md)).

## Install

```sh
npm install @weifxn/react-native-ink ink react
```

Requires **Node.js 22+** and **React 19.3+**. The package is ESM-only, like Ink: use `import`, or `await import()` from CommonJS.

To display images, also install the decoders you need: `npm install pngjs jpeg-js`.

## Interactivity

```tsx
import { useState } from 'react';
import { Button, FlatList, Text, TextInput, View } from '@weifxn/react-native-ink';

function Todo() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<string[]>([]);
  return (
    <View style={{ gap: 1 }}>
      <TextInput
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder="What needs doing?"
        submitBehavior="submit"
        onSubmitEditing={() => {
          setItems([...items, text]);
          setText('');
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => <Text>• {item}</Text>}
      />
      <Button title="Clear" onPress={() => setItems([])} />
    </View>
  );
}
```

| Key                                              | Does                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Tab / Shift+Tab                                  | Move focus between inputs, pressables, switches and scroll views, in tree order |
| Enter / Space                                    | Press the focused Pressable, Touchable, Button or Switch                        |
| Esc                                              | Clear focus; close the top Modal (`onRequestClose`); otherwise `BackHandler`    |
| ←/→, Home/End, Ctrl+A/E/U/K/W, Backspace, Delete | Edit text in a focused TextInput; ↑/↓ in multiline ones                         |
| ↑/↓, PgUp/PgDn, Home/End                         | Scroll a focused ScrollView or list; with nothing focused, scroll the page      |
| ←/→                                              | Scroll a focused horizontal ScrollView (a page at a time with `pagingEnabled`)  |
| Ctrl+C                                           | Exit                                                                            |

### Mouse

Render with `mouse: true` (`render(<App />, { mouse: true, alternateScreen: true })`, or the same in `AppRegistry.runApplication`'s parameters) and the mouse works as touch does on a phone:

- **A click presses** the Pressable, Touchable, Button, Switch or pressable Text it lands on (the one drawn on top, else the nearest one around it): `onPressIn` as the button goes down, `onPressOut` and `onPress` as it comes up over the same component, `onLongPress` instead when held `delayLongPress` (500 ms). Press events carry `locationX`/`locationY` and `pageX`/`pageY`.
- **A click on a TextInput** focuses it and puts the cursor on the clicked character; a click on nothing that takes clicks clears focus.
- **The wheel** scrolls the ScrollView or list under the pointer, else the page, three cells a step (a page per burst with `pagingEnabled`); Shift+wheel or a sideways wheel scrolls horizontal ones.

The terminal has to report where the app is, so it needs `alternateScreen: true` or an app as tall as the window. While the mouse is on, selecting text in the terminal needs a modifier held (Shift in most terminals, Option in macOS ones), so offer a way to turn it off. Reporting is switched off again however the app ends.

## How React Native maps to a terminal

- **Units are cells.** `width: 20` is 20 columns and `height: 3` is 3 rows. Cells are about twice as tall as they are wide. Code written in dp for a phone sets a cell size instead (see [below](#sharing-code-with-a-react-native-app)).
- **Layout is React Native's Yoga.** Views stack in a column with `flexShrink: 0`. `flex: 1` grows from a zero basis. Percentages and `margin: 'auto'` work.
- **Colors.** `'red'`, `'green'` and the other ANSI names use the terminal's own palette; every other CSS color is exact truecolor (downsampled automatically). `PlatformColor('redBright')` names palette colors directly.
- **Text.** Bold, italic, underline, strikethrough, `textTransform`, `textAlign` and `numberOfLines` with ellipsis all work. Light font weights and `opacity < 1` render dim. Font sizes and families are ignored.
- **Borders.** A side is drawn when its width is above 0. `borderRadius` gives rounded corners and `borderStyle: 'dashed'` dashed lines. Ink names such as `'double'` are accepted too.
- **Transforms.** `translateX`/`translateY` shift by whole cells; other transforms are ignored.
- **Platform.** `Platform.OS === 'cli'`, so `Platform.select({ cli: …, default: … })` works.

See [docs/compat.md](docs/compat.md) for every component, API and style prop.

## Importing from `'react-native'`

To share components with a React Native app, keep `import … from 'react-native'` and alias it:

- **CLI-only project:** `npm install react-native@npm:@weifxn/react-native-ink`
- **Monorepo shared with an RN app:** alias in your bundler (`alias: { 'react-native': '@weifxn/react-native-ink' }` in esbuild, tsup or rolldown) and in `tsconfig.json` `paths`.
- **Platform files:** put terminal-only variants in `Component.cli.tsx` and configure the extension in your bundler.

See [`examples/shared-code`](examples/shared-code).

## Sharing code with a React Native app

A phone app's styles are in dp: `padding: 16` would be 16 cells. Tell the library how many layout units a cell is, before the app renders (and before code that reads `Dimensions` at load time runs):

```ts
import { setCellSize } from '@weifxn/react-native-ink';

setCellSize({ width: 8, height: 20 }); // one cell ≈ 8×20 dp

const { App } = await import('./App.js');
```

Lengths in styles then become whole cells along their own axis (`padding: 16` is 2 columns and 1 row; `gap` is split into a row and a column gap; a positive size never rounds away to nothing), and everything the app reads back is in its units again: `Dimensions`, `useWindowDimensions`, `onLayout`, `measure*`, scroll offsets and `scrollTo`. The app's breakpoints keep working: a 160-column terminal is 1280 dp wide. Borders stay one cell thick, and the library's own dialogs stay in cells.

Keyboard behavior that makes touch screens usable from a keyboard, with no app changes:

- **The page scrolls** with ↑/↓, PgUp/PgDn and Home/End when nothing is focused: the outermost vertical ScrollView, as a browser scrolls its page.
- **Tab follows the screen**, not the order components mounted, so a card that appears once its data loads takes its place in the order.
- **A focused item is scrolled into view** by every ScrollView around it (a day in a pager in a page).
- **Pagers page:** a focused horizontal ScrollView or FlatList with `pagingEnabled` moves a page per ←/→ and fires `onScrollEndDrag` and `onMomentumScrollEnd`; only the visible page's items take focus.

`useColorScheme()` returns `'unspecified'` when the terminal doesn't report its background, as React Native's types promise, never `null`.

## Terminal extensions

These Ink APIs are re-exported, so you never need to import `ink` directly:

- **Rendering:** `render(element, options)` and `renderToString(element, { columns })`. `render` adds the app root that powers Modal, Alert, BackHandler and Keyboard, and takes Ink's options plus `mouse` (see [Mouse](#mouse)).
- **Units:** `setCellSize({ width, height })` and `getCellSize()` (see above).
- **Hooks:** `useInput`, `usePaste`, `useApp`, `useFocus`, `useFocusManager`, `useStdout`, `useStdin`, `useStderr`, `useAnimation`, `useBoxMetrics`, `useWindowSize`, `useCursor`, `useIsScreenReaderEnabled`
- **Components:** `Static` (permanent output above the UI), `Newline`, `Spacer`, `Transform`

`AppRegistry.runApplication(appKey, { initialProps, ...inkRenderOptions })` returns the Ink instance:

```ts
const app = AppRegistry.runApplication('main', {
  initialProps: { name: 'Ada' },
  exitOnCtrlC: true,
});
await app.waitUntilExit();
```

## Testing

Use [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library) with the element from `AppRegistry.getApplication`:

```tsx
import { render } from 'ink-testing-library';

AppRegistry.registerComponent('main', () => App);
const { lastFrame, stdin } = render(AppRegistry.getApplication('main').element);
stdin.write('\t'); // focus the first input
```

## Examples

```sh
npm run example -- hello --name Ada   # a styled card, then exit
npm run example -- counter            # state and timers
npm run example -- form               # TextInput, Switch, Button and focus
npm run example -- list               # FlatList with scrolling and selection
npm run example -- dashboard          # flex layout, spinner, Animated progress bar
npm run example -- shared-code        # imports from 'react-native'
```

## Limitations

- **Lists are windowed only with `getItemLayout`:** a FlatList given item sizes renders `windowSize` viewports of items; otherwise, and for SectionList, every item renders.
- **Mouse:** opt-in, and no hover or dragging. TouchableWithoutFeedback and TouchableNativeFeedback (which add no View) and Text nested in other Text don't take clicks. Long press needs the mouse.
- **View inside Text:** a `<View>` nested in `<Text>` renders its children inline.
- **Esc delay:** terminals report Esc with a short delay, because it also starts escape sequences.
- **No native-only features:** no `require()` image assets, gestures, native modules or the native animation driver.

## Development

```sh
npm install
npm test            # Vitest: unit, golden render, interaction and example tests
npm run typecheck
npm run lint
npm run build       # tsc → dist/
npm run docs:compat # regenerate docs/compat.md
```

Design documents: [SPEC](docs/SPEC.md) · [PLAN](docs/PLAN.md) · [CHANGELOG](CHANGELOG.md) · [CONTRIBUTING](CONTRIBUTING.md)

## Credits

- The original idea and first prototype came from [Evan Bacon](https://github.com/evanbacon).
- Rendering, layout and input are by [Ink](https://github.com/vadimdemedes/ink) (Vadim Demedes and contributors).
- The APIs follow [React Native](https://github.com/facebook/react-native) and [react-native-web](https://github.com/necolas/react-native-web).

## License

MIT. See [LICENSE](LICENSE).
