/**
 * history/ICommand.ts
 *
 * Command Pattern. ENGINE is the only executor. Tools/Selection/Renderer
 * do NOT execute commands — they call engine mutators, which build & execute.
 *
 * Each command is data: type, payload, before/after snapshots. Snapshots are
 * immutable BaseDrawingData, captured at execution time. Undo replays the
 * inverse snapshot via the engine's applyRaw(id, data) escape hatch.
 */

import type { BaseDrawingData, DrawingStyle, TransformOp } from '../core/types';

export type CommandKind =
  | 'create'
  | 'update'
  | 'delete'
  | 'transform'
  | 'style'
  | 'lock'
  | 'visibility'
  | 'group'
  | 'ungroup';

export interface ICommandPayload {
  readonly typeId?: string;
  readonly instanceId?: string;
  readonly patch?: Partial<BaseDrawingData>;
  readonly op?: TransformOp;
  readonly stylePatch?: Partial<DrawingStyle>;
  readonly locked?: boolean;
  readonly visible?: boolean;
  readonly groupId?: string;
  readonly childIds?: ReadonlyArray<string>;
}

export interface ICommand {
  readonly id: string;
  readonly kind: CommandKind;
  readonly payload: ICommandPayload;

  /** Snapshot of state BEFORE this command executes. Used by undo. */
  readonly before: Readonly<Record<string, Readonly<BaseDrawingData>>>;

  /** Snapshot of state AFTER this command executes. Used by redo. */
  readonly after: Readonly<Record<string, Readonly<BaseDrawingData>>>;
}
