import type { ComponentType, ReactElement } from 'react';
import { renderToString as inkRenderToString, type Instance, type RenderOptions } from 'ink';
import { AppRoot } from '../internal/AppRoot.js';
import { allocateRootTag, render } from '../render.js';

export type ComponentProvider = () => ComponentType<any>;
export type ComponentProviderInstrumentationHook = (component: ComponentProvider) => ComponentType<any>;
export type WrapperComponentProvider = (appParameters: any) => ComponentType<any> | null | undefined;
export type Runnable = (appParameters: AppParameters) => unknown;

export interface AppConfig {
  appKey: string;
  component?: ComponentProvider;
  run?: Runnable;
  section?: boolean;
}

/** `initialProps` for the root component, plus Ink's render options (stdout, stdin, exitOnCtrlC, ...). */
export interface AppParameters extends RenderOptions {
  initialProps?: Record<string, unknown>;
  rootTag?: number;
}

/** An Ink instance (`waitUntilExit`, `unmount`, `rerender`, ...) plus its root tag. */
export type AppInstance = Instance & { rootTag: number };

interface Registration {
  componentProvider?: ComponentProvider;
  run: Runnable;
}

const runnables = new Map<string, Registration>();
const sections = new Map<string, Registration>();
const instances = new Map<number, { appKey: string; instance: Instance }>();
let wrapperComponentProvider: WrapperComponentProvider | undefined;
let instrumentationHook: ComponentProviderInstrumentationHook = (provider) => provider();

function buildElement(
  componentProvider: ComponentProvider,
  initialProps: Record<string, unknown>,
  rootTag: number,
): ReactElement {
  const Component = instrumentationHook(componentProvider);
  const element = <Component {...initialProps} rootTag={rootTag} />;
  const Wrapper = wrapperComponentProvider?.({ initialProps, rootTag });
  return Wrapper ? <Wrapper {...initialProps}>{element}</Wrapper> : element;
}

function runComponent(appKey: string, componentProvider: ComponentProvider, parameters: AppParameters = {}) {
  const { initialProps = {}, rootTag = allocateRootTag(), ...renderOptions } = parameters;
  const instance = render(buildElement(componentProvider, initialProps, rootTag), renderOptions, rootTag);
  instances.set(rootTag, { appKey, instance });
  instance.waitUntilExit().then(
    () => instances.delete(rootTag),
    () => {
      instances.delete(rootTag);
      if (!process.exitCode) process.exitCode = 1;
    },
  );
  return Object.assign({}, instance, { rootTag }) as AppInstance;
}

const notRegistered = (appKey: string) =>
  new Error(
    `"${appKey}" has not been registered. Make sure AppRegistry.registerComponent('${appKey}', ...) ` +
      'runs before AppRegistry.runApplication.',
  );

/** React Native's `AppRegistry`: the entry point for running an app in the terminal. */
export const AppRegistry = {
  registerComponent(appKey: string, componentProvider: ComponentProvider, section?: boolean): string {
    const registration: Registration = {
      componentProvider,
      run: (parameters) => runComponent(appKey, componentProvider, parameters),
    };
    runnables.set(appKey, registration);
    if (section) sections.set(appKey, registration);
    return appKey;
  },

  registerSection(appKey: string, componentProvider: ComponentProvider): void {
    AppRegistry.registerComponent(appKey, componentProvider, true);
  },

  registerRunnable(appKey: string, run: Runnable): string {
    runnables.set(appKey, { run });
    return appKey;
  },

  registerConfig(config: AppConfig[]): void {
    for (const { appKey, component, run, section } of config) {
      if (run) AppRegistry.registerRunnable(appKey, run);
      else if (component) AppRegistry.registerComponent(appKey, component, section);
    }
  },

  getAppKeys(): string[] {
    return [...runnables.keys()];
  },

  getSectionKeys(): string[] {
    return [...sections.keys()];
  },

  getSections(): Record<string, Registration> {
    return Object.fromEntries(sections);
  },

  getRunnable(appKey: string): Registration | undefined {
    return runnables.get(appKey);
  },

  getRegistry(): { sections: string[]; runnables: Record<string, Registration> } {
    return { sections: AppRegistry.getSectionKeys(), runnables: Object.fromEntries(runnables) };
  },

  /**
   * Renders a registered app in the terminal and returns the Ink instance (an extension:
   * React Native returns nothing). Errors from the app set `process.exitCode = 1`.
   */
  runApplication(appKey: string, appParameters: AppParameters = {}, _displayMode?: number): AppInstance {
    const registration = runnables.get(appKey);
    if (!registration) throw notRegistered(appKey);
    return registration.run(appParameters) as AppInstance;
  },

  /** Re-renders a running app with new initial props. */
  setSurfaceProps(appKey: string, appParameters: AppParameters = {}, _displayMode?: number): void {
    const registration = runnables.get(appKey);
    if (!registration?.componentProvider) throw notRegistered(appKey);
    for (const [rootTag, entry] of instances) {
      if (entry.appKey === appKey && (appParameters.rootTag === undefined || appParameters.rootTag === rootTag)) {
        entry.instance.rerender(
          <AppRoot rootTag={rootTag}>
            {buildElement(registration.componentProvider, appParameters.initialProps ?? {}, rootTag)}
          </AppRoot>,
        );
      }
    }
  },

  unmountApplicationComponentAtRootTag(rootTag: number): void {
    instances.get(rootTag)?.instance.unmount();
    instances.delete(rootTag);
  },

  /**
   * Returns the app's root element (wrapped in the app root) without rendering it, plus a
   * `toString(columns?)` helper. Useful for tests with ink-testing-library.
   */
  getApplication(
    appKey: string,
    appParameters: { initialProps?: Record<string, unknown>; rootTag?: number } = {},
  ): { element: ReactElement; toString(columns?: number): string } {
    const registration = runnables.get(appKey);
    if (!registration?.componentProvider) throw notRegistered(appKey);
    const rootTag = appParameters.rootTag ?? allocateRootTag();
    const element = (
      <AppRoot rootTag={rootTag}>
        {buildElement(registration.componentProvider, appParameters.initialProps ?? {}, rootTag)}
      </AppRoot>
    );
    return {
      element,
      toString: (columns?: number) => inkRenderToString(element, { columns }),
    };
  },

  setWrapperComponentProvider(provider: WrapperComponentProvider): void {
    wrapperComponentProvider = provider;
  },

  setComponentProviderInstrumentationHook(hook: ComponentProviderInstrumentationHook): void {
    instrumentationHook = hook;
  },
};
