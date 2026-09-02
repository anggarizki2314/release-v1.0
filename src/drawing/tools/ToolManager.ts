/**
 * tools/ToolManager.ts
 *
 * Tool runtime. Lifecycle: activate(toolId) | activate(null) for pointer mode.
 * Auto-return-to-pointer after a tool completes is controlled by the
 * InteractionController (which signals onCommit → engine → toolManager).
 *
 * Phase 3 additions:
 *   - deactivate()            explicit return to pointer mode
 *   - activatePrevious()      swap back to the previously active tool
 *   - activateTemporary(id)   temporary tool (e.g. hold-to-pan); the prior
 *                             tool is remembered and restored on release
 *   - restoreTemporary()      end temporary tool, restore the remembered one
 *   - phase tracking          exposes the active tool's shared lifecycle phase
 *
 * Emits the Phase 3 events: 'tool:activated' / 'tool:deactivated' in addition
 * to the existing 'tool:changed'. No business logic lives in the event bus.
 */

import type { BaseTool, ToolPhase } from './BaseTool';
import type { ToolRegistry } from './ToolRegistry';
import type { DrawingEvents } from '../core/events';

type Emit = <K extends keyof DrawingEvents>(
  event: K,
  payload: DrawingEvents[K]
) => void;

export class ToolManager {
  private current: BaseTool | null = null;
  private previous: string | null = null;

  /** Remembered tool while a temporary tool is active. */
  private beforeTemporary: string | null = null;
  private temporaryActive = false;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly emit: Emit
  ) {}

  active(): BaseTool | null { return this.current; }
  activeId(): string | null { return this.current?.id ?? null; }
  previousId(): string | null { return this.previous; }
  isTemporary(): boolean { return this.temporaryActive; }

  /** Current lifecycle phase of the active tool, or 'idle' when none. */
  phase(): ToolPhase { return this.current?.phase ?? 'idle'; }

  /** Advance the active tool's shared lifecycle phase. */
  setPhase(next: ToolPhase): void {
    this.current?.setPhase(next);
  }

  activate(id: string | null): boolean {
    if (id === null) return this.deactivate();

    const tool = this.registry.get(id);
    if (!tool) return false;
    if (this.current?.id === id) return true;

    const prev = this.current?.id ?? null;
    this.current?.reset();
    this.current?.resetLifecycle();
    this.current = tool;
    tool.reset();
    tool.resetLifecycle();
    this.previous = prev;
    this.emit('tool:changed', { tool: id, prev });
    this.emit('tool:activated', { tool: id, prev });
    return true;
  }

  /** Explicit deactivate → pointer mode. Idempotent. */
  deactivate(): boolean {
    const prev = this.current?.id ?? null;
    this.current?.reset();
    this.current?.resetLifecycle();
    this.current = null;
    this.previous = prev;
    if (prev !== null) {
      this.emit('tool:deactivated', { tool: prev });
    }
    this.emit('tool:changed', { tool: null, prev });
    return true;
  }

  /** Swap back to the previously active tool (pointer if none). */
  activatePrevious(): boolean {
    const target = this.previous;
    return this.activate(target);
  }

  /**
   * Activate a temporary tool, remembering the current one. Used for
   * hold-to-pan / hold-to-select style interactions. Restored with
   * restoreTemporary().
   */
  activateTemporary(id: string): boolean {
    if (this.temporaryActive) return this.activate(id);
    const remembered = this.current?.id ?? null;
    const ok = this.activate(id);
    if (!ok) return false;
    this.beforeTemporary = remembered;
    this.temporaryActive = true;
    return true;
  }

  /** End a temporary tool, restoring the remembered tool (or pointer). */
  restoreTemporary(): boolean {
    if (!this.temporaryActive) return false;
    const target = this.beforeTemporary;
    this.temporaryActive = false;
    this.beforeTemporary = null;
    return this.activate(target);
  }

  resetActive(): void {
    this.current?.reset();
    this.current?.resetLifecycle();
  }
}
