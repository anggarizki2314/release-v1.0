/**
 * history/commands/TransformCommand.ts
 */

import type { BaseDrawingData, TransformOp } from '../../core/types';
import type { ICommand } from '../ICommand';
import { buildCommand } from './CommandBuilder';

export const createTransformCommand = (
  prev: BaseDrawingData,
  next: BaseDrawingData,
  op: TransformOp
): ICommand => buildCommand(
  'transform',
  { instanceId: prev.id, op },
  { [prev.id]: prev },
  { [next.id]: next }
);
