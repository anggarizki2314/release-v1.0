/**
 * history/commands/UpdateCommand.ts
 * Generic patch (e.g. setLocked, setVisible, generic data patch).
 */

import type { BaseDrawingData } from '../../core/types';
import type { ICommand } from '../ICommand';
import { buildCommand } from './CommandBuilder';

export const createUpdateCommand = (
  prev: BaseDrawingData,
  next: BaseDrawingData,
  kind: 'update' | 'lock' | 'visibility' = 'update'
): ICommand => buildCommand(
  kind,
  { instanceId: prev.id },
  { [prev.id]: prev },
  { [next.id]: next }
);
