// Generates docs/compat.md from the style support table and the component/API inventory below.
// Run with `npm run docs:compat`; CI checks that the committed file is up to date.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STYLE_SUPPORT, type StyleCategory, type SupportLevel } from '../src/style/support.js';

type Status = 'supported' | 'partial' | 'stub';

const COMPONENTS: Array<[string, Status, string]> = [
  [
    'View',
    'supported',
    'Ink `<Box>` with React Native defaults (column, flexShrink 0), onLayout, measure',
  ],
  [
    'Text',
    'supported',
    'Nesting and inheritance, numberOfLines/ellipsizeMode, textAlign, textTransform, onPress',
  ],
  [
    'TextInput',
    'supported',
    'Controlled/uncontrolled, cursor editing, paste, multiline, secureTextEntry, maxLength, submitBehavior',
  ],
  [
    'Pressable',
    'supported',
    'Enter/Space press, `{pressed, focused}` state, autoFocus; no long press',
  ],
  ['TouchableOpacity / TouchableHighlight', 'supported', 'Dim / underlay feedback while pressed'],
  [
    'TouchableWithoutFeedback / TouchableNativeFeedback',
    'supported',
    'Focusable wrapper without an extra View',
  ],
  ['Button', 'supported', '`[ Title ]`, inverse when focused'],
  ['Switch', 'supported', '`[● ]` / `[ ●]`, Space/Enter toggles'],
  ['ActivityIndicator', 'supported', 'Braille (small) or bar (large) spinner'],
  [
    'ScrollView',
    'supported',
    'Keyboard scrolling, indicator, scrollTo/scrollToEnd, focused children scrolled into view, RefreshControl spinner',
  ],
  [
    'FlatList / SectionList / VirtualizedList / VirtualizedSectionList',
    'partial',
    'All features except virtualization (every item renders)',
  ],
  [
    'Modal',
    'supported',
    'Opaque or transparent, focus scope, Esc → onRequestClose; content renders at the app root',
  ],
  [
    'Image / ImageBackground',
    'partial',
    'PNG/JPEG drawn with half blocks (optional `pngjs` / `jpeg-js`); no require() assets',
  ],
  ['SafeAreaView / KeyboardAvoidingView', 'supported', 'Plain Views'],
  [
    'StatusBar / RefreshControl / InputAccessoryView',
    'stub',
    'Render nothing (RefreshControl drives ScrollView)',
  ],
  ['DrawerLayoutAndroid', 'partial', 'Renders the main content only'],
  ['ProgressBarAndroid', 'partial', 'Horizontal bar or spinner (deprecated in React Native)'],
  [
    'unstable_Virtual* (VirtualView, VirtualArray, ...)',
    'stub',
    'VirtualView renders its children; the rest render nothing',
  ],
];

const APIS: Array<[string, Status, string]> = [
  ['AppRegistry', 'supported', 'runApplication returns the Ink instance; getApplication for tests'],
  ['StyleSheet', 'supported', 'create, flatten, compose, absoluteFill, hairlineWidth (1)'],
  ['Platform', 'supported', "`OS === 'cli'`, select({ cli, default })"],
  ['Dimensions / useWindowDimensions / PixelRatio', 'supported', 'Terminal size in cells; ratio 1'],
  [
    'Animated / Easing',
    'supported',
    'JavaScript driver; values, interpolation, timing/spring/decay, composition, events, components, hooks',
  ],
  ['Alert / ActionSheetIOS', 'supported', 'Centered dialogs with focusable buttons; Alert.prompt'],
  ['ToastAndroid', 'supported', 'Timed message below the app'],
  ['BackHandler', 'supported', 'Esc when nothing is focused; exitApp exits the app'],
  ['Keyboard', 'partial', 'dismiss() blurs the focused input; no keyboard events'],
  ['Linking', 'partial', 'openURL with the OS opener; no incoming URLs'],
  [
    'Appearance / useColorScheme / DynamicColorIOS',
    'partial',
    'Detected from $COLORFGBG, or set with setColorScheme',
  ],
  ['AccessibilityInfo', 'partial', "isScreenReaderEnabled reflects Ink's screen-reader mode"],
  ['LogBox', 'partial', "Filters this library's warnings"],
  ['Clipboard', 'partial', 'setString via OSC 52; getString returns the last value set'],
  ['Vibration', 'partial', 'Rings the terminal bell'],
  [
    'processColor / PlatformColor',
    'supported',
    'PlatformColor names the terminal palette (`redBright`, `ansi256(208)`)',
  ],
  ['I18nManager', 'partial', 'Always left-to-right'],
  ['Settings', 'partial', 'In memory'],
  [
    'EventEmitter / DeviceEventEmitter / NativeEventEmitter',
    'supported',
    'Shared JavaScript emitter',
  ],
  ['AppState', 'stub', "Always 'active'"],
  ['LayoutAnimation', 'stub', 'Changes apply instantly'],
  ['PanResponder', 'stub', 'No touch input in terminals'],
  ['Share / PermissionsAndroid / PushNotificationIOS / Networking', 'stub', 'Safe no-ops'],
  ['NativeModules / TurboModuleRegistry / UIManager', 'stub', 'No native modules (empty / null)'],
  [
    'requireNativeComponent / codegenNative* / NativeComponentRegistry',
    'stub',
    'Throw when called',
  ],
];

const LEVEL_LABEL: Record<SupportLevel, string> = {
  mapped: 'Supported',
  approximated: 'Approximated',
  ignored: 'Ignored',
};
const STATUS_LABEL: Record<Status, string> = {
  supported: 'Supported',
  partial: 'Partial',
  stub: 'Stub',
};
const CATEGORY_TITLE: Record<StyleCategory, string> = {
  layout: 'Layout styles',
  view: 'View styles',
  text: 'Text styles',
  image: 'Image styles',
};

function styleTable(category: StyleCategory): string {
  const groups = new Map<string, string[]>();
  for (const [key, entry] of Object.entries(STYLE_SUPPORT)) {
    if (entry.category !== category) continue;
    const id = `${entry.level}|${entry.note}`;
    groups.set(id, [...(groups.get(id) ?? []), key]);
  }
  const rows = [...groups.entries()].map(([id, keys]) => {
    const [level, note] = id.split('|') as [SupportLevel, string];
    return `| ${keys.map((key) => `\`${key}\``).join(', ')} | ${LEVEL_LABEL[level]} | ${note} |`;
  });
  return [
    `## ${CATEGORY_TITLE[category]}`,
    '',
    '| Style | Status | Terminal behavior |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

const inventory = (title: string, rows: Array<[string, Status, string]>) =>
  [
    `## ${title}`,
    '',
    '| Name | Status | Notes |',
    '| --- | --- | --- |',
    ...rows.map(([name, status, note]) => `| ${name} | ${STATUS_LABEL[status]} | ${note} |`),
  ].join('\n');

const document = [
  '# React Native compatibility',
  '',
  '<!-- Generated by scripts/generate-compat.ts — do not edit by hand. -->',
  '',
  'Every name exported by `react-native` 0.88 is exported here, so shared code always imports.',
  'Ignored style props are accepted and logged once in development (silence them with `LogBox.ignoreLogs`).',
  '',
  'Units: 1 = one terminal cell (one column horizontally, one row vertically).',
  '',
  inventory('Components', COMPONENTS),
  '',
  inventory('APIs', APIS),
  '',
  styleTable('layout'),
  '',
  styleTable('view'),
  '',
  styleTable('text'),
  '',
  styleTable('image'),
  '',
].join('\n');

const target = fileURLToPath(new URL('../docs/compat.md', import.meta.url));
writeFileSync(target, document);
console.log(`Wrote ${target}`);
