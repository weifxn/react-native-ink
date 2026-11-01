import { describe, expect, it, vi } from 'vitest';
import {
  AppRegistry,
  Appearance,
  Clipboard,
  DeviceEventEmitter,
  Dimensions,
  DynamicColorIOS,
  I18nManager,
  Keyboard,
  Linking,
  LogBox,
  NativeEventEmitter,
  NativeModules,
  PixelRatio,
  Platform,
  PlatformColor,
  Settings,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
  processColor,
  requireNativeComponent,
  useWindowDimensions,
} from '../src/index.js';
import { warnOnce } from '../src/internal/warn.js';
import { detectColorScheme } from '../src/apis/Appearance.js';
import { FakeStdin, FakeStdout, renderText, tick } from './helpers.js';

describe('AppRegistry', () => {
  it('registers, runs with initialProps and returns the Ink instance', async () => {
    const Greeting = ({ name }: { name: string }) => <Text>Hello, {name}!</Text>;
    AppRegistry.registerComponent('greeting', () => Greeting);
    expect(AppRegistry.getAppKeys()).toContain('greeting');

    const stdout = new FakeStdout();
    const app = AppRegistry.runApplication('greeting', {
      initialProps: { name: 'terminal' },
      stdout: stdout as never,
      stdin: new FakeStdin() as never,
      debug: true,
      patchConsole: false,
    });
    await tick();
    expect(stdout.lastFrame).toContain('Hello, terminal!');
    expect(typeof app.rootTag).toBe('number');
    app.unmount();
    await app.waitUntilExit();
  });

  it('wraps the root with setWrapperComponentProvider and supports setSurfaceProps', async () => {
    const Frame = ({ children }: { children?: React.ReactNode }) => (
      <View style={{ borderWidth: 1, alignSelf: 'flex-start' }}>{children}</View>
    );
    AppRegistry.setWrapperComponentProvider(() => Frame);
    const Count = ({ n }: { n: number }) => <Text>n={n}</Text>;
    AppRegistry.registerComponent('count', () => Count);
    const stdout = new FakeStdout();
    const app = AppRegistry.runApplication('count', {
      initialProps: { n: 1 },
      stdout: stdout as never,
      stdin: new FakeStdin() as never,
      debug: true,
      patchConsole: false,
    });
    await tick();
    expect(stdout.lastFrame).toContain('│n=1│');
    AppRegistry.setSurfaceProps('count', { initialProps: { n: 2 } });
    await tick();
    expect(stdout.lastFrame).toContain('│n=2│');
    AppRegistry.unmountApplicationComponentAtRootTag(app.rootTag);
    AppRegistry.setWrapperComponentProvider(() => null);
  });

  it('renders registered apps to strings with getApplication', () => {
    AppRegistry.registerComponent('static', () => () => <Text>static output</Text>);
    expect(AppRegistry.getApplication('static').toString(30)).toBe('static output');
  });

  it('throws for unknown apps', () => {
    expect(() => AppRegistry.runApplication('missing')).toThrow(/"missing" has not been registered/);
  });

  it('supports runnables and configs', () => {
    const run = vi.fn();
    AppRegistry.registerConfig([{ appKey: 'runnable', run }]);
    AppRegistry.runApplication('runnable', { initialProps: { a: 1 } });
    expect(run).toHaveBeenCalledWith({ initialProps: { a: 1 } });
    expect(AppRegistry.getRunnable('runnable')).toBeDefined();
  });
});

describe('StyleSheet', () => {
  it('creates, flattens and composes styles', () => {
    const styles = StyleSheet.create({ a: { width: 1 }, b: { height: 2 } });
    expect(styles.a).toEqual({ width: 1 });
    expect(StyleSheet.flatten([styles.a, styles.b, false])).toEqual({ width: 1, height: 2 });
    expect(StyleSheet.compose(styles.a, styles.b)).toEqual([styles.a, styles.b]);
    expect(StyleSheet.compose(styles.a, undefined)).toBe(styles.a);
    expect(StyleSheet.absoluteFill).toMatchObject({ position: 'absolute', left: 0, top: 0 });
    expect(StyleSheet.hairlineWidth).toBe(1);
  });
});

describe('Platform', () => {
  it("reports OS 'cli' and selects specifics", () => {
    expect(Platform.OS).toBe('cli');
    expect(Platform.select({ cli: 'terminal', ios: 'phone', default: 'other' })).toBe('terminal');
    expect(Platform.select({ ios: 'phone', default: 'other' })).toBe('other');
    expect(Platform.constants.reactNativeVersion.minor).toBe(88);
    expect(Platform.Version).toBe(process.versions.node);
  });
});

describe('Dimensions and PixelRatio', () => {
  it('reports the terminal size in cells', () => {
    const size = Dimensions.get('window');
    expect(size.scale).toBe(1);
    expect(size.width).toBeGreaterThan(0);
    const subscription = Dimensions.addEventListener('change', () => {});
    subscription.remove();
    expect(PixelRatio.get()).toBe(1);
    expect(PixelRatio.roundToNearestPixel(2.6)).toBe(3);
  });

  it('provides useWindowDimensions', () => {
    const Size = () => {
      const { width, height } = useWindowDimensions();
      return (
        <Text>
          {width}x{height}
        </Text>
      );
    };
    expect(renderText(<Size />)).toMatch(/^\d+x\d+$/);
  });
});

describe('colors', () => {
  it('exports processColor and PlatformColor', () => {
    expect(processColor('blue')).toBe(0xff0000ff);
    expect(renderText(<Text style={{ color: PlatformColor('redBright') }}>x</Text>)).toBe('x');
  });
});

describe('Appearance', () => {
  it('detects the scheme from COLORFGBG', () => {
    expect(detectColorScheme({ COLORFGBG: '15;0' })).toBe('dark');
    expect(detectColorScheme({ COLORFGBG: '0;15' })).toBe('light');
    expect(detectColorScheme({ COLORFGBG: '0;default;7' })).toBe('light');
    expect(detectColorScheme({})).toBeNull();
  });

  it('can be overridden and notifies listeners', () => {
    const listener = vi.fn();
    const subscription = Appearance.addChangeListener(listener);
    Appearance.setColorScheme('dark');
    expect(Appearance.getColorScheme()).toBe('dark');
    expect(listener).toHaveBeenCalledWith({ colorScheme: 'dark' });
    expect(DynamicColorIOS({ light: 'black', dark: 'white' })).toBe('white');
    Appearance.setColorScheme(null);
    subscription.remove();
  });
});

describe('event emitters', () => {
  it('delivers events through DeviceEventEmitter', () => {
    const listener = vi.fn();
    const subscription = new NativeEventEmitter().addListener('ping', listener);
    DeviceEventEmitter.emit('ping', 1, 2);
    expect(listener).toHaveBeenCalledWith(1, 2);
    subscription.remove();
    DeviceEventEmitter.emit('ping');
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('Linking', () => {
  it('validates URLs', async () => {
    await expect(Linking.canOpenURL('https://example.com')).resolves.toBe(true);
    await expect(Linking.canOpenURL('not a url')).resolves.toBe(false);
    await expect(Linking.openURL('-a Calculator')).rejects.toThrow(/Invalid URL/);
    await expect(Linking.getInitialURL()).resolves.toBeNull();
  });
});

describe('system APIs', () => {
  it('keeps layout left-to-right', () => {
    expect(I18nManager.isRTL).toBe(false);
  });

  it('filters warnings with LogBox', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    LogBox.ignoreLogs(['noisy']);
    warnOnce('a', 'a noisy warning');
    warnOnce('b', 'an important warning');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('important');
  });

  it('stores settings in memory and notifies watchers', () => {
    const watcher = vi.fn();
    const id = Settings.watchKeys('theme', watcher);
    Settings.set({ theme: 'dark' });
    expect(Settings.get('theme')).toBe('dark');
    expect(watcher).toHaveBeenCalledOnce();
    Settings.clearWatch(id);
  });

  it('remembers clipboard contents', async () => {
    Clipboard.setString('copied');
    await expect(Clipboard.getString()).resolves.toBe('copied');
  });

  it('keyboard APIs are safe without an app', () => {
    expect(Keyboard.isVisible()).toBe(false);
    expect(() => Keyboard.dismiss()).not.toThrow();
  });
});

describe('native stubs', () => {
  it('has no native modules and throws when native views are requested', () => {
    expect(NativeModules.Foo).toBeUndefined();
    expect(TurboModuleRegistry.get('Foo')).toBeNull();
    expect(() => TurboModuleRegistry.getEnforcing('Foo')).toThrow(/not available/);
    expect(() => requireNativeComponent('RCTView')).toThrow(/not available/);
  });
});
