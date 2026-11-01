import { EventEmitter as NodeEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import {
  Animated,
  AppRegistry,
  AppState,
  AssetRegistry,
  Clipboard,
  DevSettings,
  DeviceInfo,
  Dimensions,
  DrawerLayoutAndroid,
  Easing,
  EventEmitter,
  I18nManager,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  NativeComponentRegistry,
  Networking,
  PanResponder,
  PermissionsAndroid,
  Platform,
  PushNotificationIOS,
  SafeAreaView,
  Share,
  StatusBar,
  Systrace,
  Text,
  UTFSequence,
  Vibration,
  View,
  codegenNativeComponent,
  experimental_LayoutConformance,
  findNodeHandle,
  unstable_VirtualArray,
  unstable_VirtualView,
  unstable_createVirtualCollectionView,
  unstable_getScrollParent,
  usePressability,
  type HostInstance,
  type LayoutChangeEvent,
} from '../src/index.js';
import { registerRoot } from '../src/internal/root.js';
import { isUnicodeSupported } from '../src/internal/terminal.js';
import { renderInteractive, renderText, tick, waitFor } from './helpers.js';

afterEach(() => {
  cleanup();
});

/** Registers a fake app root with a TTY-like stdout. */
function fakeRoot() {
  const stdout = Object.assign(new NodeEmitter(), {
    isTTY: true,
    columns: 100,
    rows: 30,
    writes: [] as string[],
    write(data: string) {
      this.writes.push(data);
      return true;
    },
    getColorDepth: () => 24,
  });
  const handle = {
    exit: vi.fn(),
    blur: vi.fn(),
    stdout: stdout as unknown as NodeJS.WriteStream,
    isScreenReaderEnabled: false,
  };
  const unregister = registerRoot(handle);
  return { stdout, handle, unregister };
}

describe('measure methods', () => {
  it('measures views relative to the parent, the window and another view', async () => {
    const outer: { current: HostInstance | null } = { current: null };
    const inner: { current: HostInstance | null } = { current: null };
    const layouts: LayoutChangeEvent['nativeEvent']['layout'][] = [];
    renderInteractive(
      <View ref={outer} style={{ padding: 1, width: 20 }}>
        <View
          ref={inner}
          style={{ marginLeft: 2, width: 5, height: 2 }}
          onLayout={(event) => layouts.push(event.nativeEvent.layout)}
        />
      </View>,
    );
    await tick();
    await waitFor(() => expect(layouts.at(-1)).toEqual({ x: 3, y: 1, width: 5, height: 2 }));

    const measured = await new Promise<number[]>((resolve) =>
      inner.current!.measure((...values) => resolve(values)),
    );
    expect(measured).toEqual([3, 1, 5, 2, 3, 1]);
    const inWindow = await new Promise<number[]>((resolve) =>
      inner.current!.measureInWindow((...values) => resolve(values)),
    );
    expect(inWindow).toEqual([3, 1, 5, 2]);
    const relative = await new Promise<number[]>((resolve) =>
      inner.current!.measureLayout(outer.current, (...values) => resolve(values)),
    );
    expect(relative).toEqual([3, 1, 5, 2]);
    const failed = vi.fn();
    inner.current!.measureLayout(null, () => {}, failed);
    await tick(10);
    expect(failed).toHaveBeenCalledOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    inner.current!.setNativeProps({});
    expect(warn).toHaveBeenCalledOnce();
  });

  it('exposes measure on Text refs', async () => {
    const ref: { current: HostInstance | null } = { current: null };
    renderInteractive(<Text ref={ref}>hello</Text>);
    await tick();
    const size = await new Promise<number[]>((resolve) =>
      ref.current!.measure((_x, _y, width, height) => resolve([width, height])),
    );
    expect(size[1]).toBe(1);
  });
});

describe('terminal detection', () => {
  it('detects Unicode support', () => {
    expect(isUnicodeSupported({ TERM: 'xterm-256color' })).toBe(
      process.platform !== 'win32' || true,
    );
    expect(isUnicodeSupported({ TERM: 'dumb' })).toBe(false);
    expect(isUnicodeSupported({ RN_INK_ASCII: '1', TERM: 'xterm-256color' })).toBe(false);
    if (process.platform !== 'win32') expect(isUnicodeSupported({ TERM: 'linux' })).toBe(false);
  });
});

describe('APIs that use the running app', () => {
  it('rings the bell, copies with OSC 52 and dismisses the keyboard', () => {
    const { stdout, handle, unregister } = fakeRoot();
    try {
      Vibration.vibrate();
      Clipboard.setString('hi');
      expect(stdout.writes).toEqual([
        '\u0007',
        `\u001B]52;c;${Buffer.from('hi').toString('base64')}\u0007`,
      ]);
      Keyboard.dismiss();
      expect(handle.blur).toHaveBeenCalledOnce();
    } finally {
      unregister();
    }
  });

  it('reads dimensions and platform constants from the app stdout', () => {
    const { stdout, unregister } = fakeRoot();
    try {
      expect(Dimensions.get('window')).toEqual({ width: 100, height: 30, scale: 1, fontScale: 1 });
      const handler = vi.fn();
      const subscription = Dimensions.addEventListener('change', handler);
      stdout.columns = 120;
      stdout.emit('resize');
      expect(handler).toHaveBeenCalledWith({
        window: { width: 120, height: 30, scale: 1, fontScale: 1 },
        screen: { width: 120, height: 30, scale: 1, fontScale: 1 },
      });
      subscription.remove();
      expect(Platform.constants).toMatchObject({ isTTY: true, colorDepth: 24 });
      expect(DeviceInfo.getConstants().Dimensions.window.width).toBe(120);
    } finally {
      unregister();
    }
  });
});

describe('stub APIs are safe', () => {
  it('no-ops and placeholders', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const done = vi.fn();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut, done);
    LayoutAnimation.easeInEaseOut();
    await tick(5);
    expect(done).toHaveBeenCalledOnce();
    expect(LayoutAnimation.create(200).duration).toBe(200);
    expect(PanResponder.create({}).panHandlers).toEqual({});
    await expect(PermissionsAndroid.check('camera')).resolves.toBe(false);
    await expect(PermissionsAndroid.request('camera')).resolves.toBe('denied');
    await expect(PermissionsAndroid.requestMultiple(['a'])).resolves.toEqual({ a: 'denied' });
    PushNotificationIOS.requestPermissions?.();
    expect(Systrace.isEnabled()).toBe(false);
    Systrace.beginEvent('x');
    Systrace.endEvent();
    expect(UTFSequence.BULLET).toBe('•');
    expect(usePressability({})).toEqual({});
    expect(unstable_getScrollParent(null)).toBeNull();
    expect(findNodeHandle(undefined)).toBeNull();
    const id = AssetRegistry.registerAsset({ name: 'logo' });
    expect(AssetRegistry.getAssetByID(id)).toEqual({ name: 'logo' });
    Networking.sendRequest();
    const cookies = vi.fn();
    Networking.clearCookies(cookies);
    expect(cookies).toHaveBeenCalledWith(false);
    expect(() => NativeComponentRegistry.get('X')).toThrow();
    expect(() => codegenNativeComponent('X')).toThrow();
    DevSettings.reload();
    I18nManager.forceRTL(true);
    expect(I18nManager.getConstants().isRTL).toBe(false);
    AppState.addEventListener('change', () => {}).remove();
    await expect(Share.share({ message: 'x' })).resolves.toEqual({ action: 'dismissedAction' });
    StatusBar.setHidden(true);
    expect(StatusBar.pushStackEntry({ hidden: true })).toEqual({ hidden: true });
    expect(warn).toHaveBeenCalled();
  });

  it('renders pass-through components', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Lowercase exports must be aliased to capitalized names for JSX (as in React Native).
    const LayoutConformance = experimental_LayoutConformance;
    const VirtualView = unstable_VirtualView;
    const VirtualArray = unstable_VirtualArray;
    expect(
      renderText(
        <View>
          <SafeAreaView>
            <Text>safe</Text>
          </SafeAreaView>
          <KeyboardAvoidingView behavior="padding">
            <Text>avoid</Text>
          </KeyboardAvoidingView>
          <StatusBar hidden />
          <InputAccessoryView />
          <DrawerLayoutAndroid renderNavigationView={() => <Text>drawer</Text>}>
            <Text>main</Text>
          </DrawerLayoutAndroid>
          <LayoutConformance>
            <Text>conform</Text>
          </LayoutConformance>
          <VirtualView>
            <Text>virtual</Text>
          </VirtualView>
          <VirtualArray />
        </View>,
      ),
    ).toBe('safe\navoid\nmain\nconform\nvirtual');
    const Collection = unstable_createVirtualCollectionView();
    expect(renderText(<Collection />)).toBe('');
    expect(warn).toHaveBeenCalled();
  });
});

describe('EventEmitter', () => {
  it('binds context, counts and removes listeners', () => {
    const emitter = new EventEmitter();
    const context = { hits: 0 };
    emitter.addListener(
      'tick',
      function (this: typeof context) {
        this.hits++;
      },
      context,
    );
    emitter.emit('tick');
    expect(context.hits).toBe(1);
    expect(emitter.listenerCount('tick')).toBe(1);
    emitter.removeAllListeners('tick');
    expect(emitter.listenerCount('tick')).toBe(0);
    emitter.addListener('other', () => {});
    emitter.removeAllListeners();
    expect(emitter.listenerCount('other')).toBe(0);
  });
});

describe('AppRegistry extras', () => {
  it('registers sections and applies the instrumentation hook', () => {
    const Section = () => <Text>section</Text>;
    AppRegistry.registerSection('section', () => Section);
    expect(AppRegistry.getSectionKeys()).toContain('section');
    expect(Object.keys(AppRegistry.getSections())).toContain('section');
    expect(AppRegistry.getRegistry().sections).toContain('section');
    AppRegistry.setComponentProviderInstrumentationHook((provider) => {
      const Component = provider();
      return (props: object) => (
        <View style={{ borderWidth: 1, alignSelf: 'flex-start' }}>
          <Component {...props} />
        </View>
      );
    });
    try {
      expect(AppRegistry.getApplication('section').toString(20)).toBe(
        '┌───────┐\n│section│\n└───────┘',
      );
    } finally {
      AppRegistry.setComponentProviderInstrumentationHook((provider) => provider());
    }
  });
});

describe('Easing extras', () => {
  it('covers the remaining curves', () => {
    expect(Easing.sin(1)).toBeCloseTo(1);
    expect(Easing.circle(1)).toBe(1);
    expect(Easing.exp(1)).toBe(1);
    expect(Easing.elastic(1)(1)).toBeCloseTo(1);
    expect(Easing.back()(1)).toBeCloseTo(1);
    expect(Easing.bounce(0.1)).toBeCloseTo(0.075625);
    expect(Easing.bounce(0.5)).toBeCloseTo(0.765625);
    expect(Easing.bounce(0.8)).toBeCloseTo(0.94);
    expect(Easing.in(Easing.quad)(0.5)).toBe(0.25);
    expect(Easing.bezier(0, 0, 1, 1)(0.3)).toBe(0.3);
    expect(Easing.bezier(0.9, 0.1, 0.1, 0.9)(0.5)).toBeCloseTo(0.5, 2);
    expect(() => Easing.bezier(2, 0, 1, 1)).toThrow();
  });
});

describe('Animated extras', () => {
  const run = (animation: Animated.CompositeAnimation) =>
    new Promise<Animated.EndResult>((resolve) => animation.start(resolve));

  it('supports offsets, stopping and resetting on ValueXY and Color', () => {
    const xy = new Animated.ValueXY({ x: 1, y: 1 });
    xy.setOffset({ x: 10, y: 20 });
    expect(xy.__getValue()).toEqual({ x: 11, y: 21 });
    xy.flattenOffset();
    xy.extractOffset();
    expect(xy.__getValue()).toEqual({ x: 11, y: 21 });
    const stopped = vi.fn();
    xy.stopAnimation(stopped);
    expect(stopped).toHaveBeenCalledWith({ x: 11, y: 21 });
    xy.resetAnimation();
    expect(xy.x._value).toBe(1);
    const color = new Animated.Color({ r: 10, g: 20, b: 30, a: 1 });
    color.setOffset({ r: 1, g: 1, b: 1, a: 0 });
    color.flattenOffset();
    color.extractOffset();
    color.stopAnimation();
    color.resetAnimation();
    // Like React Native, resetAnimation restores the starting value but keeps the offset.
    expect(color.r._value).toBe(10);
    const value = new Animated.Value(3);
    value.extractOffset();
    expect(value.__getValue()).toBe(3);
    value.addListener(() => {});
    expect(value.hasListeners()).toBe(true);
    value.removeAllListeners();
    expect(value.hasListeners()).toBe(false);
  });

  it('accepts spring configs and decays ValueXY', async () => {
    const tension = new Animated.Value(0);
    await run(
      Animated.spring(tension, { toValue: 1, tension: 200, friction: 30, useNativeDriver: false }),
    );
    expect(tension.__getValue()).toBe(1);
    const bouncy = new Animated.Value(0);
    await run(
      Animated.spring(bouncy, { toValue: 1, bounciness: 0, speed: 40, useNativeDriver: false }),
    );
    expect(bouncy.__getValue()).toBe(1);
    const xy = new Animated.ValueXY();
    await run(
      Animated.spring(xy, {
        toValue: { x: 1, y: 1 },
        stiffness: 900,
        damping: 60,
        useNativeDriver: false,
      }),
    );
    expect(xy.__getValue()).toEqual({ x: 1, y: 1 });
    const flung = new Animated.ValueXY();
    const result = await run(
      Animated.decay(flung, {
        velocity: { x: 0.2, y: -0.2 },
        deceleration: 0.9,
        useNativeDriver: false,
      }),
    );
    expect(result.finished).toBe(true);
  });

  it('stops parallel and looped animations', async () => {
    const a = new Animated.Value(0);
    const b = new Animated.Value(0);
    const both = Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 1000, useNativeDriver: false }),
      Animated.timing(b, { toValue: 1, duration: 1000, useNativeDriver: false }),
    ]);
    const pending = run(both);
    await tick(30);
    both.stop();
    expect((await pending).finished).toBe(false);
    both.reset();
    const forever = Animated.loop(
      Animated.timing(a, { toValue: 1, duration: 20, useNativeDriver: false }),
    );
    const looping = run(forever);
    await tick(60);
    forever.stop();
    expect((await looping).finished).toBe(false);
    forever.reset();
  });

  it('forks events and attaches native events', () => {
    const first = vi.fn();
    const second = vi.fn();
    Animated.forkEvent(first, second)('event');
    expect(first).toHaveBeenCalledWith('event');
    expect(second).toHaveBeenCalledWith('event');
    expect(Animated.forkEvent(undefined, second)).toBe(second);
    expect(() => Animated.attachNativeEvent(null, 'onScroll', []).detach()).not.toThrow();
  });
});

describe('Image extras', () => {
  it('resolves asset sources', () => {
    expect(Image.resolveAssetSource({ uri: 'a.png', width: 2, height: 3 })).toEqual({
      uri: 'a.png',
      width: 2,
      height: 3,
      scale: 1,
    });
    expect(Image.resolveAssetSource(1)).toBeNull();
  });
});
