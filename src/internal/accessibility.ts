export type AccessibilityRole =
  | 'none'
  | 'button'
  | 'togglebutton'
  | 'link'
  | 'search'
  | 'image'
  | 'keyboardkey'
  | 'text'
  | 'adjustable'
  | 'imagebutton'
  | 'header'
  | 'summary'
  | 'alert'
  | 'checkbox'
  | 'combobox'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'scrollbar'
  | 'spinbutton'
  | 'switch'
  | 'tab'
  | 'tabbar'
  | 'tablist'
  | 'timer'
  | 'list'
  | 'toolbar'
  | 'grid'
  | (string & {});

export type Role = AccessibilityRole;

export interface AccessibilityState {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  busy?: boolean;
  expanded?: boolean;
}

export interface AccessibilityValue {
  min?: number;
  max?: number;
  now?: number;
  text?: string;
}

/** React Native's accessibility props. Labels, roles and states feed Ink's screen-reader mode. */
export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityValue?: AccessibilityValue;
  accessibilityActions?: ReadonlyArray<{ name: string; label?: string }>;
  onAccessibilityAction?: (event: unknown) => void;
  accessibilityElementsHidden?: boolean;
  accessibilityViewIsModal?: boolean;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  accessibilityLanguage?: string;
  accessibilityLabelledBy?: string | string[];
  accessibilityIgnoresInvertColors?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  onAccessibilityTap?: () => void;
  onMagicTap?: () => void;
  onAccessibilityEscape?: () => void;
  role?: Role;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-hidden'?: boolean;
  'aria-busy'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-disabled'?: boolean;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-modal'?: boolean;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-valuemax'?: number;
  'aria-valuemin'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
}

const ROLE_MAP: Readonly<Record<string, string>> = {
  button: 'button',
  togglebutton: 'button',
  imagebutton: 'button',
  checkbox: 'checkbox',
  switch: 'checkbox',
  combobox: 'combobox',
  list: 'list',
  listbox: 'listbox',
  listitem: 'listitem',
  menu: 'menu',
  menubar: 'menu',
  menuitem: 'menuitem',
  option: 'option',
  progressbar: 'progressbar',
  radio: 'radio',
  radiogroup: 'radiogroup',
  tab: 'tab',
  tablist: 'tablist',
  tabbar: 'tablist',
  table: 'table',
  grid: 'table',
  textbox: 'textbox',
  search: 'textbox',
  timer: 'timer',
  toolbar: 'toolbar',
};

/** Translates React Native accessibility props into Ink's `aria-*` props. */
export function resolveAccessibility(props: AccessibilityProps): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const label = props['aria-label'] ?? props.accessibilityLabel;
  if (label !== undefined) result['aria-label'] = label;

  const hidden =
    props['aria-hidden'] ??
    props.accessibilityElementsHidden ??
    (props.importantForAccessibility === 'no-hide-descendants' ? true : undefined);
  if (hidden !== undefined) result['aria-hidden'] = hidden;

  const role = props.role ?? props.accessibilityRole;
  const inkRole = role ? ROLE_MAP[role] : undefined;
  if (inkRole) result['aria-role'] = inkRole;

  const state = props.accessibilityState ?? {};
  const merged = {
    busy: props['aria-busy'] ?? state.busy,
    checked: props['aria-checked'] ?? state.checked,
    disabled: props['aria-disabled'] ?? state.disabled,
    expanded: props['aria-expanded'] ?? state.expanded,
    selected: props['aria-selected'] ?? state.selected,
  };
  const inkState: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === 'boolean') inkState[key] = value;
    else if (value === 'mixed') inkState[key] = true;
  }
  if (Object.keys(inkState).length > 0) result['aria-state'] = inkState;
  return result;
}
