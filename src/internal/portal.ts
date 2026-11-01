import type { ReactNode, ReactPortal } from 'react';
import type { DOMElement } from 'ink';

const REACT_PORTAL_TYPE = Symbol.for('react.portal');

/**
 * React's portal for Ink's DOM: `children` render into `container` while staying where they are
 * in the React tree, so they keep their context. This is the object `react-dom`'s
 * `createPortal` builds; Ink's reconciler mounts it with its container methods, like any
 * react-reconciler renderer.
 */
export function createPortal(
  children: ReactNode,
  container: DOMElement,
  key: string | null = null,
): ReactPortal {
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key,
    children,
    containerInfo: container,
    implementation: null,
  } as unknown as ReactPortal;
}
