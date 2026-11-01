/**
 * Whether the terminal can display Unicode box-drawing and symbol characters.
 * Mirrors the heuristics of `is-unicode-supported`, plus an explicit override:
 * set `RN_INK_ASCII=1` to force ASCII glyphs.
 */
export function isUnicodeSupported(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.RN_INK_ASCII === '1' || env.RN_INK_ASCII === 'true') {
    return false;
  }
  const { TERM, TERM_PROGRAM } = env;
  if (TERM === 'dumb') {
    return false;
  }
  if (process.platform !== 'win32') {
    return TERM !== 'linux'; // The Linux kernel console has very limited glyphs.
  }
  return (
    Boolean(env.WT_SESSION) || // Windows Terminal
    Boolean(env.TERMINUS_SUBLIME) ||
    env.ConEmuTask === '{cmd::Cmder}' ||
    TERM_PROGRAM === 'Terminus-Sublime' ||
    TERM_PROGRAM === 'vscode' ||
    TERM === 'xterm-256color' ||
    TERM === 'alacritty' ||
    TERM === 'rxvt-unicode' ||
    TERM === 'rxvt-unicode-256color' ||
    env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
  );
}
