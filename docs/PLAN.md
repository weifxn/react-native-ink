# react-native-ink: completion plan

Status: **implemented** (M0–M4) · 2026-11-01 · Companion document: [SPEC.md](./SPEC.md)

## 0. Status

All milestones are implemented on branch `claude/rebuild-on-ink8`. The recommended decisions were taken:

- D1: built on Ink 8
- D2: package name `@weifxn/react-native-ink`
- D3: `Platform.OS = 'cli'`
- D4: ANSI color names use the terminal palette
- D5: `ink` is a peer dependency

| Milestone         | Result                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 reset          | Legacy fork removed; TypeScript 6, Vitest, ESLint/Prettier; CI on Linux, macOS and Windows; release workflow                                                                      |
| M1 core           | Style engine, `View`, `Text`, `StyleSheet`, `AppRegistry`, `Platform`, `Dimensions`; all 96 `react-native` exports present                                                        |
| M2 interaction    | Focus model, Pressable family, `Button`, `TextInput`, `Switch`, `ActivityIndicator`, `ScrollView`, lists                                                                          |
| M3 fidelity       | `textAlign`, opacity, dashed/dotted borders, translate transforms, `Modal`, `Alert`, `ActionSheetIOS`, `ToastAndroid`, `BackHandler`, `Appearance`, `AccessibilityInfo`, `LogBox` |
| M4                | `Animated` (JavaScript driver), `Easing`, `Image` / `ImageBackground`                                                                                                             |
| Examples and docs | 6 runnable examples, README, generated `docs/compat.md`, CHANGELOG, CONTRIBUTING                                                                                                  |

**Not done yet:** FlatList virtualization, mouse input, and publishing to npm (needs the owner's npm credentials). The legacy-code tag could not be pushed (the session's git proxy rejects tag pushes); the old code stays reachable at commit `8c66f1b` on `master`.

The rest of this document is the original proposal, kept for reference.

## 1. Where the project stands

The repository is an early (October 2019) work-in-progress port of Ink v2 to a React Native–style API. The README still says **"NOT READY YET"**. There are 10 commits, 2 of them explicitly tagged `[WIP]`.

**What's there**

- A fork of Ink v2's internals (reconciler, DOM, output, instance, App) under `src/modules/Renderer`, `src/modules/Instance` and `src/exports/App`.
- `View` renders a `div` host node. `Text` renders a host node plus a _string transformer_ that draws borders, padding, margins, background and colors with chalk **after** layout.
- Modules copied from react-native-web (`createElement`, `createDOMProps`, `normalizeNativeEvent`, `AccessibilityUtil`, prop-type validators). They are mostly commented out or unused.
- `Image` and `TextInput` are re-exported from `ink-image` and `ink-text-input`. Those packages target Ink 2's own components, not this renderer.
- Public exports: `AppRegistry`, `View`, `Text`, `Image`, `TextInput`. `StyleSheet` is a stub that warns. There is no `Platform`, `Dimensions` or any other RN API.

**What I verified** (scratch copy, Node 22, original lockfile)

| Check                                                      | Result                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn install --frozen-lockfile` (with `--ignore-scripts`) | OK                                                                                                                                                                                                                        |
| `yarn build` (`tsc -d`)                                    | **4 errors.** `AppRegistry` imports `../../Modules/Instance` with the wrong letter case. That only resolves on macOS's case-insensitive filesystem, so it fails on Linux and CI. The other 2 errors are unused variables. |
| With the casing patched: `<Text>Hello</Text>`              | Renders, but every `Text` adds a spurious blank line above itself                                                                                                                                                         |
| `Example-node.tsx`                                         | Broken layout. The nested `<Text>BRO</Text>` is drawn as its own bordered box overlapping the next line, with its top border clipped. The second line's nested "nested text" is not rendered at all.                      |
| Tests                                                      | One placeholder: `it('does a thing', () => {})`                                                                                                                                                                           |
| CI                                                         | Node 10 and `actions/*@v1`. The `paths: ['*']` filter matches only root-level files, so changes under `src/` never trigger CI.                                                                                            |

**Root cause.** Borders, padding, margins and background are produced as text inside a per-node transformer that runs after Yoga has laid everything out. Yoga never reserves space for them. Transformers are also inherited by nested text, so a parent's box gets drawn around its children. Fixing this means writing a new renderer. That is exactly what Ink did over its releases since v2: Ink 8 natively supports borders, backgrounds, absolute positioning, `gap`, overflow with scroll offsets, focus management, screen readers and a test harness.

**Other problems found**

- `dependencies` lists about 60 build and lint tools (babel, eslint, tslint, prettier, typescript, nexe, ncc…). Every user of the package would install them.
- Several runtime imports aren't declared at all (`chalk`, `prop-types`, `cli-cursor`, `wrap-ansi`). They only resolve because Ink 2 happens to pull them in.
- Build artifacts are committed: `react-native-ink-v0.0.0.tgz`, and `yarn-error.log`, which contains the original author's local `PATH`.
- Errors thrown during render are swallowed. `App.componentDidCatch` passes the error to `Instance.unmount(code, signal)` as `code`, which ignores it and resolves the exit promise, so the CLI exits as if it had succeeded.
- `textDecorationStyle: 'underline'` is used where RN uses `textDecorationLine`.
- `package.json`, the README badges and the "Sponsored by Expo" footer still point at the upstream author's project.
- **The npm name `react-native-ink` is taken.** It's an empty 1.0.0 placeholder (no code) that the original author published in 2019.

## 2. Recommendation: rebuild the core as an RN API layer on Ink 8

Delete the forked renderer. Implement React Native's components and APIs as plain React components that render Ink's `<Box>` and `<Text>` and use Ink's hooks.

**Why**

- Ink 8 already does the hard parts. That includes the React 19 reconciler, Yoga 3 layout, diff-based output and keyboard input (kitty protocol, bracketed paste). It also covers focus management, Ctrl+C and cleanup, CI/non-TTY output, screen-reader output, `renderToString` and a testing library.
- What remains is a translation layer: RN props and styles become Ink props. On top of that come the RN components Ink lacks (TextInput, Pressable, ScrollView, FlatList…), composed from Ink primitives.
- **A prototype confirmed it.** About 100 lines of `View`/`Text`/`Pressable` over Ink 8 rendered RN-style code correctly:
  - rounded and partial borders, border colors and padding
  - text wrapping and nested `Text` inheriting styles
  - a `flex: 1` / `flex: 2` split and `numberOfLines` truncation
  - Tab-to-focus and Enter-to-press, driven by `ink-testing-library`

Prototype output, verbatim (`FORCE_COLOR=0`):

```
╭──────────────────────────────────────╮
│                                      │
│ 12 tests passed, 1 failed            │
│ This is a long line of text that     │
│ should wrap inside the forty column  │
│ card nicely.                         │
│                                      │
╰──────────────────────────────────────╯
left                     right
──────────────────────────────
a         │b (flex 2)
tail: the quick bro…
middle: th…fox jumps
```

**Cost.** Ink 8 imposes three requirements: Node ≥ 22, React ≥ 19.3, and ESM only. Node 20 reached end-of-life in April 2026, so that floor is reasonable.

**Alternative considered: keep the Ink 2 fork and fix it.** Rejected. It means redoing years of Ink work: layout-aware borders and backgrounds, the React 19 reconciler API changes, input, focus and CI handling. We would then maintain our own renderer indefinitely.

## 3. Decisions needed

| #   | Decision                   | Recommendation                                                                                                                                                                                     |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Architecture               | An API layer on Ink 8 (§2)                                                                                                                                                                         |
| D2  | npm name                   | Publish as `@weifxn/react-native-ink` now. Separately, ask the original author to transfer `react-native-ink`, since the placeholder holds no code. Rename if that happens.                        |
| D3  | `Platform.OS` value        | `'cli'`. That was the original intent (`"platforms": ["cli"]` in `example/app.json`), and it allows `*.cli.tsx` platform files.                                                                    |
| D4  | Named colors               | `'red'`, `'green'` and the other 8 ANSI color names (plus gray) use the **terminal's own palette**, which respects user themes and 16-color terminals. Every other CSS color is exact (truecolor). |
| D5  | How to depend on Ink       | Make `ink` a **peer dependency** (`^8`), so the app, this library and any `ink-*` libraries share a single Ink instance                                                                            |
| D6  | First usable release (0.1) | Core rendering only (View, Text, StyleSheet, AppRegistry, Platform, Dimensions, PixelRatio), plus the full React Native export list with stubs. Interactive components come in 0.2.                |

## 4. Milestones

Rough sizes: **S** = about a day or less, **M** = a few days, **L** = a week or more of focused work.

### M0: reset the foundation (S–M)

1. Tag the current `master` as `legacy-ink2` so history stays reachable, then work on a branch.
2. Delete the legacy code and files:
   - `src/modules/*`, `src/components/*`, `src/exports/*`
   - `Example-node.tsx`, `babel.config.js`, `jest.config.js`, `jest-preset.js`, `scripts/module-scripts-check-package.sh`
   - the committed `.tgz` and `yarn-error.log`
   - `example/`, to be rebuilt as `examples/*`
3. Write a new `package.json`:
   - ESM with an `exports` map; `engines.node >=22`
   - peer dependencies `react >=19.3` and `ink ^8`
   - one runtime dependency, `@react-native/normalize-colors`
   - scripts: `build`, `test`, `lint`, `typecheck`
4. Set up tooling: strict TypeScript (NodeNext), Vitest, ESLint (flat config with typescript-eslint and react-hooks) and Prettier. Use npm workspaces for `examples/*`.
5. Add a GitHub Actions workflow running lint, typecheck, test, build and `npm pack --dry-run`. Matrix: Node 22, 24 and 26 on Linux; Node 24 on macOS and Windows.
6. Housekeeping:
   - LICENSE keeps the 650 Industries notice and adds a new copyright line.
   - Rewrite the README: badges point to this repo, and the Expo sponsorship footer goes.
   - Add `CHANGELOG.md` and `CONTRIBUTING.md`.

**Exit criteria:** `npm ci && npm test && npm run build` is green in CI on an empty but fully wired package.

### M1: core primitives, release 0.1.0 (L)

1. Style engine (`src/style/`): flatten, color normalization, RN→Ink view props, RN→Ink text props, border resolution, and a support table with warn-once. Table-driven unit tests cover every row of SPEC §5–6.
2. Components:
   - `View`
   - `Text`: nesting and inheritance, `numberOfLines`/`ellipsizeMode`, `textTransform`, and a layout box around top-level Text
   - `SafeAreaView` and `KeyboardAvoidingView` (behave as `View`), `StatusBar` (no-op)
3. APIs:
   - `StyleSheet`, `AppRegistry`, `Platform`
   - `Dimensions`, `useWindowDimensions`, `PixelRatio`
   - `I18nManager`, `processColor`, `PlatformColor`
4. Full export list: every name `react-native` exports exists here, with types. Unimplemented ones are stubs that warn once.
5. Re-exports of Ink's terminal APIs (`render`, `renderToString`, `useInput`, `useFocus`, `Static`…), so apps never import `ink` directly.
6. Golden-file tests via `renderToString` (layout, borders, colors, text), plus type tests.
7. Examples `hello` and `counter`; README with a quickstart and a compatibility table.

**Exit criteria:** the "0.1" column of SPEC §16.

### M2: interaction, release 0.2.0 (L)

1. Focus model.
2. Components: `Pressable`, `TouchableOpacity`/`Highlight`/`WithoutFeedback`, `Button`, `TextInput`, `Switch`, `ActivityIndicator`, `ScrollView` (keyboard scrolling, `scrollTo`), `FlatList` (not virtualized).
3. APIs: `onLayout`, `Keyboard.dismiss`, `Linking`.
4. Interaction tests with `ink-testing-library`; examples `form` and `list`.

### M3: fidelity and developer experience, release 0.3.0 (M–L)

1. Rendering fidelity: `textAlign`, `opacity`, dashed and dotted borders.
2. New components and APIs: `SectionList`, `Modal`, `Appearance`/`useColorScheme`, `BackHandler` (mapped to Esc), `LogBox.ignoreLogs`, `AccessibilityInfo`.
3. Docs pages, a "share code with an RN app" example, and a performance check with a 1,000-row list.

### M4: toward 1.0 (L, open-ended)

1. `Image`, rendered with ANSI half-blocks via an optional image-decoder dependency.
2. `Animated` (driven from JavaScript), FlatList virtualization, mouse input, `Alert`.
3. 1.0 means: API frozen, docs complete, and 3 real-world example apps.

## 5. How to start: the first four pull requests

1. **PR 1, reset (M0).** Mostly deletions and configuration. CI goes green on an empty package.
2. **PR 2, style engine.** Port the prototype into `src/style/` with table-driven tests. This is the riskiest logic and is pure functions, so it comes first.
3. **PR 3, `View`, `Text` and `StyleSheet`,** with golden-file rendering tests.
4. **PR 4, `AppRegistry`, `Platform`, `Dimensions`, the export list, examples and README.** Then publish **0.1.0** under the D2 name.

## 6. Risks

| Risk                                                          | Mitigation                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| An Ink major release changes props or behavior                | Peer range `^8`; golden tests catch regressions; dependency-update bot (Renovate or Dependabot) |
| Users expect exact React Native behavior                      | Explicit support table, warn-once for unsupported props, compatibility docs                     |
| `textAlign` and multi-line truncation need the measured width | Build them on Ink's `useBoxMetrics` + `<Transform>`, covered by golden tests                    |
| Keyboard input when stdin isn't a terminal (pipes, CI)        | Input components check `isRawModeSupported` and go inert instead of throwing                    |
| Windows terminal glyph and color differences                  | Windows in CI; ASCII fallbacks for borders and spinners                                         |
| npm name unavailable                                          | The scoped name unblocks publishing today                                                       |
