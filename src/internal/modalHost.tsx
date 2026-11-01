import { createContext, useContext, useRef, type ReactNode } from 'react';
import { Box, useInput, useStdin, type DOMElement } from 'ink';
import { FocusScopeContext } from './contexts.js';
import { useTerminalSize } from './useTerminalSize.js';

/**
 * Ink fills a box's background with this "color" as plain spaces (it is not a known color),
 * which blanks whatever was drawn underneath without imposing a background color.
 */
export const CLEAR_BACKGROUND = 'default';

export interface ModalLayer {
  id: string;
  transparent: boolean;
  onRequestClose?: () => void;
}

/** Stable actions (never changes identity, so Modals don't re-render when layers change). */
export interface ModalHost {
  upsert(layer: ModalLayer): void;
  remove(id: string): void;
  /** The frame a layer's content renders into, once the outlet has drawn it. */
  frame(id: string): DOMElement | undefined;
  setFrame(id: string, node: DOMElement | null): void;
  subscribeFrames(listener: () => void): () => void;
}

/** The frames part of a ModalHost: a map of drawn frames that Modals subscribe to. */
export function createFrames(): Pick<ModalHost, 'frame' | 'setFrame' | 'subscribeFrames'> {
  const frames = new Map<string, DOMElement>();
  const listeners = new Set<() => void>();
  return {
    frame: (id) => frames.get(id),
    setFrame(id, node) {
      if (node ? frames.get(id) === node : !frames.has(id)) return;
      if (node) frames.set(id, node);
      else frames.delete(id);
      listeners.forEach((listener) => listener());
    },
    subscribeFrames(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const ModalHostContext = createContext<ModalHost | null>(null);
ModalHostContext.displayName = 'ModalHostContext';

/** The open modal layers, bottom to top. */
export const ModalLayersContext = createContext<readonly ModalLayer[]>([]);
ModalLayersContext.displayName = 'ModalLayersContext';

/** The app's own content: hidden behind opaque modals and out of the focus order while any modal is open. */
export function AppContent({ children }: { children?: ReactNode }) {
  const layers = useContext(ModalLayersContext);
  const parentScope = useContext(FocusScopeContext);
  const opaque = layers.some((layer) => !layer.transparent);
  return (
    <FocusScopeContext.Provider value={parentScope && layers.length === 0}>
      <Box flexDirection="column" flexShrink={0} display={opaque ? 'none' : 'flex'}>
        {children}
      </Box>
    </FocusScopeContext.Provider>
  );
}

/**
 * Draws a frame over the app for each open modal, filling the terminal window; each Modal
 * portals its content into its frame (see Modal). Esc closes the top one.
 */
export function ModalOutlet() {
  const layers = useContext(ModalLayersContext);
  const host = useContext(ModalHostContext);
  const { rows } = useTerminalSize();
  const { isRawModeSupported } = useStdin();
  const top = layers[layers.length - 1];
  useInput(
    (_input, key) => {
      if (key.escape) top?.onRequestClose?.();
    },
    { isActive: Boolean(top) && isRawModeSupported },
  );
  // One stable callback per layer, so a re-render doesn't detach and reattach every frame.
  const refs = useRef(new Map<string, (node: DOMElement | null) => void>());
  const refFor = (id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (node) => {
        host?.setFrame(id, node);
        if (!node) refs.current.delete(id);
      };
      refs.current.set(id, ref);
    }
    return ref;
  };
  return (
    <>
      {layers.map((layer) => (
        <Box
          key={layer.id}
          ref={refFor(layer.id)}
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height={rows}
          flexDirection="column"
          backgroundColor={layer.transparent ? undefined : CLEAR_BACKGROUND}
        />
      ))}
    </>
  );
}
