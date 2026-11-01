import { createContext, useContext, type ReactNode } from 'react';
import { Box, useInput, useStdin } from 'ink';
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
  content: ReactNode;
  onRequestClose?: () => void;
}

/** Stable actions (never changes identity, so Modals don't re-render when layers change). */
export interface ModalHost {
  upsert(layer: ModalLayer): void;
  remove(id: string): void;
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

/** Renders open modals over the app, each filling the terminal window. Esc closes the top one. */
export function ModalOutlet() {
  const layers = useContext(ModalLayersContext);
  const { rows } = useTerminalSize();
  const { isRawModeSupported } = useStdin();
  const top = layers[layers.length - 1];
  useInput(
    (_input, key) => {
      if (key.escape) top?.onRequestClose?.();
    },
    { isActive: Boolean(top) && isRawModeSupported },
  );
  return (
    <>
      {layers.map((layer, index) => (
        <FocusScopeContext.Provider key={layer.id} value={index === layers.length - 1}>
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height={rows}
            flexDirection="column"
            backgroundColor={layer.transparent ? undefined : CLEAR_BACKGROUND}
          >
            {layer.content}
          </Box>
        </FocusScopeContext.Provider>
      ))}
    </>
  );
}
