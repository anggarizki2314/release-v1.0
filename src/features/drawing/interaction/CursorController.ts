/**
 * CursorController — Manages cursor style based on state.
 */

export type CursorStyle =
  | 'default' | 'pointer' | 'crosshair' | 'grab' | 'grabbing' | 'move'
  | 'ns-resize' | 'ew-resize' | 'nwse-resize' | 'nesw-resize';

export class CursorController {
  private current: CursorStyle = 'default';
  private container: HTMLElement | null = null;

  setContainer(el: HTMLElement | null) { this.container = el; }

  set(style: CursorStyle): void {
    if (this.current === style) return;
    this.current = style;
    if (this.container) {
      this.container.style.cursor = style;
    }
  }

  get currentStyle(): CursorStyle { return this.current; }
}
