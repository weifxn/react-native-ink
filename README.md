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

| Key                                              | Does                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Tab / Shift+Tab                                  | Move focus between inputs, pressables, switches and scroll views             |
| Enter / Space                                    | Press the focused Pressable, Touchable, Button or Switch                     |
| Esc                                              | Clear focus; close the top Modal (`onRequestClose`); otherwise `BackHandler` |
| ←/→, Home/End, Ctrl+A/E/U/K/W, Backspace, Delete | Edit text in a focused TextInput; ↑/↓ in multiline ones                      |
| ↑/↓, PgUp/PgDn, Home/End                         | Scroll a focused ScrollView or list                                          |
| Ctrl+C                                           | Exit                                                                         |

## How React Native maps to a terminal

- **Units are cells.** `width: 20` is 20 columns and `height: 3` is 3 rows. Cells are about twice as tall as they are wide.
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

## Terminal extensions

These Ink APIs are re-exported, so you never need to import `ink` directly:

- **Rendering:** `render(element, options)` and `renderToString(element, { columns })`. `render` adds the app root that powers Modal, Alert, BackHandler and Keyboard.
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

- **Lists aren't virtualized:** every item of a FlatList or SectionList renders.
- **Modal context:** modal content renders at the app root, so React context from the Modal's ancestors doesn't reach it. Provide it with `AppRegistry.setWrapperComponentProvider`.
- **No mouse or long press:** input is keyboard only.
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
