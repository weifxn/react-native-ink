import { useEffect, type ReactNode } from 'react';
import { Box, useApp, useFocusManager, useIsScreenReaderEnabled, useStdout } from 'ink';
import { RootTagContext } from './contexts.js';
import { registerRoot } from './root.js';

export interface AppRootProps {
  children?: ReactNode;
  rootTag?: number;
}

/**
 * Wraps every app rendered through `render`/`AppRegistry`: provides root contexts and lets
 * imperative APIs (BackHandler, Keyboard, Dimensions, ...) reach the running Ink instance.
 */
export function AppRoot({ children, rootTag = 0 }: AppRootProps) {
  const { exit } = useApp();
  const { disableFocus, enableFocus } = useFocusManager();
  const { stdout } = useStdout();
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

  return (
    <RootTagContext.Provider value={rootTag}>
      <Box flexDirection="column" flexShrink={0}>
        {children}
      </Box>
    </RootTagContext.Provider>
  );
}
