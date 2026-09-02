/**
 * Drawing Engine — ContextMenuManager
 *
 * Manages context menu visibility and position.
 * Provides menu items based on current selection.
 */

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export class ContextMenuManager {
  private state: ContextMenuState = { visible: false, x: 0, y: 0, items: [] };
  private onChange: ((state: ContextMenuState) => void) | null = null;

  setOnChange(cb: (state: ContextMenuState) => void) { this.onChange = cb; }

  show(x: number, y: number, hasSelection: boolean): void {
    const items: ContextMenuItem[] = [
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', disabled: !hasSelection },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
      { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', disabled: !hasSelection },
      { id: 'divider-1', label: '', divider: true },
      { id: 'lock', label: 'Lock', disabled: !hasSelection },
      { id: 'hide', label: 'Hide', disabled: !hasSelection },
      { id: 'divider-2', label: '', divider: true },
      { id: 'bring-forward', label: 'Bring Forward', disabled: !hasSelection },
      { id: 'send-backward', label: 'Send Backward', disabled: !hasSelection },
      { id: 'divider-3', label: '', divider: true },
      { id: 'delete', label: 'Delete', shortcut: 'Del', disabled: !hasSelection },
    ];
    this.state = { visible: true, x, y, items };
    this.onChange?.(this.state);
  }

  hide(): void {
    this.state = { ...this.state, visible: false };
    this.onChange?.(this.state);
  }

  get current(): ContextMenuState { return { ...this.state }; }
}
