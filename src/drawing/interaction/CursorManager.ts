/**
 * interaction/CursorManager.ts
 *
 * Centralized cursor system. ALL cursor changes go through here (AD: single
 * responsibility). The presentation layer subscribes and applies the cursor
 * string to the DOM element; this manager itself never touches the DOM.
 *
 * Cursor is derived state: the interaction runtime sets a logical cursor,
 * and subscribers map it to a CSS cursor. We expose both the logical name
 * and a default CSS mapping so the adapter can use either.
 */

export type CursorKind =
  | 'default'
  | 'pointer'
  | 'crosshair'
  | 'move'
  | 'resize-ns'
  | 'resize-ew'
  | 'resize-nwse'
  | 'resize-nesw'
  | 'rotate'   // future
  | 'text'
  | 'grab'
  | 'grabbing'
  | 'not-allowed';

/** Default CSS cursor mapping. `rotate` has no native CSS cursor; falls back. */
export const CURSOR_CSS: Readonly<Record<CursorKind, string>> = {
  'default': 'default',
  'pointer': 'pointer',
  'crosshair': 'crosshair',
  'move': 'move',
  'resize-ns': 'ns-resize',
  'resize-ew': 'ew-resize',
  'resize-nwse': 'nwse-resize',
  'resize-nesw': 'nesw-resize',
  'rotate': 'grab', // no native rotate cursor; adapter may swap a custom image
  'text': 'text',
  'grab': 'grab',
  'grabbing': 'grabbing',
  'not-allowed': 'not-allowed',
};

export type CursorListener = (kind: CursorKind, css: string) => void;

export class CursorManager {
  private current: CursorKind = 'default';
  private listeners: CursorListener[] = [];

  get(): CursorKind { return this.current; }
  css(): string { return CURSOR_CSS[this.current]; }

  /** Set the logical cursor. No-op if unchanged. Notifies subscribers. */
  set(kind: CursorKind): void {
    if (this.current === kind) return;
    this.current = kind;
    const css = CURSOR_CSS[kind];
    for (const l of this.listeners) l(kind, css);
  }

  /** Reset to default. */
  reset(): void { this.set('default'); }

  subscribe(l: CursorListener): () => void {
    this.listeners.push(l);
    // Fire once so a freshly-subscribed adapter syncs immediately.
    l(this.current, CURSOR_CSS[this.current]);
    return () => { this.listeners = this.listeners.filter((x) => x !== l); };
  }

  /**
   * Map a control-point cursor hint (CSS-ish string) to a CursorKind.
   * Falls back to 'default' for unknown hints. Keeps ControlPoint.cursor
   * loose while the manager stays strongly typed.
   */
  static fromHint(hint: string | undefined): CursorKind {
    switch (hint) {
      case 'move': return 'move';
      case 'ns-resize': return 'resize-ns';
      case 'ew-resize': return 'resize-ew';
      case 'nwse-resize': return 'resize-nwse';
      case 'nesw-resize': return 'resize-nesw';
      case 'text': return 'text';
      case 'crosshair': return 'crosshair';
      case 'pointer': return 'pointer';
      case 'grab': return 'grab';
      case 'grabbing': return 'grabbing';
      case 'rotate': return 'rotate';
      default: return 'default';
    }
  }
}
