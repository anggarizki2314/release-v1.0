/**
 * interaction/KeyboardController.ts
 *
 * Routes key events to handlers. Engine wires default handlers
 * (Delete, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Escape).
 *
 * No DOM dependency — caller passes key events in. Pure dispatch.
 */

export type KeyHandler = (e: { key: string; ctrl: boolean; meta: boolean; shift: boolean }) => boolean;

export class KeyboardController {
  private bindings: Array<{ match: (e: { key: string; ctrl: boolean; meta: boolean; shift: boolean }) => boolean; handle: KeyHandler }> = [];

  bind(match: (e: any) => boolean, handle: KeyHandler): () => void {
    const entry = { match, handle };
    this.bindings.push(entry);
    return () => { this.bindings = this.bindings.filter((b) => b !== entry); };
  }

  handle(e: { key: string; ctrl: boolean; meta: boolean; shift: boolean }): boolean {
    for (const b of this.bindings) {
      if (b.match(e)) {
        const handled = b.handle(e);
        if (handled) return true;
      }
    }
    return false;
  }
}
