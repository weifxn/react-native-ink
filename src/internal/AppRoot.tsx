import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  Box,
  useApp,
  useFocusManager,
  useInput,
  useIsScreenReaderEnabled,
  useStdin,
  useStdout,
} from 'ink';
import { dispatchBackPress, hasBackHandlers, subscribeBackHandlers } from '../apis/BackHandler.js';
import { DialogHost, ToastHost } from '../apis/dialogs.js';
import { RootTagContext } from './contexts.js';
import {
  AppContent,
  ModalHostContext,
  ModalLayersContext,
  ModalOutlet,
  type ModalHost,
  type ModalLayer,
} from './modalHost.js';
import { registerRoot } from './root.js';
import { pageScroller, type ScrollAction } from './scrollers.js';
import { useTerminalSize } from './useTerminalSize.js';

export interface AppRootProps {
  children?: ReactNode;
  rootTag?: number;
  /**
   * Render the app content and modal outlet here (default). AppRegistry passes false and places
   * them inside the wrapper component instead, so wrapper providers also reach modal content.
   */
  outlet?: boolean;
}

/**
 * Wraps every app rendered through `render`/`AppRegistry`: provides root contexts, hosts
 * modals, alerts and toasts, maps Esc to BackHandler, and lets imperative APIs (Keyboard,
 * Dimensions, AccessibilityInfo, ...) reach the running Ink instance.
 */
export function AppRoot({ children, rootTag = 0, outlet = true }: AppRootProps) {
  const { exit } = useApp();
  const { activeId, disableFocus, enableFocus } = useFocusManager();
  const { stdout } = useStdout();
  const { isRawModeSupported } = useStdin();
  const { rows } = useTerminalSize();
  const isScreenReaderEnabled = useIsScreenReaderEnabled();

  useEffect(
    () =>
      registerRoot({
        exit: (error?: Error) => exit(error),
        blur: () => {
          disableFocus();
          enableFocus();
        },
        stdout: stdout as NodeJS.WriteStream,
        isScreenReaderEnabled,
      }),
    [exit, disableFocus, enableFocus, stdout, isScreenReaderEnabled],
  );

  const [layers, setLayers] = useState<ModalLayer[]>([]);
  const upsert = useCallback((layer: ModalLayer) => {
    setLayers((previous) => {
      const index = previous.findIndex((entry) => entry.id === layer.id);
      if (index === -1) return [...previous, layer];
      const next = [...previous];
      next[index] = layer;
      return next;
    });
  }, []);
  const remove = useCallback((id: string) => {
    setLayers((previous) =>
      previous.some((entry) => entry.id === id)
        ? previous.filter((entry) => entry.id !== id)
        : previous,
    );
  }, []);
  const host = useMemo<ModalHost>(() => ({ upsert, remove }), [upsert, remove]);

  // Esc → BackHandler, unless it blurred a focused component or a modal is open.
  const backHandlersActive = useSyncExternalStore(
    subscribeBackHandlers,
    hasBackHandlers,
    hasBackHandlers,
  );
  const focusedBeforeInput = useRef(activeId);
  focusedBeforeInput.current = activeId;
  useInput(
    (_input, key) => {
      if (key.escape && focusedBeforeInput.current === undefined) dispatchBackPress();
    },
    { isActive: backHandlersActive && layers.length === 0 && isRawModeSupported },
  );

  // With nothing focused, the arrow and page keys scroll the page: the outermost vertical
  // ScrollView (one inside an open modal, when there is one), as in a browser.
  useInput(
    (_input, key) => {
      if (focusedBeforeInput.current !== undefined) return;
      const action: ScrollAction | undefined = key.upArrow
        ? 'up'
        : key.downArrow
          ? 'down'
          : key.pageUp
            ? 'pageUp'
            : key.pageDown
              ? 'pageDown'
              : key.home
                ? 'home'
                : key.end
                  ? 'end'
                  : undefined;
      if (action) pageScroller()?.scroll(action);
    },
    { isActive: isRawModeSupported },
  );

  return (
    <RootTagContext.Provider value={rootTag}>
      <ModalHostContext.Provider value={host}>
        <ModalLayersContext.Provider value={layers}>
          <Box
            flexDirection="column"
            flexShrink={0}
            minHeight={layers.length > 0 ? rows : undefined}
          >
            {outlet ? (
              <>
                <AppContent>{children}</AppContent>
                <ModalOutlet />
              </>
            ) : (
              children
            )}
            <DialogHost />
            <ToastHost />
          </Box>
        </ModalLayersContext.Provider>
      </ModalHostContext.Provider>
    </RootTagContext.Provider>
  );
}
