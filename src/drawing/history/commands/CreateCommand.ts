/**
 * history/commands/CreateCommand.ts
 */

import type { BaseDrawingData } from '../../core/types';
import type { ICommand } from '../ICommand';
import { buildCommand } from './CommandBuilder';

export const createCreateCommand = (drawing: BaseDrawingData): ICommand =>
  buildCommand('create', { typeId: drawing.type, instanceId: drawing.id }, {}, { [drawing.id]: drawing });
