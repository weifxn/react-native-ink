import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  BackgroundColorContext,
  FocusScopeContext,
  ScrollIntoViewContext,
  TextAncestorContext,
  TextInheritanceContext,
  type TextInheritance,
} from '../../internal/contexts.js';
import { createSyntheticEvent, type NativeSyntheticEvent } from '../../internal/events.js';
import { ModalHostContext, ModalLayersContext } from '../../internal/modalHost.js';
import { createPortal } from '../../internal/portal.js';
import { ScrollDepthContext } from '../../internal/scrollers.js';
import { FlexDirectionContext } from '../../internal/units.js';
import type { ColorValue } from '../../style/types.js';
import type { ViewProps } from '../View/index.js';
import { View } from '../View/index.js';

export interface ModalProps {
  children?: ReactNode;
  /** Default true. */
  visible?: boolean;
  /** When false (default), the modal covers the app; when true, the app shows through empty cells. */
  transparent?: boolean;
  /** Called when the user presses Esc while this is the top modal. */
  onRequestClose?: (event: NativeSyntheticEvent<unknown>) => void;
  onShow?: (event: NativeSyntheticEvent<unknown>) => void;
  onDismiss?: () => void;
  /** @remarks Ignored in terminals. */
  animationType?: 'none' | 'slide' | 'fade';
  /** @remarks Ignored in terminals. */
  animated?: boolean;
  /** @remarks Ignored in terminals. */
  presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
  /** @remarks Ignored in terminals. */
  statusBarTranslucent?: boolean;
  /** @remarks Ignored in terminals. */
  navigationBarTranslucent?: boolean;
  /** @remarks Ignored in terminals. */
  hardwareAccelerated?: boolean;
  /** @remarks Ignored in terminals. */
  supportedOrientations?: string[];
  /** @remarks Ignored in terminals. */
  onOrientationChange?: (event: unknown) => void;
  /** @remarks Ignored in terminals. */
  backdropColor?: ColorValue;
  testID?: string;
}

const NO_TEXT: TextInheritance = { inText: false, dim: false, hidden: false, inverse: false };
const noFrames = () => () => {};

/**
 * The content starts afresh at the top of the window: what the library passes down for layout
 * (text styling, the ScrollView around it, the background behind it) doesn't carry into a
 * modal, while the app's own context does. Only the top modal takes focus.
 */
function ModalScope({ active, children }: { active: boolean; children?: ReactNode }) {
  return (
    <FocusScopeContext.Provider value={active}>
      <ScrollIntoViewContext.Provider value={null}>
        <ScrollDepthContext.Provider value={0}>
          <TextAncestorContext.Provider value={false}>
            <TextInheritanceContext.Provider value={NO_TEXT}>
              <FlexDirectionContext.Provider value="column">
                <BackgroundColorContext.Provider value={undefined}>
                  {children}
                </BackgroundColorContext.Provider>
              </FlexDirectionContext.Provider>
            </TextInheritanceContext.Provider>
          </TextAncestorContext.Provider>
        </ScrollDepthContext.Provider>
      </ScrollIntoViewContext.Provider>
    </FocusScopeContext.Provider>
  );
}

/**
 * Shows content above the app, filling the terminal window. Focus is limited to the top modal;
 * Esc calls `onRequestClose`. The content is drawn over the app but stays where it is in the
 * React tree (a portal), so context from the Modal's ancestors reaches it, as in React Native.
 */
export function Modal(props: ModalProps) {
  const { visible = true, transparent = false, onShow, onDismiss, children } = props;
  const host = useContext(ModalHostContext);
  const layers = useContext(ModalLayersContext);
  const id = useId();
  const latest = useRef(props);
  latest.current = props;

  useLayoutEffect(() => {
    if (!host) return;
    if (visible) {
      host.upsert({
        id,
        transparent,
        onRequestClose: () =>
          latest.current.onRequestClose?.(createSyntheticEvent('requestClose', {})),
      });
    } else {
      host.remove(id);
    }
  }, [host, id, visible, transparent]);

  const frame = useSyncExternalStore(
    host?.subscribeFrames ?? noFrames,
    () => host?.frame(id),
    () => host?.frame(id),
  );

  useEffect(() => () => host?.remove(id), [host, id]);

  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) onShow?.(createSyntheticEvent('show', {}));
    if (!visible && wasVisible.current) onDismiss?.();
    wasVisible.current = visible;
  }, [visible, onShow, onDismiss]);

  if (host) {
    if (!visible || !frame) return null;
    const active = layers[layers.length - 1]?.id === id;
    return createPortal(<ModalScope active={active}>{children}</ModalScope>, frame);
  }
  if (!visible) return null;
  // Without an app root (e.g. a bare Ink render), render in place.
  const fallbackStyle: ViewProps['style'] = { position: 'absolute', top: 0, left: 0, right: 0 };
  return <View style={fallbackStyle}>{children}</View>;
}
