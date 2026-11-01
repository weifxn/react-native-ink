# Changelog

## 0.1.0 — unreleased

First release of the rebuild on Ink 8. The 2019 prototype is still in git history (commit `8c66f1b` on `master`).

### Components

- `View` and `Text`: React Native layout defaults; text nesting and inheritance; `numberOfLines` / `ellipsizeMode`, `textAlign` and `textTransform`; `onLayout`, measure methods and accessibility props.
- `TextInput`:
  - controlled and uncontrolled, with grapheme-aware cursor editing and word/line deletion
  - bracketed paste, multiline, `maxLength`, `secureTextEntry`, placeholder, `submitBehavior`
  - horizontal scrolling and ref methods
- `Pressable`, `TouchableOpacity`, `TouchableHighlight`, `TouchableWithoutFeedback`, `TouchableNativeFeedback`, `Button` and pressable `Text`.
- `Switch`, `ActivityIndicator`, `ProgressBarAndroid`.
- `ScrollView`: keyboard scrolling, scroll indicator, scroll-into-view for focused children, `scrollTo` / `scrollToEnd`, `RefreshControl`.
- `FlatList`, `SectionList`, `VirtualizedList`, `VirtualizedSectionList`.
- `Modal`: opaque and transparent, scoped focus, Esc calls `onRequestClose`.
- `Image` and `ImageBackground`: PNG and JPEG drawn with half blocks.
- `SafeAreaView`, `KeyboardAvoidingView`, `StatusBar`, `RefreshControl`, `DrawerLayoutAndroid`, and stubs for the experimental virtual collection components.

### APIs

- `AppRegistry`, `StyleSheet`, `Platform` (`OS === 'cli'`), `Dimensions`, `useWindowDimensions`, `PixelRatio`.
- `Animated` (JavaScript driver) and `Easing`.
- `Alert`, `ActionSheetIOS`, `ToastAndroid`, `BackHandler` (Esc), `Keyboard`, `Linking`.
- `Appearance` / `useColorScheme`, `AccessibilityInfo`, `LogBox`, `Clipboard` (OSC 52), `Vibration` (bell), `I18nManager`, `Settings`, event emitters.
- `processColor`, `PlatformColor` (terminal palette), `DynamicColorIOS`.
- Every other `react-native` 0.88 export, as a safe stub.
- Terminal extensions re-exported from Ink: `render`, `renderToString`, `useInput`, `useFocus`, `Static` and more.

### Sharing code with a React Native app

- `setCellSize({ width, height })` / `getCellSize()`: style lengths written in dp become whole cells along their own axis, and `Dimensions`, `useWindowDimensions`, `onLayout`, `measure*` and scroll offsets come back in dp. 1×1 (the default) keeps everything as before.
- With nothing focused, ↑/↓, PgUp/PgDn and Home/End scroll the page (the outermost vertical ScrollView).
- Tab follows the tree, not mount order: a focusable that mounts late (after its data loaded) takes its place, and keeps focus while the order is restored.
- A focused item is scrolled into view by every enclosing ScrollView, not only the nearest.
- `pagingEnabled`: ←/→ (↑/↓ vertically) move a page and land on page boundaries; keyboard scrolls fire `onScrollEndDrag` and `onMomentumScrollEnd`.
- `numberOfLines` above 1 ends the last line with an ellipsis when the text runs on, as React Native does.
- Translucent colors (`rgba()`, `#rrggbbaa`) are mixed with the background behind them instead of being drawn opaque, so a faint border or highlight looks as it does on a phone.
- Wrapped text starts each row at a word: Ink's wrapping put the space a row broke at on the next row whenever the row before was exactly full. A paragraph's own indentation stays.
- The mouse, opt-in with `mouse: true`: a click presses (long press too) or focuses a TextInput with the cursor where it landed, and the wheel scrolls the ScrollView under the pointer.
- Modal content keeps the React context of the Modal's ancestors (it renders through a portal), and with `AppRegistry` covers the wrapper component's chrome as well.
- FlatList renders only `windowSize` viewports of rows (5 by default), sized by `getItemLayout` or measured as they render, so a long list is quick to open and to scroll; it scrolls to unrendered indexes, and with `pagingEnabled` keeps focus on the visible page. End and `scrollToEnd` keep the end in view while the rows there are measured.

### Fixes

- Border glyphs are drawn on the box's background (or the one behind it), as React Native paints a view's background under its border, instead of showing the terminal's own background through them; so are the padding of centered and right-aligned text and the blank space of transparent text.
- A View no longer remounts its content when its inherited text state changes — focus turning a pressable's text inverse used to swap the element at its root, which reset the state of everything inside.
- `useColorScheme()` / `Appearance.getColorScheme()` return `'unspecified'` when the terminal doesn't report its background, as React Native's types promise, instead of `null`.

### Tooling

- TypeScript (strict), Vitest, ESLint and Prettier.
- CI on Linux, macOS and Windows.
- `docs/compat.md` generated from the style support table.
