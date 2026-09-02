/**
 * history/commands/DeleteCommand.ts
 */

import type { BaseDrawingData } from '../../core/types';
import type { ICommand } from '../ICommand';
import { buildCommand } from './CommandBuilder';

export const createDeleteCommand = (snapshots: ReadonlyArray<BaseDrawingData>): ICommand => {
  const before: Record<string, BaseDrawingData> = {};
  for (const s of snapshots) before[s.id] = s;
  return buildCommand('delete', { instanceId: snapshots[0]?.id }, before, {});
};
