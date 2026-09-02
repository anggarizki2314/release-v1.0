/**
 * Drawing Engine — ToolManager
 *
 * Manages current active tool and tool switching.
 * Supports auto-return to pointer after drawing.
 */

import type { ToolId } from './types';
import { DrawingEventBus } from './events';
import { trace, isActive } from '../trace';

export class ToolManager {
  private currentTool: ToolId = 'pointer';
  private previousTool: ToolId = 'pointer';
  private autoReturn = true;

  constructor(private events: DrawingEventBus) {}

  get activeTool(): ToolId { return this.currentTool; }
  get prevTool(): ToolId { return this.previousTool; }
  get isDrawingTool(): boolean {
    return this.currentTool !== 'pointer' && this.currentTool !== 'crosshair';
  }

  setAutoReturn(v: boolean) { this.autoReturn = v; }

  activate(tool: ToolId): void {
    if (tool === this.currentTool) return;
    const prev = this.currentTool;
    this.previousTool = this.currentTool;
    this.currentTool = tool;
    if (isActive()) {
      trace(
        'ToolManager.activate',
        'ToolManager.ts:26',
        {
          fsm: '-',
          tool,
          tempPoints: [],
          drawingsCount: -1,
          selectedDrawingId: null,
          isDrawingMode: tool !== 'pointer' && tool !== 'crosshair',
          note: `prev=${prev}`,
        }
      );
    }
    this.events.emit('tool:changed', { tool, previous: this.previousTool });
  }

  returnToPointer(): void {
    if (this.autoReturn && this.currentTool !== 'pointer') {
      this.activate('pointer');
    }
  }

  restorePrevious(): void {
    this.activate(this.previousTool);
  }
}
