import { afterEach, beforeEach, vi } from 'vitest';
import { resetDialogs } from '../src/apis/dialogs.js';
import { setCellSize } from '../src/internal/units.js';
import { resetWarnings } from '../src/internal/warn.js';

// Deterministic glyphs regardless of the machine running the tests.
process.env.TERM = 'xterm-256color';
delete process.env.RN_INK_ASCII;

beforeEach(() => {
  resetWarnings();
  resetDialogs();
});

afterEach(() => {
  vi.restoreAllMocks();
  setCellSize(null);
});
