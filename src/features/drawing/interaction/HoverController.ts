/**
 * HoverController — Manages hover state for drawings.
 */

export class HoverController {
  private hoveredId: string | null = null;
  onChange: ((id: string | null) => void) | null = null;

  setOnChange(cb: (id: string | null) => void) { this.onChange = cb; }

  get id(): string | null { return this.hoveredId; }

  set(id: string | null): void {
    if (this.hoveredId === id) return;
    this.hoveredId = id;
    this.onChange?.(id);
  }

  clear(): void {
    this.set(null);
  }
}
