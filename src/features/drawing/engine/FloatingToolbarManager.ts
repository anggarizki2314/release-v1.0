/**
 * Drawing Engine — FloatingToolbarManager
 *
 * Manages floating toolbar visibility and position.
 * Pure state — no drawing logic.
 */

export interface FloatingToolbarState {
  visible: boolean;
  x: number;
  y: number;
  drawingId: string | null;
}

export class FloatingToolbarManager {
  private state: FloatingToolbarState = { visible: false, x: 0, y: 0, drawingId: null };
  private onChange: ((state: FloatingToolbarState) => void) | null = null;

  setOnChange(cb: (state: FloatingToolbarState) => void) { this.onChange = cb; }

  show(drawingId: string, x: number, y: number): void {
    this.state = { visible: true, x, y, drawingId };
    this.onChange?.(this.state);
  }

  hide(): void {
    this.state = { ...this.state, visible: false, drawingId: null };
    this.onChange?.(this.state);
  }

  move(x: number, y: number): void {
    if (!this.state.visible) return;
    this.state = { ...this.state, x, y };
    this.onChange?.(this.state);
  }

  get current(): FloatingToolbarState { return { ...this.state }; }
}
