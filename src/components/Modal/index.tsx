import { useContext, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createSyntheticEvent, type NativeSyntheticEvent } from '../../internal/events.js';
import { ModalHostContext } from '../../internal/modalHost.js';
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

/**
 * Shows content above the app, filling the terminal window. Focus is limited to the top modal;
 * Esc calls `onRequestClose`.
 *
 * Note: the content renders at the app root, so React context from the Modal's ancestors is not
 * available inside it. Provide it with `AppRegistry.setWrapperComponentProvider` or wrap the
 * modal content itself.
 */
export function Modal(props: ModalProps) {
  const { visible = true, transparent = false, onShow, onDismiss, children } = props;
  const host = useContext(ModalHostContext);
  const id = useId();
  const latest = useRef(props);
  latest.current = props;

  useLayoutEffect(() => {
    if (!host) return;
    if (visible) {
      host.upsert({
        id,
        transparent,
        content: children,
        onRequestClose: () => latest.current.onRequestClose?.(createSyntheticEvent('requestClose', {})),
      });
    } else {
      host.remove(id);
    }
  });

  useEffect(() => () => host?.remove(id), [host, id]);

  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) onShow?.(createSyntheticEvent('show', {}));
    if (!visible && wasVisible.current) onDismiss?.();
    wasVisible.current = visible;
  }, [visible, onShow, onDismiss]);

  if (host || !visible) return null;
  // Without an app root (e.g. a bare Ink render), render in place.
  const fallbackStyle: ViewProps['style'] = { position: 'absolute', top: 0, left: 0, right: 0 };
  return <View style={fallbackStyle}>{children}</View>;
}
