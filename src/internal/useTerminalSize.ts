import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
}

const fromEnv = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Size of an output stream, falling back to $COLUMNS/$LINES and then 80×24 (never spawns processes). */
export function sizeOfStream(stream: { columns?: number; rows?: number }): TerminalSize {
  return {
    columns: stream.columns || fromEnv(process.env.COLUMNS, 80),
    rows: stream.rows || fromEnv(process.env.LINES, 24),
  };
}

/**
 * Terminal size that re-renders on resize. Unlike Ink's `useWindowSize`, it never shells out to
 * `tput`/`stty` when the stream doesn't report a size (pipes, CI, tests).
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => sizeOfStream(stdout as { columns?: number; rows?: number }));
  useEffect(() => {
    const update = () => {
      const next = sizeOfStream(stdout as { columns?: number; rows?: number });
      setSize((previous) =>
        previous.columns === next.columns && previous.rows === next.rows ? previous : next,
      );
    };
    update();
    stdout.on('resize', update);
    return () => {
      stdout.off('resize', update);
    };
  }, [stdout]);
  return size;
}
