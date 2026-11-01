import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  type DOMElement,
} from 'ink';
import { dispatchBackPress, hasBackHandlers, subscribeBackHandlers } from '../apis/BackHandler.js';
import { DialogHost, ToastHost } from '../apis/dialogs.js';
import { RootTagContext } from './contexts.js';
import {
  AppContent,
  createFrames,
  ModalHostContext,
  ModalLayersContext,
  ModalOutlet,
  type ModalHost,
  type ModalLayer,
} from './modalHost.js';
import { mouseSourceFor } from './mouse.js';
import { createPointerDispatcher } from './mouseDispatch.js';
import { registerRoot } from './root.js';
import { pageScroller, type ScrollAction } from './scrollers.js';
import { useTerminalSize } from './useTerminalSize.js';

export interface AppRootProps {
  children?: ReactNode;
  rootTag?: number;
}

/**
 * Wraps every app rendered through `render`/`AppRegistry`: provides root contexts, hosts
 * modals, alerts and toasts, maps Esc to BackHandler, and lets imperative APIs (Keyboard,
 * Dimensions, AccessibilityInfo, ...) reach the running Ink instance.
 */
export function AppRoot({ children, rootTag = 0 }: AppRootProps) {
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
      // A Modal re-renders its content through its own portal; only its options reach here.
      if (previous[index]!.transparent === layer.transparent) return previous;
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
  const host = useMemo<ModalHost>(() => ({ upsert, remove, ...createFrames() }), [upsert, remove]);

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

  // The mouse, when `render` was asked for it: clicks and the wheel, hit-tested from Ink's root.
  const rootRef = useRef<DOMElement>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useLayoutEffect(() => {
    const source = mouseSourceFor(rootTag);
    if (!source) return undefined;
    const dispatcher = createPointerDispatcher({
      node: () => rootRef.current?.parentNode,
      rows: () => rowsRef.current,
      fromTop: source.fromTop,
      blur: () => {
        if (focusedBeforeInput.current === undefined) return;
        disableFocus();
        enableFocus();
      },
    });
    const unsubscribe = source.subscribe((event) => dispatcher.dispatch(event));
    return () => {
      unsubscribe();
      dispatcher.dispose();
    };
  }, [rootTag, disableFocus, enableFocus]);
  // Ink unmounts on a signal before the process dies, which runs this synchronously.
  useLayoutEffect(() => () => mouseSourceFor(rootTag)?.stop(), [rootTag]);

  return (
    <RootTagContext.Provider value={rootTag}>
      <ModalHostContext.Provider value={host}>
        <ModalLayersContext.Provider value={layers}>
          <Box
            ref={rootRef}
            flexDirection="column"
            flexShrink={0}
            minHeight={layers.length > 0 ? rows : undefined}
          >
            <AppContent>{children}</AppContent>
            <ModalOutlet />
            <DialogHost />
            <ToastHost />
          </Box>
        </ModalLayersContext.Provider>
      </ModalHostContext.Provider>
    </RootTagContext.Provider>
  );
}
