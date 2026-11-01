# react-native-ink: technical specification (v0.x)

Status: implemented in 0.1.0 (see §17 for where the implementation differs) · 2026-11-01 · Builds on: Ink 8, React 19.3 · API reference: React Native 0.88

Execution plan and decisions: [PLAN.md](./PLAN.md). The package is published as `@weifxn/react-native-ink` (decision D2); examples in this spec import from `react-native-ink` for brevity.

## 1. Purpose

Let developers build terminal UIs and CLIs with React Native's primitives and APIs (`View`, `Text`, `TextInput`, `StyleSheet`, `AppRegistry`…). RN knowledge, and where practical RN component code, should carry over to the terminal unchanged.

**Goals**

- **G1. The same API, where it makes sense.** Names, props and semantics match React Native for every part of its API that has a sensible terminal equivalent.
- **G2. Predictable styling.** RN styles translate to terminal cells by documented rules, listed in one support table. Unsupported props warn once; they never fail silently and never crash.
- **G3. Production-quality CLI behavior.** Correct in a terminal (TTY), in pipes and in CI; clean exit; errors always printed.
- **G4. Easy adoption.** Install with `npm i`, import as ESM, TypeScript types included. Optional aliasing lets code import from `'react-native'`.

**Non-goals**

- Running arbitrary React Native apps or native modules (no NativeModules, TurboModules or Fabric).
- Pixel fidelity: font sizes, font families, shadows, transforms, gradients.
- A custom renderer. Rendering, layout and input belong to Ink.
- Web or mobile targets.

**Target usage, 0.1**

```tsx
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { AppRegistry, StyleSheet, Text, View } from 'react-native-ink';

function Hello({ name = 'world' }: { name?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hello, {name}!</Text>
      <Text style={styles.muted}>React Native primitives, in your terminal.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#00aaff',
    paddingHorizontal: 2,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  title: { color: 'green', fontWeight: 'bold' },
  muted: { color: 'gray' },
});

const { values } = parseArgs({ options: { name: { type: 'string' } } });
AppRegistry.registerComponent('main', () => Hello);
AppRegistry.runApplication('main', { initialProps: values });
```

**Target usage, 0.2**

```tsx
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
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Text>• {item}</Text>}
      />
      <Button title="Clear" onPress={() => setItems([])} />
    </View>
  );
}
```

## 2. Runtime and packaging

| Item                  | Spec                                                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node                  | `>=22` (Ink 8 requirement)                                                                                                                                                                                      |
| React                 | peer `>=19.3.0`                                                                                                                                                                                                 |
| Ink                   | peer `^8.0.0`, so the app and any `ink-*` libraries share one Ink instance                                                                                                                                      |
| Module format         | **ESM only.** `require()` from CommonJS cannot work: Ink's yoga-layout dependency uses top-level await, so Node throws `ERR_REQUIRE_ASYNC_MODULE` (verified on Node 22). CommonJS callers use `await import()`. |
| Runtime dependencies  | `@react-native/normalize-colors` only; anything more must be justified                                                                                                                                          |
| Build                 | `tsc` → `dist/` (ESM JavaScript, `.d.ts`, source maps), no bundler                                                                                                                                              |
| `package.json` fields | `"type": "module"`, `"exports": { ".": …, "./package.json": … }`, `"sideEffects": false`                                                                                                                        |
| License               | MIT. Keep the original 650 Industries notice; vendored RN type definitions keep Meta's MIT notice.                                                                                                              |

## 3. Architecture

```
 app code (RN-style)    import { View, Text, StyleSheet, AppRegistry } from 'react-native-ink'
         │
 ┌───────▼────────────────────────────────────────────────────────────────┐
 │ react-native-ink                                                       │
 │   components/  View Text TextInput Pressable ScrollView FlatList …     │
 │   apis/        AppRegistry StyleSheet Platform Dimensions …            │
 │   style/       flatten · colors · view→Box · text→Text · borders       │
 │                support table → dev warnings + generated compat docs    │
 │   terminal/    re-exported Ink hooks and components                    │
 └───────┬────────────────────────────────────────────────────────────────┘
         │  <Box> <Text> <Transform> + hooks (useInput, useFocus, useBoxMetrics, useAnimation…)
 ┌───────▼───────┐
 │    Ink 8      │  reconciler · Yoga 3 layout · diffed output · input · focus · CI/non-TTY
 └───────────────┘
```

**Rules**

1. Components are plain React function components that render Ink primitives. No custom host components and no reconciler code.
2. Style translation is a set of pure functions (`style → Ink props`), cached per style object and unit-tested on their own.
3. One support table (`src/style/support.ts`) classifies every RN style prop as `mapped`, `approximated` or `ignored`. It drives the development warnings and generates the compatibility docs, so the two cannot drift apart.

**Source layout**

```
src/
  index.ts                     public surface (RN names + terminal extras)
  components/<Name>/index.tsx
  apis/<Name>/index.ts
  style/{flatten,colors,view,text,borders,support,warn}.ts
  terminal/index.ts            Ink re-exports
  internal/                    contexts: inside-a-Text flag, inherited text style, focus ids
```

## 4. Units and layout

- **1 unit = 1 terminal cell:** one column horizontally, one row vertically. Cells are about twice as tall as they are wide, so `padding: 1` looks larger vertically. `paddingHorizontal: 2, paddingVertical: 1` looks roughly even.
- **Values:** fractions are rounded by layout.
  - Percent strings (`'50%'`) work wherever Ink supports them: `width`, `height`, `flexBasis`, `minHeight`/`maxHeight` and position offsets.
  - Percent `minWidth`/`maxWidth` and `'auto'` margins are ignored with a warning.
- **Root container:** as wide as the terminal (`stdout.columns`, or 80 when unknown) and as tall as its content. Components that need a bounded height (`ScrollView`, `Modal`) require an explicit height. `useWindowDimensions().height` gives the terminal's row count.
- **View defaults follow React Native, not Ink:** `flexDirection: 'column'`, `flexShrink: 0`, `alignItems: 'stretch'`, `alignContent: 'flex-start'`, `position: 'relative'`. Ink's `<Box>` defaults to `row` and `flexShrink: 1`, so View always sets these explicitly.
- **`flex` follows Yoga's React Native (non-web) rules.** Explicit `flexGrow`, `flexShrink` or `flexBasis` always win.
  - `flex > 0` → `flexGrow: flex`, `flexShrink: 0`, `flexBasis: 0`
  - `flex === 0` → `flexGrow: 0`, `flexShrink: 0`
  - `flex < 0` → `flexShrink: -flex`
- **Left-to-right only:** `start`/`end` variants map to left/right.

## 5. Colors

**Accepted input:** everything React Native accepts, parsed with `@react-native/normalize-colors`:

- named CSS colors and `transparent`
- hex: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`
- functions: `rgb()`, `rgba()`, `hsl()`, `hsla()`, and `hwb()` in space-separated syntax
- numbers in `0xrrggbbaa` form

**Resolution, in order:**

1. `PlatformColor(name)` goes straight to the terminal as a palette color (`'red'`, `'redBright'`, `'gray'`…) or as `ansi256(n)`.
2. `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`/`grey` use the **terminal palette** (decision D4).
3. Any other color becomes `#rrggbb`. Chalk reduces it to 256 or 16 colors according to the terminal's support, and honors `FORCE_COLOR` and `NO_COLOR`.
4. Alpha:
   - `alpha === 0` means no color (transparent).
   - `0 < alpha < 1`: the color is used fully opaque.
   - For a text `color` with `alpha ≤ 0.5`, the text is also dimmed (approximation).
5. Invalid colors warn once and are ignored.

`processColor(color)` returns React Native's integer form (`0xaarrggbb`) for compatibility.

## 6. Style mapping

### 6.1 Layout styles (View, and the outer box of a top-level Text)

| RN style                                                                                              | Terminal behavior                                                         | Status                |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------- |
| `width`, `height`                                                                                     | cells or %                                                                | mapped                |
| `minWidth`, `maxWidth`                                                                                | cells (no %)                                                              | mapped                |
| `minHeight`, `maxHeight`                                                                              | cells or %                                                                | mapped                |
| `aspectRatio`                                                                                         | number or `'a/b'` string                                                  | mapped                |
| `flex`                                                                                                | expanded per §4                                                           | mapped                |
| `flexGrow`, `flexShrink`, `flexBasis`, `flexDirection`, `flexWrap`                                    | same                                                                      | mapped                |
| `justifyContent`, `alignItems`, `alignSelf`, `alignContent`                                           | same values, including `space-evenly`                                     | mapped                |
| `gap`, `rowGap`, `columnGap`                                                                          | cells                                                                     | mapped                |
| `margin*`: `margin`, `marginHorizontal`/`Vertical`, `marginTop`/`Right`/`Bottom`/`Left`/`Start`/`End` | resolved to 4 sides: a specific side beats its axis, which beats `margin` | mapped (numbers only) |
| `padding*` (same set as `margin*`)                                                                    | same                                                                      | mapped (numbers only) |
| `position`                                                                                            | `absolute` / `relative` / `static`                                        | mapped                |
| `top`, `right`, `bottom`, `left`, `start`, `end`, `inset`                                             | offsets in cells or %                                                     | mapped                |
| `display`                                                                                             | `flex` / `none` (`contents` is ignored)                                   | mapped                |
| `overflow`                                                                                            | `visible` / `hidden`; `scroll` is treated as `hidden`                     | mapped                |
| `zIndex`                                                                                              | paint order is always tree order                                          | ignored               |
| `direction`                                                                                           | left-to-right only                                                        | ignored               |

### 6.2 Visual styles (View)

| RN style                                                                                                    | Terminal behavior                                                     | Status       |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------ |
| `backgroundColor`                                                                                           | fills the box                                                         | mapped       |
| `borderWidth`, `border{Top,Right,Bottom,Left,Start,End}Width`                                               | a side is drawn if its width is > 0; always 1 cell thick              | approximated |
| `borderColor`, `border{Side}Color`                                                                          | per-side color                                                        | mapped       |
| `borderStyle`                                                                                               | glyph set chosen per §6.3                                             | approximated |
| `borderRadius` (any corner)                                                                                 | > 0 gives rounded corners                                             | approximated |
| `opacity`                                                                                                   | `< 1` dims all descendant text; `0` hides content but keeps its space | approximated |
| `shadow*`, `elevation`, `transform`, `filter`, `boxShadow`, `backfaceVisibility`, `cursor`, `pointerEvents` | none                                                                  | ignored      |

### 6.3 Choosing border glyphs

The first matching rule wins:

1. `borderStyle` names an Ink border (terminal extension): `single`, `double`, `round`, `bold`, `singleDouble`, `doubleSingle`, `classic`. That set is used.
2. `borderStyle: 'dashed'` or `'dotted'` → dashed (`┄ ┆`) or dotted (`┈ ┊`) glyphs with single-line corners. Exact glyphs are settled in the implementation PR.
3. Any `borderRadius > 0` → `round` `╭─╮`.
4. The widest side is ≥ 2 → `bold` `┏━┓`.
5. Otherwise → `single` `┌─┐`.

For terminals without Unicode, an ASCII mode (`TERM=dumb`, or a setting) falls back to `classic` `+-|`.

### 6.4 Text styles

| RN style                                                                                                                                                                                      | Terminal behavior                                                                                                     | Status       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| `color`                                                                                                                                                                                       | text color                                                                                                            | mapped       |
| `backgroundColor`                                                                                                                                                                             | background behind the characters                                                                                      | mapped       |
| `fontWeight`                                                                                                                                                                                  | Bold for `bold`, `semibold`, `heavy`, `black` and `600`–`900`. Dim for `thin`, `ultralight`, `light` and `100`–`300`. | approximated |
| `fontStyle`                                                                                                                                                                                   | `italic` (if the terminal supports it)                                                                                | mapped       |
| `textDecorationLine`                                                                                                                                                                          | `underline`, `line-through`, or both                                                                                  | mapped       |
| `textTransform`                                                                                                                                                                               | `uppercase` / `lowercase` / `capitalize`; inherited by nested Text                                                    | mapped       |
| `textAlign`                                                                                                                                                                                   | `left` / `center` / `right` using the measured width; `justify` behaves as `left`                                     | mapped (0.3) |
| `opacity`                                                                                                                                                                                     | ≤ 0.5 dims the text                                                                                                   | approximated |
| `fontSize`, `fontFamily`, `lineHeight`, `letterSpacing`, `textShadow*`, `textDecorationColor`/`Style`, `verticalAlign`, `writingDirection`, `includeFontPadding`, `fontVariant`, `userSelect` | none                                                                                                                  | ignored      |

**Inheritance works as in React Native:** a nested `<Text>` inherits its parent Text's text styles, and View styles never cascade into Text.

### 6.5 Unsupported props

- Ignored or approximated props never throw.
- In development (`NODE_ENV !== 'production'`), the first use of an ignored prop logs **one** warning per component and prop. Example: `[react-native-ink] View style "shadowColor" is not supported in terminals and was ignored.`
- Warnings go to stderr through Ink, so they don't corrupt the rendered frame. `LogBox.ignoreLogs([...])` and `LogBox.ignoreAllLogs()` silence them.
- Invalid values (for example `width: 'abc'`) warn and are dropped.

## 7. Components

### 7.1 View (0.1)

- Renders an Ink `<Box>` with the props from §6.1–6.2.
- **Props:** `style`, `children`, `testID`, `nativeID`, `onLayout` (0.2), and accessibility props (§10). `pointerEvents` and unknown props are ignored.
- **Ref methods:** `measure(cb)` and `measureInWindow(cb)`, computed from layout metrics (0.2).
- **Bare strings as children** raise an error, as in React Native (Ink throws its equivalent: `Text string "…" must be rendered inside <Text> component`).

### 7.2 Text (0.1)

- Renders an Ink `<Text>`. A **top-level** Text (not inside another Text) that has layout styles (padding, margin, border, width, flex, position…) is wrapped in a `<Box>` carrying those styles.
- **Props:** `style`, `children`, `numberOfLines`, `ellipsizeMode` (`head|middle|tail|clip`), `testID`, accessibility props. `selectable` is ignored.
  - `onPress`, `onLongPress` and `disabled` arrive in 0.2 and make the Text focusable and pressable.
- **Truncation:**
  - `numberOfLines={1}` truncates with an ellipsis at the start (`head`), middle (`middle`) or end (`tail`). `clip` cuts without an ellipsis.
  - `numberOfLines > 1` wraps text inside a box that many rows tall with overflow hidden. In 0.x there is no ellipsis on the last line.
- **A View inside a Text is not supported** (Ink limitation) and gives a clear development error.

### 7.3 Focus model (0.2), shared by all interactive components

- Built on Ink's focus manager:
  - Tab and Shift+Tab move focus in the order components registered.
  - Esc clears focus.
  - Ctrl+C exits.
- **Focusable by default:** `TextInput`, the Pressable family, `Button`, `Switch`, and `ScrollView` when its content overflows. `focusable={false}` or `disabled` opts out.
- `autoFocus` works on `TextInput` (as in React Native) and on `Pressable`/`Button` (terminal extension).
- Ref methods `focus()`, `blur()` and `isFocused()` work through generated focus ids.
- **Keyboard input is read only when stdin supports raw mode.** Otherwise components still render but ignore input; they never throw in pipes or CI.

### 7.4 Pressable, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback (0.2)

- **Activation:** Enter or Space while focused.
  - Callbacks fire in React Native's order: `onPressIn` → `onPressOut` → `onPress`.
  - `onLongPress` is not triggered from the keyboard in 0.x.
- **Pressed feedback:** the `pressed` state stays true for 100 ms after activation, so the feedback is visible.
- **Function props:** `style` and `children` accept functions of `{ pressed, focused }`. `focused` is a terminal extension, like react-native-web's `hovered`.
- **Default focus indicator:** if the app does not supply a function `style` or `children`, the text inside renders in inverse video while focused.
- **Variants:**
  - `TouchableOpacity`: content is dimmed while pressed (when `activeOpacity < 1`).
  - `TouchableHighlight`: `underlayColor` becomes the background while pressed.
  - `TouchableWithoutFeedback`: no visual feedback; takes a single child.

### 7.5 Button (0.2)

- **Props:** `title`, `onPress`, `color`, `disabled`, `accessibilityLabel`, `testID`.
- **Appearance:** renders `[ Title ]` in `color`. Inverse video when focused; dimmed when disabled.

### 7.6 TextInput (0.2)

This is our own implementation, not `ink-text-input`, which lacks uncontrolled mode, `maxLength`, focus and ref integration, and React Native's event shapes.

**Props**

- Value: `value`, `defaultValue`, `onChangeText`, `onChange` (`{nativeEvent:{text}}`).
- Submit: `onSubmitEditing`, `onEndEditing`, `submitBehavior` (`submit | blurAndSubmit | newline`, with React Native's defaults).
- Focus: `onFocus`, `onBlur`, `autoFocus`.
- Keys: `onKeyPress` (`{nativeEvent:{key}}`, using React Native key names such as `Enter`, `Backspace`, `ArrowLeft`).
- Content: `placeholder`, `placeholderTextColor`, `editable`/`readOnly`, `maxLength`, `secureTextEntry` (shows `•`), `multiline`.
- Appearance: `caretHidden`, `cursorColor`, `style` (layout and text styles).
- Ignored: `keyboardType`, `inputMode`, `returnKeyType`, `autoCorrect`, `spellCheck`, and `autoCapitalize` except `characters`.

**Editing keys**

- Typing and pasting (bracketed paste via Ink's `usePaste`).
- Cursor movement: ← → Home End, Ctrl+A, Ctrl+E.
- Deleting: Backspace, Delete, Ctrl+U (delete to start of line), Ctrl+W (delete previous word).
- ↑ ↓ move between lines when `multiline`.

**Rendering:** when focused, the cursor is drawn as an inverse-video cell. When empty, the placeholder appears dimmed (or in `placeholderTextColor`).

**Ref methods:** `focus()`, `blur()`, `clear()`, `isFocused()`.

### 7.7 Switch (0.2)

- **Props:** `value`, `onValueChange`, `disabled`, `trackColor {false, true}`, `thumbColor`.
- **Appearance:** a compact toggle, for example `[ ●]` on and `[● ]` off, with an ASCII fallback.
- Space or Enter toggles it.

### 7.8 ActivityIndicator (0.2)

- **Props:**
  - `animating` (default true), `color`, `hidesWhenStopped` (default true)
  - `size`: `small` is a braille spinner, `large` a wider spinner; a number is treated as `small`
- Uses Ink's `useAnimation`, which shares one timer across all animated components.

### 7.9 ScrollView (0.2)

- **Structure:** a viewport box with overflow hidden whose content offset scrolls an inner content box (`contentContainerStyle`). It needs a bounded height (§4).
- **Props:**
  - `horizontal`, `contentContainerStyle`, `scrollEnabled`
  - `onScroll` (`{nativeEvent:{contentOffset, contentSize, layoutMeasurement}}`), `onContentSizeChange`
  - `showsVerticalScrollIndicator` / `showsHorizontalScrollIndicator`: a scroll track overlaid on the last column or row
  - `keyboardShouldPersistTaps` is ignored
- **Keyboard, when focused:** ↑/↓ (or ←/→ when horizontal) scroll one cell; PgUp/PgDn scroll one viewport; Home/End jump to the start or end.
- **Ref methods:** `scrollTo({x, y})`, `scrollToEnd()`, `flashScrollIndicators()` (no-op).

### 7.10 FlatList (0.2) and SectionList (0.3)

**FlatList** is built on ScrollView.

- **Props:**
  - Data and rendering: `data`, `renderItem({item, index, separators})`, `keyExtractor`, `extraData`
  - Extra elements: `ItemSeparatorComponent`, `ListHeaderComponent`, `ListFooterComponent`, `ListEmptyComponent`
  - Layout: `horizontal`, `numColumns`, `inverted`
  - Scrolling: `onEndReached` with `onEndReachedThreshold`, `initialScrollIndex`
- **Ref methods:** `scrollToIndex`, `scrollToOffset`, `scrollToEnd`.
- **Not virtualized in 0.x:** every row renders. Virtualization comes later.

**SectionList** adds `sections`, `renderSectionHeader`, `renderSectionFooter` and `SectionSeparatorComponent`.

### 7.11 Modal (0.3)

- **Props:** `visible`, `transparent`, `onRequestClose` (Esc), `onShow`, `onDismiss`. `animationType` and `presentationStyle` are ignored.
- Renders an absolutely positioned layer covering the window (requires a bounded root) and keeps focus inside it.

### 7.12 Image (later)

- **Props:**
  - `source`: `{uri}` with a local path, a `file://` URL or an http(s) URL
  - `style.width`/`style.height` in cells, `resizeMode`, `defaultSource`, `alt`
  - `onLoad`, `onError`
- Drawn with ANSI half-block characters (2 pixel rows per cell), using an image-decoder library declared as an optional dependency.
- The `alt` text is shown when graphics aren't available (not a terminal, or `NO_COLOR` set).
- Inline-graphics protocols (kitty, iTerm2, sixel) are out of scope for 0.x, because they conflict with Ink's diff-based redrawing.

### 7.13 Pass-through and no-op components (0.1)

- `SafeAreaView` and `KeyboardAvoidingView` behave like `View`.
- `StatusBar` and `RefreshControl` render nothing.

## 8. APIs

### 8.1 AppRegistry (0.1)

- `registerComponent(appKey, () => Component)`, `registerRunnable`, `registerConfig`, `getAppKeys`, `getRunnable`, `unmountApplicationComponentAtRootTag`.
- `setWrapperComponentProvider` wraps the root, for example with context providers.
- **`runApplication(appKey, { initialProps, ...renderOptions })`** renders with Ink and **returns the Ink instance** (`waitUntilExit`, `unmount`, `rerender`). React Native returns nothing; returning the instance is an extension.
  - `renderOptions` are Ink's render options: `stdout`, `stdin`, `exitOnCtrlC`, `interactive`, `alternateScreen`, `maxFps`…
- **Errors:** an app that exits with an error (`useApp().exit(err)`, or an error thrown while rendering) prints Ink's error overview and sets `process.exitCode = 1`.
- `getApplication(appKey, { initialProps })` returns `{ element, toString(columns?) }`, for snapshots via `renderToString`.
- Command-line argument parsing is left to the app (for example `node:util` `parseArgs`); no parser is bundled.

### 8.2 StyleSheet (0.1)

- `create`: returns its argument unchanged. In development it also validates against the support table and freezes the object.
- `flatten`, `compose`, `absoluteFill`, `absoluteFillObject`.
- `hairlineWidth` is `1`.
- `setStyleAttributePreprocessor` is a no-op.

### 8.3 Platform (0.1)

- `OS`: `'cli'`.
- `Version`: the Node version string.
- `isTV`: `false`. `isTesting`: `NODE_ENV === 'test'`.
- `select({ cli, default })`: the `native` key is not used, because this is not a native platform.
- `constants`: `{ reactNativeVersion, isTTY, colorDepth, terminal }`. `reactNativeVersion` is the API version we target; `terminal` comes from `TERM_PROGRAM`.

### 8.4 Dimensions, useWindowDimensions, PixelRatio (0.1)

- **`Dimensions.get('window' | 'screen')`** returns `{ width: columns, height: rows, scale: 1, fontScale: 1 }`, or 80×24 when not running in a terminal.
- **`Dimensions.addEventListener('change', fn)`** returns `{ remove() }` and is driven by stdout's `resize` event.
- **`useWindowDimensions()`** re-renders on terminal resize.
- **`PixelRatio`:** `get()` is 1, `getFontScale()` is 1, `getPixelSizeForLayoutSize(n)` is `n`, `roundToNearestPixel(n)` is `Math.round(n)`.

### 8.5 Other APIs

| API                                                                           | Behavior                                                                                                         | Milestone  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| `I18nManager`                                                                 | `isRTL` is false; `forceRTL`/`allowRTL` warn                                                                     | 0.1        |
| `processColor`, `PlatformColor`                                               | see §5                                                                                                           | 0.1        |
| `AppState`                                                                    | `currentState` is `'active'`; listeners are no-ops                                                               | 0.1 (stub) |
| `NativeModules`, `TurboModuleRegistry`, `requireNativeComponent`, `UIManager` | throw a descriptive error when used                                                                              | 0.1 (stub) |
| `Keyboard`                                                                    | `dismiss()` blurs the focused input; listeners are no-ops                                                        | 0.2        |
| `Linking`                                                                     | `openURL` opens with the OS default handler, never through a shell; `canOpenURL`; `getInitialURL` returns `null` | 0.2        |
| `Appearance`, `useColorScheme`                                                | best guess from the `COLORFGBG` environment variable, else `null`; `setColorScheme` overrides                    | 0.3        |
| `BackHandler`                                                                 | `hardwareBackPress` fires on Esc when no focused component uses it; `exitApp()` exits the app                    | 0.3        |
| `AccessibilityInfo`                                                           | `isScreenReaderEnabled` reflects Ink's screen-reader mode                                                        | 0.3        |
| `LogBox`                                                                      | `ignoreLogs` / `ignoreAllLogs` silence our warnings                                                              | 0.3        |
| `Vibration`                                                                   | `vibrate()` rings the terminal bell                                                                              | 0.3        |
| `Animated`, `Easing`                                                          | implementation driven from JavaScript                                                                            | later      |
| `Alert`                                                                       | dialog built on `Modal`                                                                                          | later      |

### 8.6 Full export list (0.1)

Every public name that `react-native` (0.88) exports exists in our package, with a type.

- Unimplemented components render `null` and warn once.
- Unimplemented APIs warn once and return safe defaults.
- Native-only APIs throw when **called**, not when imported.

This way, shared code never fails when ESM resolves its imports at startup.

## 9. Terminal extensions

The package root re-exports these from Ink, so apps never import `ink` directly and always share one Ink instance:

- Rendering: `render`, `renderToString`
- Hooks: `useInput`, `usePaste`, `useApp`, `useStdin`, `useStdout`, `useStderr`, `useFocus`, `useFocusManager`, `useAnimation`, `useBoxMetrics`, `useIsScreenReaderEnabled`
- Measurement: `measureElement`
- Components: `Static` (permanent output above the UI, such as logs), `Newline`, `Spacer`, `Transform`

`render(element, options)` wraps the element in our root providers (dimensions, warning and LogBox state).

## 10. Accessibility

Accessibility props map onto Ink's screen-reader props:

| React Native                                                                                    | Ink                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `accessibilityLabel` / `aria-label`                                                             | `aria-label`                                                                                                                     |
| `accessibilityRole` / `role`                                                                    | `aria-role` (Ink's supported roles: `button`, `checkbox`, `list`, `listitem`, `menu`, `progressbar`, `radio`, `tab`, `textbox`…) |
| `accessibilityState` and `aria-*` state props                                                   | `aria-state`                                                                                                                     |
| `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"`, `aria-hidden` | `aria-hidden`                                                                                                                    |

These take effect when Ink's screen-reader mode is on, either with `INK_SCREEN_READER=true` or the render option.

## 11. Runtime behavior

- **In a terminal (TTY):** interactive rendering with Ink's diffing, capped at 30 fps by default. The cursor is hidden while running and restored on exit.
- **In a pipe or CI:** Ink writes only the final frame, at unmount, and input components ignore input.
- **Exit:** Ctrl+C exits by default (`exitOnCtrlC`). On every exit path, raw mode, the cursor and the alternate screen are restored.
- **Errors:** errors thrown during render are printed (Ink's error overview) and the process exits with code 1. They are never swallowed.
- **Console output:** `console.*` output appears above the UI (Ink's `patchConsole`).

## 12. TypeScript

- Types ship for the entire API. Style and prop types are copied from React Native's `StyleSheetTypes.d.ts` (MIT, notice kept) and trimmed: `ViewStyle`, `TextStyle`, `ImageStyle`, `StyleProp<T>`, `ColorValue`, `DimensionValue`, `ViewProps`, `TextProps`…
- Ignored props stay in the types, so shared code still compiles. Their JSDoc is marked `@remarks Ignored in terminals`.
- Terminal extensions are added on top of the RN types: `focused` in Pressable state, Ink border names in `borderStyle`, `autoFocus` on Pressable.
- Type tests (`expect-type`) catch accidental breaking changes.

## 13. Importing `from 'react-native'`

Three recipes, each with docs and an example:

1. **npm alias** (simplest; for CLI-only projects): run `npm i react-native@npm:@weifxn/react-native-ink`. After that, `import { View } from 'react-native'` works in Node, TypeScript and bundlers.
2. **Bundler alias** (monorepos sharing code with a real RN app): set `alias: { 'react-native': '<pkg>' }` in esbuild, tsup or rolldown, plus a matching tsconfig `paths` entry.
3. **Platform files:** `Button.cli.tsx` next to `Button.tsx`, for bundlers configured with the `.cli.tsx` extension.

## 14. Testing and quality

| Layer        | Tooling                                                                           | Must cover                                                    |
| ------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Style engine | Vitest, table-driven                                                              | every row of §5–6, including precedence and invalid values    |
| Rendering    | golden files via `renderToString(…, { columns })`, both plain and `FORCE_COLOR=3` | borders, padding, flex, wrapping, truncation, nesting, colors |
| Interaction  | `ink-testing-library` (verified working with Ink 8)                               | focus order, pressing, TextInput editing, scrolling           |
| Types        | `expect-type`                                                                     | RN-style code compiles; extensions are typed                  |
| Smoke        | run each example in a pseudo-terminal in CI                                       | expected text appears; clean exit                             |
| CI matrix    | GitHub Actions                                                                    | Node 22, 24 and 26 on Linux; Node 24 on macOS and Windows     |

**Coverage gates:** 100% of lines in the style engine; at least 85% overall.

## 15. Open questions

1. The exact Switch and ActivityIndicator glyphs and their ASCII fallbacks. Decide in the PR, with screenshots.
2. Should ScrollView automatically follow newly added content (log views), or leave that to `<Static>`?
3. Mouse support for Pressable and ScrollView, using the terminal's SGR 1006 mouse mode. Candidate for after 1.0.

## 16. Definition of done

| Criterion                                                                            | 0.1 (usable)                               | 0.2 (interactive)    | 1.0                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------ | -------------------- | ------------------------ |
| Installs and imports as ESM on Node 22+                                              | ✓                                          | ✓                    | ✓                        |
| View, Text, StyleSheet, AppRegistry, Platform, Dimensions as specified               | ✓                                          | ✓                    | ✓                        |
| Full RN export list with typed stubs                                                 | ✓                                          | ✓                    | ✓                        |
| Unsupported props warn once and never crash                                          | ✓                                          | ✓                    | ✓                        |
| Pressable family, Button, TextInput, Switch, ActivityIndicator, ScrollView, FlatList |                                            | ✓                    | ✓                        |
| Fidelity items (textAlign, opacity, Modal, SectionList…)                             |                                            |                      | ✓                        |
| Docs                                                                                 | quickstart + generated compatibility table | + per-component docs | complete                 |
| Examples                                                                             | hello, counter                             | + form, list         | + dashboard, shared code |
| CI green on the full matrix; npm publish with provenance                             | ✓                                          | ✓                    | ✓                        |

## 17. Implementation notes

Where the 0.1.0 implementation differs from, or goes beyond, the spec above:

- **Examples** are plain folders run with `tsx` (`npm run example -- <name>`) instead of npm workspaces. `tsconfig` paths map the package name and `react-native` to `src/`.
- **Text defaults to `flexShrink: 1`**, like react-native-web, so long text wraps inside rows instead of overflowing; View keeps React Native's `flexShrink: 0`.
- **Percentage and `'auto'` margins, and percentage padding, work.** Ink passes these values to Yoga unchanged, and tests cover it.
- **ScrollView marks its viewport's Yoga node as `overflow: scroll`,** so content can extend past it along the scroll axis, as in React Native. Ink itself only clips.
- **Terminal size never spawns processes.** Ink's `useWindowSize` shells out to `tput`/`stty` when the stream reports no size, so an internal hook reads `stdout.columns`/`rows`, then `$COLUMNS`/`$LINES`, then 80×24.
- **Modal** content renders at the app root, so React context from the Modal's ancestors doesn't reach it. With `AppRegistry`, modals render inside the wrapper component, so wrapper providers do reach them.
- **Dialogs blank the cells beneath them** using an unrecognized background color name, which Ink fills with plain spaces.
- **Built earlier than planned:** `Alert` (including `prompt`), `ActionSheetIOS` and `ToastAndroid` (spec: "later") share a dialog host in the app root. `Animated` and `Image` (spec: "later") are also in 0.1.0.
- **Focus timing:** Ink moves focus at normal React priority. A key pressed within roughly 30–50 ms after a Tab that also scrolls a ScrollView can reach the previously focused component. Normal typing is unaffected.
- **Cell size** (beyond §4): `setCellSize` makes 1 unit = 1/width column and 1/height row, process-wide, so app code written in dp lays out in cells. Lengths round per value (`Math.round`, symmetric for negatives); positive sizes never round to 0; `gap` splits into row and column gaps when a cell isn't square; `flexBasis` follows the parent's main axis (Views pass their direction down only when the cell isn't 1×1); `aspectRatio` is scaled by height/width; percentages pass through. Everything read back (Dimensions, onLayout, measure, scroll events, scrollTo, getItemLayout offsets) is in layout units. Internal UI (dialogs) passes its spacing as Ink props, which aren't scaled.
- **Backgrounds** behind library-drawn cells: View tracks the background behind it (its own resolved `backgroundColor`, else the inherited one) in a context, and passes it to Ink's `borderBackgroundColor`; alignment padding and blanked text are painted with it too.
- **Page scrolling:** vertical ScrollViews register in mount order with their nesting depth; with nothing focused, the app root sends ↑/↓/PgUp/PgDn/Home/End to the outermost one that can scroll (one behind a modal can't).
- **Tab order:** Ink's focus list is append-only in mount order. A focusable that mounts ahead of others in the tree makes those re-register (a new id moves them to the end), in tree order (React's: depth-first, a parent after its children); a focused one is focused again under its new id. Focusables without a host node (TouchableWithoutFeedback, pressable Text) keep mount order.
- **Paging and windowing:** `pagingEnabled` keyboard steps land on page boundaries; keyboard scrolls (not programmatic ones) fire `onScrollEndDrag` then `onMomentumScrollEnd`. FlatList windows by `getItemLayout` (binary search on offsets, spacers for the rest) and, when paging, wraps off-page items in an inactive focus scope.
- **Still open:** virtualization without `getItemLayout`, mouse input, an ellipsis on the last line for `numberOfLines > 1`, nested Text removing a style its parent applied (e.g. `fontWeight: 'normal'` inside bold text), and wrapped lines keeping the space they broke at (Ink wraps with `trim: false`).
