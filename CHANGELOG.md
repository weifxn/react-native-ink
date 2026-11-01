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
- `FlatList`, `SectionList`, `VirtualizedList`, `VirtualizedSectionList` (not virtualized).
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

### Tooling

- TypeScript (strict), Vitest, ESLint and Prettier.
- CI on Linux, macOS and Windows.
- `docs/compat.md` generated from the style support table.
