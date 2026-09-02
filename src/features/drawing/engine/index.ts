/**
 * Drawing Engine — Public API
 *
 * Export everything needed to use the engine.
 * Consumers only need to import from this module.
 */

export { DrawingEngine } from './DrawingEngine';
export type { DrawingEngineConfig } from './DrawingEngine';

export type {
  DrawingObject,
  DrawingTypeId,
  ToolId,
  DrawingPoint,
  DrawingStyle,
  LineStyle,
  BoundingBox,
  CreateDrawingInput,
  UpdateDrawingInput,
  HitTestResult,
  SnapResult,
  HistoryEntry,
  HistoryActionType,
  SerializedDrawing,
  DrawingEngineEvents,
  EventKey,
  EventHandler,
} from './types';

export { DrawingEventBus } from './events';
export { ToolManager } from './ToolManager';
export { SelectionManager } from './SelectionManager';
export { DrawingManager } from './DrawingManager';
export { DrawingHistory } from './DrawingHistory';
export { DrawingHitTester } from './DrawingHitTester';
export { DrawingSnapManager } from './DrawingSnapManager';
export { DrawingSerializer } from './DrawingSerializer';
export { DrawingStorage, getDrawingStorageKey, GLOBAL_DRAWING_STORAGE_KEY } from './DrawingStorage';
export { SpatialIndex } from './SpatialIndex';
export { DrawingRenderer } from './DrawingRenderer';
export { FloatingToolbarManager } from './FloatingToolbarManager';
export { ContextMenuManager } from './ContextMenuManager';
export { createDrawing, cloneDrawing, updateDrawing, DEFAULT_STYLE, generateId } from './DrawingObject';
