import type { ReactNode } from 'react';
import {
  render as inkRender,
  renderToString as inkRenderToString,
  type Instance,
  type RenderOptions,
  type RenderToStringOptions,
} from 'ink';
import { AppRoot } from './internal/AppRoot.js';

let nextRootTag = 1;

/** Allocates a root tag for a new app instance. */
export const allocateRootTag = (): number => nextRootTag++;

/**
 * Renders a React element in the terminal (like Ink's `render`), wrapped in the app root that
 * powers Modal, Alert, BackHandler, Keyboard and Dimensions. Returns Ink's instance.
 */
export function render(
  node: ReactNode,
  options?: RenderOptions | NodeJS.WriteStream,
  rootTag: number = allocateRootTag(),
  outlet = true,
): Instance {
  return inkRender(
    <AppRoot rootTag={rootTag} outlet={outlet}>
      {node}
    </AppRoot>,
    options,
  );
}

/** Renders a React element to a string synchronously (no terminal needed). */
export function renderToString(node: ReactNode, options?: RenderToStringOptions): string {
  return inkRenderToString(<AppRoot>{node}</AppRoot>, options);
}

export type { Instance, RenderOptions, RenderToStringOptions };
