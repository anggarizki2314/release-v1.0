/**
 * tools/ToolRegistry.ts
 */

import type { BaseTool } from './BaseTool';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    if (this.tools.has(tool.id)) throw new Error(`[ToolRegistry] duplicate toolId: ${tool.id}`);
    this.tools.set(tool.id, tool);
  }

  unregister(id: string): void { this.tools.delete(id); }
  get(id: string): BaseTool | undefined { return this.tools.get(id); }
  has(id: string): boolean { return this.tools.has(id); }
  list(): ReadonlyArray<BaseTool> { return Array.from(this.tools.values()); }
  clear(): void { this.tools.clear(); }
}
