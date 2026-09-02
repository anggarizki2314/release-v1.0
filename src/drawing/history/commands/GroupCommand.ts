/**
 * history/commands/GroupCommand.ts
 */

import type { BaseDrawingData } from '../../core/types';
import type { ICommand } from '../ICommand';
import { buildCommand } from './CommandBuilder';

export const createGroupCommand = (
  groupBefore: ReadonlyArray<BaseDrawingData>,
  groupAfter: ReadonlyArray<BaseDrawingData>,
  groupDrawing: BaseDrawingData,
  groupId: string
): ICommand => {
  const before: Record<string, BaseDrawingData> = { [groupDrawing.id]: groupDrawing };
  const after: Record<string, BaseDrawingData> = { [groupDrawing.id]: groupDrawing };
  for (const d of groupBefore) before[d.id] = d;
  for (const d of groupAfter) after[d.id] = d;
  return buildCommand('group', { groupId, childIds: groupAfter.map((d) => d.id) }, before, after);
};

export const createUngroupCommand = (
  ungroupBefore: ReadonlyArray<BaseDrawingData>,
  ungroupAfter: ReadonlyArray<BaseDrawingData>,
  groupDrawing: BaseDrawingData,
  groupId: string
): ICommand => {
  const before: Record<string, BaseDrawingData> = { [groupDrawing.id]: groupDrawing };
  const after: Record<string, BaseDrawingData> = { [groupDrawing.id]: groupDrawing };
  for (const d of ungroupBefore) before[d.id] = d;
  for (const d of ungroupAfter) after[d.id] = d;
  return buildCommand('ungroup', { groupId, childIds: ungroupAfter.map((d) => d.id) }, before, after);
};
