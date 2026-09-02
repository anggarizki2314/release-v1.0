/**
 * SelectionController — Manages single/multi selection.
 */

export class SelectionController {
  private selectedIds = new Set<string>();
  onChange: ((ids: string[]) => void) | null = null;

  setOnChange(cb: (ids: string[]) => void) { this.onChange = cb; }

  get ids(): string[] { return Array.from(this.selectedIds); }
  get count(): number { return this.selectedIds.size; }
  isSelected(id: string): boolean { return this.selectedIds.has(id); }

  select(id: string, multi = false): void {
    if (!multi) this.selectedIds.clear();
    this.selectedIds.add(id);
    this.onChange?.(this.ids);
  }

  toggle(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.onChange?.(this.ids);
  }

  clear(): void {
    if (this.selectedIds.size === 0) return;
    this.selectedIds.clear();
    this.onChange?.(this.ids);
  }
}
