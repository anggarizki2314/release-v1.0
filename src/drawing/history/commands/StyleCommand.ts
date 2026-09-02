/**
 * history/commands/StyleCommand.ts
 */

import type { BaseDrawingData, DrawingStyle } from '../../core/types';
import type { ICommand } from '../ICommand';
import { buildCommand } from './CommandBuilder';

export const createStyleCommand = (
  prev: BaseDrawingData,
  next: BaseDrawingData,
  patch: Partial<DrawingStyle>
): ICommand => buildCommand(
  'style',
  { instanceId: prev.id, stylePatch: patch },
  { [prev.id]: prev },
  { [next.id]: next }
);
