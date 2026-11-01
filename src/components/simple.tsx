import type { ReactElement, ReactNode } from 'react';
import { warnOnce } from '../internal/warn.js';
import type { ColorValue, StyleProp, ViewStyle } from '../style/types.js';
import { Text } from './Text/index.js';
import { View, type ViewProps } from './View/index.js';

/** A plain View: terminals have no safe-area insets. */
export function SafeAreaView(props: ViewProps) {
  return <View {...props} />;
}

export interface KeyboardAvoidingViewProps extends ViewProps {
  /** @remarks Ignored in terminals (there is no on-screen keyboard). */
  behavior?: 'height' | 'position' | 'padding';
  contentContainerStyle?: StyleProp<ViewStyle>;
  enabled?: boolean;
  keyboardVerticalOffset?: number;
}

/** A plain View: there is no on-screen keyboard to avoid. */
export function KeyboardAvoidingView({
  behavior: _behavior,
  contentContainerStyle: _contentContainerStyle,
  enabled: _enabled,
  keyboardVerticalOffset: _offset,
  ...props
}: KeyboardAvoidingViewProps) {
  return <View {...props} />;
}

export type StatusBarStyle = 'default' | 'light-content' | 'dark-content';

export interface StatusBarProps {
  animated?: boolean;
  backgroundColor?: ColorValue;
  barStyle?: StatusBarStyle;
  hidden?: boolean;
  networkActivityIndicatorVisible?: boolean;
  showHideTransition?: 'fade' | 'slide' | 'none';
  translucent?: boolean;
}

/** Terminals have no status bar: renders nothing; static methods are no-ops. */
export function StatusBar(_props: StatusBarProps): null {
  return null;
}
StatusBar.currentHeight = 0;
StatusBar.setHidden = (_hidden: boolean, _animation?: string): void => {};
StatusBar.setBarStyle = (_style: StatusBarStyle, _animated?: boolean): void => {};
StatusBar.setBackgroundColor = (_color: ColorValue, _animated?: boolean): void => {};
StatusBar.setNetworkActivityIndicatorVisible = (_visible: boolean): void => {};
StatusBar.setTranslucent = (_translucent: boolean): void => {};
StatusBar.pushStackEntry = (props: StatusBarProps): StatusBarProps => props;
StatusBar.popStackEntry = (_entry: StatusBarProps): void => {};
StatusBar.replaceStackEntry = (_entry: StatusBarProps, props: StatusBarProps): StatusBarProps =>
  props;

export interface RefreshControlProps extends ViewProps {
  /** While true, a ScrollView/FlatList shows a spinner above its content. */
  refreshing: boolean;
  onRefresh?: () => void;
  colors?: ColorValue[];
  enabled?: boolean;
  progressBackgroundColor?: ColorValue;
  progressViewOffset?: number;
  size?: 'default' | 'large';
  tintColor?: ColorValue;
  title?: string;
  titleColor?: ColorValue;
}

/** Pass it as a ScrollView's `refreshControl`; it renders nothing by itself. */
export function RefreshControl(_props: RefreshControlProps): null {
  return null;
}

/** iOS keyboard accessory views have no terminal equivalent. */
export function InputAccessoryView(_props: {
  children?: ReactNode;
  nativeID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return null;
}

export interface DrawerLayoutAndroidProps extends ViewProps {
  renderNavigationView: () => ReactElement;
  drawerPosition?: 'left' | 'right';
  drawerWidth?: number;
  drawerLockMode?: 'unlocked' | 'locked-closed' | 'locked-open';
  drawerBackgroundColor?: ColorValue;
  onDrawerOpen?: () => void;
  onDrawerClose?: () => void;
  onDrawerSlide?: (event: unknown) => void;
  onDrawerStateChanged?: (state: 'Idle' | 'Dragging' | 'Settling') => void;
  keyboardDismissMode?: 'none' | 'on-drag';
  statusBarBackgroundColor?: ColorValue;
}

/** Renders the main content only; the swipe-out drawer has no terminal equivalent. */
export function DrawerLayoutAndroid({
  renderNavigationView: _renderNavigationView,
  ...props
}: DrawerLayoutAndroidProps) {
  warnOnce(
    'DrawerLayoutAndroid',
    'DrawerLayoutAndroid renders only its main content in terminals.',
  );
  return <View {...props} />;
}

/** Renders its children unchanged. */
export function experimental_LayoutConformance({
  children,
}: {
  children?: ReactNode;
  mode?: string;
}) {
  return <>{children}</>;
}

/** Renders its children in a View (no virtualization). */
export function unstable_VirtualView({ children, style, nativeID }: ViewProps & { mode?: number }) {
  return (
    <View style={style} nativeID={nativeID}>
      {children}
    </View>
  );
}

export const unstable_NativeText = Text;
export const unstable_NativeView = View;

function unsupportedComponent(name: string) {
  const Unsupported = (_props: Record<string, unknown>) => {
    warnOnce(name, `${name} is not supported in terminals and renders nothing.`);
    return null;
  };
  Unsupported.displayName = name;
  return Unsupported;
}

export const unstable_VirtualArray = unsupportedComponent('unstable_VirtualArray');
export const unstable_VirtualColumn = unsupportedComponent('unstable_VirtualColumn');
export const unstable_VirtualColumnGenerator = unsupportedComponent(
  'unstable_VirtualColumnGenerator',
);
export const unstable_VirtualRow = unsupportedComponent('unstable_VirtualRow');
export function unstable_createVirtualCollectionView(..._args: unknown[]) {
  return unsupportedComponent('VirtualCollectionView');
}
