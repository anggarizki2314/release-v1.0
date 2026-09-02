/**
 * clipboard/ClipboardManager.ts
 *
 * Phase 1 stub. Phase 2 lands deep-clone + ID-remap + paste-offset.
 */

export class ClipboardManager {
  private internal: ReadonlyArray<unknown> = [];
  hasContent(): boolean { return this.internal.length > 0; }
  put(_items: ReadonlyArray<unknown>): void { this.internal = [..._items]; }
  get(): ReadonlyArray<unknown> { return this.internal; }
  clear(): void { this.internal = []; }
}
