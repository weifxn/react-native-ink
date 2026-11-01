import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { Box, Text as InkText } from 'ink';
import { Button } from '../components/Button/index.js';
import { Modal } from '../components/Modal/index.js';
import { Text } from '../components/Text/index.js';
import { TextInput } from '../components/TextInput/index.js';
import { View } from '../components/View/index.js';
import { CLEAR_BACKGROUND } from '../internal/modalHost.js';
import type { ColorValue } from '../style/types.js';

export interface AlertButton {
  text?: string;
  onPress?: ((value?: any) => void) | null;
  isPreferred?: boolean;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  /** Esc dismisses the alert (calling `onDismiss`) when there is no cancel button. Default true. */
  cancelable?: boolean;
  userInterfaceStyle?: 'unspecified' | 'light' | 'dark';
  onDismiss?: () => void;
}

export type AlertType = 'default' | 'plain-text' | 'secure-text' | 'login-password';

interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  vertical: boolean;
  prompt?: { type: AlertType; defaultValue: string };
  cancelable: boolean;
  onDismiss?: () => void;
  /** Esc result for action sheets without an explicit cancel button. */
  onCancel?: () => void;
}

const queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
const notify = () => listeners.forEach((listener) => listener());

const dialogs = {
  push(request: Omit<DialogRequest, 'id'>): number {
    const id = nextId++;
    queue.push({ ...request, id });
    notify();
    return id;
  },
  dismiss(id: number) {
    const index = queue.findIndex((request) => request.id === id);
    if (index !== -1) {
      queue.splice(index, 1);
      notify();
    }
  },
  current: (): DialogRequest | null => queue[0] ?? null,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Test helper: drop queued dialogs and toasts. */
export function resetDialogs(): void {
  queue.splice(0, queue.length);
  notify();
  setToast(null);
}

/** Shows a dialog over the app. Tab moves between buttons; Enter presses; Esc cancels. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    dialogs.push({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      vertical: (buttons?.length ?? 0) > 3,
      cancelable: options?.cancelable ?? true,
      onDismiss: options?.onDismiss,
    });
  },
  prompt(
    title: string,
    message?: string,
    callbackOrButtons?: ((text: string) => void) | AlertButton[],
    type: AlertType = 'plain-text',
    defaultValue = '',
    _keyboardType?: string,
    options?: AlertOptions,
  ): void {
    const buttons: AlertButton[] =
      typeof callbackOrButtons === 'function'
        ? [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', onPress: callbackOrButtons, isPreferred: true }]
        : callbackOrButtons?.length
          ? callbackOrButtons
          : [{ text: 'OK' }];
    dialogs.push({
      title,
      message,
      buttons,
      vertical: false,
      prompt: { type, defaultValue },
      cancelable: options?.cancelable ?? true,
      onDismiss: options?.onDismiss,
    });
  },
};

export interface ActionSheetIOSOptions {
  options: string[];
  title?: string;
  message?: string;
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number | number[];
  disabledButtonIndices?: number[];
  tintColor?: ColorValue;
  cancelButtonTintColor?: ColorValue;
  anchor?: number;
  userInterfaceStyle?: 'light' | 'dark';
}

let actionSheetId: number | undefined;

/** Shows a vertical list of options; the callback receives the chosen index. */
export const ActionSheetIOS = {
  showActionSheetWithOptions(options: ActionSheetIOSOptions, callback: (buttonIndex: number) => void): void {
    const destructive = new Set(
      Array.isArray(options.destructiveButtonIndex)
        ? options.destructiveButtonIndex
        : options.destructiveButtonIndex !== undefined
          ? [options.destructiveButtonIndex]
          : [],
    );
    const disabled = new Set(options.disabledButtonIndices ?? []);
    actionSheetId = dialogs.push({
      title: options.title ?? '',
      message: options.message,
      vertical: true,
      cancelable: true,
      buttons: options.options
        .map((text, index) => ({ text, index }))
        .filter(({ index }) => !disabled.has(index))
        .map(({ text, index }) => ({
          text,
          style: index === options.cancelButtonIndex ? 'cancel' : destructive.has(index) ? 'destructive' : 'default',
          onPress: () => callback(index),
        })),
      onCancel: options.cancelButtonIndex !== undefined ? () => callback(options.cancelButtonIndex!) : undefined,
    });
  },
  showShareActionSheetWithOptions(
    _options: { url?: string; message?: string; subject?: string },
    failureCallback: (error: Error) => void,
    _successCallback: (completed: boolean, activityType?: string) => void,
  ): void {
    failureCallback(new Error('Sharing is not supported in terminals.'));
  },
  dismissActionSheet(): void {
    if (actionSheetId !== undefined) dialogs.dismiss(actionSheetId);
  },
};

function Dialog({ request }: { request: DialogRequest }) {
  const [text, setText] = useState(request.prompt?.defaultValue ?? '');
  const [password, setPassword] = useState('');
  const login = request.prompt?.type === 'login-password';
  const value = request.prompt ? (login ? { login: text, password } : text) : undefined;

  const choose = (button?: AlertButton) => {
    dialogs.dismiss(request.id);
    button?.onPress?.(value);
  };
  const cancelButton = request.buttons.find((button) => button.style === 'cancel');
  const requestClose = () => {
    if (cancelButton) return choose(cancelButton);
    if (request.onCancel) {
      dialogs.dismiss(request.id);
      return request.onCancel();
    }
    if (request.cancelable) {
      dialogs.dismiss(request.id);
      request.onDismiss?.();
    }
  };
  const preferred = request.buttons.findIndex((button) => button.isPreferred);
  const focusIndex = preferred !== -1 ? preferred : request.vertical ? 0 : request.buttons.length - 1;
  const submit = () => choose(request.buttons[preferred !== -1 ? preferred : request.buttons.length - 1]);

  return (
    <Modal transparent visible onRequestClose={requestClose}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View
          style={{ borderWidth: 1, borderRadius: 1, paddingHorizontal: 2, paddingVertical: 1, minWidth: 24, maxWidth: '80%' }}
          overrideBox={{ backgroundColor: CLEAR_BACKGROUND }}
        >
          {request.title ? <Text style={{ fontWeight: 'bold' }}>{request.title}</Text> : null}
          {request.message ? <Text>{request.message}</Text> : null}
          {request.prompt ? (
            <View style={{ marginTop: 1 }}>
              <TextInput
                autoFocus
                value={text}
                onChangeText={setText}
                placeholder={login ? 'Login' : undefined}
                secureTextEntry={request.prompt.type === 'secure-text'}
                submitBehavior="submit"
                onSubmitEditing={login ? undefined : submit}
                style={{ borderBottomWidth: 1 }}
              />
              {login ? (
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry
                  submitBehavior="submit"
                  onSubmitEditing={submit}
                  style={{ borderBottomWidth: 1 }}
                />
              ) : null}
            </View>
          ) : null}
          <View
            style={{
              flexDirection: request.vertical ? 'column' : 'row',
              justifyContent: 'flex-end',
              columnGap: 1,
              marginTop: 1,
            }}
          >
            {request.buttons.map((button, index) => (
              <Button
                key={index}
                title={button.text ?? 'OK'}
                color={button.style === 'destructive' ? 'red' : undefined}
                autoFocus={!request.prompt && index === focusIndex}
                onPress={() => choose(button)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Mounted by the app root: shows queued alerts and action sheets one at a time. Memoized so
 * root re-renders (e.g. when modal layers change) don't re-render the dialog's Modal.
 */
export const DialogHost = memo(function DialogHost() {
  const request = useSyncExternalStore(dialogs.subscribe, dialogs.current, dialogs.current);
  return request ? <Dialog key={request.id} request={request} /> : null;
});

interface Toast {
  id: number;
  message: string;
  duration: number;
}

let currentToast: Toast | null = null;
const toastListeners = new Set<() => void>();
const setToast = (toast: Toast | null) => {
  currentToast = toast;
  toastListeners.forEach((listener) => listener());
};

const toastMs = (duration: number) => (duration === 1 || duration >= 3500 ? 3500 : 2000);

/** Shows a short message below the app for 2 s (SHORT) or 3.5 s (LONG). */
export const ToastAndroid = {
  SHORT: 0,
  LONG: 1,
  TOP: 49,
  BOTTOM: 80,
  CENTER: 17,
  show(message: string, duration: number): void {
    setToast({ id: nextId++, message, duration: toastMs(duration) });
  },
  showWithGravity(message: string, duration: number, _gravity: number): void {
    ToastAndroid.show(message, duration);
  },
  showWithGravityAndOffset(message: string, duration: number, _gravity: number, _x: number, _y: number): void {
    ToastAndroid.show(message, duration);
  },
};

/** Mounted by the app root. */
export const ToastHost = memo(function ToastHost() {
  const toast = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener);
      return () => {
        toastListeners.delete(listener);
      };
    },
    () => currentToast,
    () => currentToast,
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (currentToast?.id === toast.id) setToast(null);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return (
    <Box>
      <InkText inverse>{` ${toast.message} `}</InkText>
    </Box>
  );
});
