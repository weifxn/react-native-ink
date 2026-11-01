/**
 * react-native-ink: React Native's components and APIs for terminal apps, rendered with Ink.
 */

// Components
export { View } from './components/View/index.js';
export type { ViewProps, Insets } from './components/View/index.js';
export { Text } from './components/Text/index.js';
export type { TextProps } from './components/Text/index.js';
export {
  SafeAreaView,
  KeyboardAvoidingView,
  StatusBar,
  RefreshControl,
  InputAccessoryView,
  DrawerLayoutAndroid,
  experimental_LayoutConformance,
  unstable_VirtualView,
  unstable_NativeText,
  unstable_NativeView,
  unstable_VirtualArray,
  unstable_VirtualColumn,
  unstable_VirtualColumnGenerator,
  unstable_VirtualRow,
  unstable_createVirtualCollectionView,
} from './components/simple.js';
export type {
  KeyboardAvoidingViewProps,
  StatusBarProps,
  StatusBarStyle,
  RefreshControlProps,
  DrawerLayoutAndroidProps,
} from './components/simple.js';
export { TextAncestorContext as unstable_TextAncestorContext, RootTagContext } from './internal/contexts.js';
export { Pressable } from './components/Pressable/index.js';
export type {
  PressableProps,
  PressableStateCallbackType,
  PressableAndroidRippleConfig,
  FocusableInstance,
} from './components/Pressable/index.js';
export {
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  TouchableNativeFeedback,
} from './components/Touchable/index.js';
export type {
  TouchableOpacityProps,
  TouchableHighlightProps,
  TouchableWithoutFeedbackProps,
  TouchableNativeFeedbackProps,
} from './components/Touchable/index.js';
export { Button } from './components/Button/index.js';
export type { ButtonProps } from './components/Button/index.js';
export { Switch } from './components/Switch/index.js';
export type { SwitchProps, SwitchChangeEvent } from './components/Switch/index.js';
export { ActivityIndicator, ProgressBarAndroid } from './components/ActivityIndicator/index.js';
export type { ActivityIndicatorProps, ProgressBarAndroidProps } from './components/ActivityIndicator/index.js';
export { TextInput } from './components/TextInput/index.js';
export type {
  TextInputProps,
  TextInputInstance,
  TextInputChangeEvent,
  TextInputFocusEvent,
  TextInputSubmitEditingEvent,
  TextInputEndEditingEvent,
  TextInputKeyPressEvent,
  TextInputSelectionChangeEvent,
} from './components/TextInput/index.js';
export { ScrollView } from './components/ScrollView/index.js';
export type { ScrollViewProps, ScrollViewInstance, NativeScrollEvent } from './components/ScrollView/index.js';
export { FlatList, VirtualizedList, SectionList, VirtualizedSectionList } from './components/Lists/index.js';
export { Modal } from './components/Modal/index.js';
export type { ModalProps } from './components/Modal/index.js';
export type {
  FlatListProps,
  FlatListInstance,
  ListRenderItem,
  ListRenderItemInfo,
  VirtualizedListProps,
  SectionListProps,
  SectionListInstance,
  SectionListData,
  SectionListRenderItem,
  SectionListRenderItemInfo,
  SectionBase,
  DefaultSectionT,
  ViewToken,
} from './components/Lists/index.js';

// APIs
export { AppRegistry } from './apis/AppRegistry.js';
export type {
  AppConfig,
  AppInstance,
  AppParameters,
  ComponentProvider,
  ComponentProviderInstrumentationHook,
  Runnable,
  WrapperComponentProvider,
} from './apis/AppRegistry.js';
export { StyleSheet } from './apis/StyleSheet.js';
export { Platform, ReactNativeVersion } from './apis/Platform.js';
export type { PlatformOSType } from './apis/Platform.js';
export { Dimensions, PixelRatio, useWindowDimensions } from './apis/Dimensions.js';
export type { ScaledSize } from './apis/Dimensions.js';
export { Appearance, useColorScheme, DynamicColorIOS } from './apis/Appearance.js';
export type { ColorSchemeName } from './apis/Appearance.js';
export {
  EventEmitter,
  DeviceEventEmitter,
  NativeAppEventEmitter,
  NativeEventEmitter,
} from './apis/EventEmitter.js';
export type { EmitterSubscription, EventSubscription } from './apis/EventEmitter.js';
export { Linking } from './apis/Linking.js';
export { Alert, ActionSheetIOS, ToastAndroid } from './apis/dialogs.js';
export type { AlertButton, AlertOptions, AlertType, ActionSheetIOSOptions } from './apis/dialogs.js';
export { BackHandler } from './apis/BackHandler.js';
export { AccessibilityInfo } from './apis/AccessibilityInfo.js';
export {
  I18nManager,
  AppState,
  Keyboard,
  Vibration,
  LogBox,
  Clipboard,
  Share,
  Settings,
} from './apis/system.js';
export type { AppStateStatus, KeyboardEventName, ShareAction, ShareContent } from './apis/system.js';
export {
  NativeModules,
  TurboModuleRegistry,
  UIManager,
  requireNativeComponent,
  codegenNativeComponent,
  codegenNativeCommands,
  NativeComponentRegistry,
  findNodeHandle,
  registerCallableModule,
  AssetRegistry,
  Networking,
} from './apis/native.js';
export {
  DeviceInfo,
  DevMenu,
  DevSettings,
  LayoutAnimation,
  PanResponder,
  PermissionsAndroid,
  PushNotificationIOS,
  Systrace,
  UTFSequence,
  VirtualViewMode,
  usePressability,
  unstable_getScrollParent,
  unstable_DEFAULT_INITIAL_NUM_TO_RENDER,
} from './apis/misc.js';

// Colors
export { processColor } from './style/colors.js';
export { PlatformColor } from './apis/PlatformColor.js';

// Styles and event types
export type {
  AnyStyle,
  BorderStyle,
  ColorValue,
  DimensionValue,
  FlexStyle,
  FontWeight,
  ImageStyle,
  OpaqueColorValue,
  RegisteredStyle,
  ShadowStyleIOS,
  StyleProp,
  TextStyle,
  TransformsStyle,
  ViewStyle,
} from './style/types.js';
export type {
  GestureResponderEvent,
  LayoutChangeEvent,
  LayoutRectangle,
  NativeSyntheticEvent,
  NativeTouchEvent,
} from './internal/events.js';
export type {
  AccessibilityProps,
  AccessibilityRole,
  AccessibilityState,
  AccessibilityValue,
  Role,
} from './internal/accessibility.js';
export type { HostInstance, NativeMethods } from './internal/nativeMethods.js';

// Terminal extensions
export { render, renderToString } from './render.js';
export type { Instance, RenderOptions, RenderToStringOptions } from './render.js';
export * from './terminal/index.js';
