/**
 * history/commands/CommandBuilder.ts
 *
 * Factory for command instances. Centralises id generation + snapshot copy
 * semantics. Commands are immutable once built.
 */

import type { ICommand, ICommandPayload } from '../ICommand';
import type { BaseDrawingData } from '../../core/types';

let cmdCounter = 0;
export const nextCommandId = (): string =>
  `cmd_${Date.now().toString(36)}_${(cmdCounter++).toString(36)}`;

export const buildCommand = (
  kind: ICommand['kind'],
  payload: ICommandPayload,
  before: Readonly<Record<string, Readonly<BaseDrawingData>>>,
  after: Readonly<Record<string, Readonly<BaseDrawingData>>>
): ICommand => {
  const id = nextCommandId();
  return Object.freeze({
    id,
    kind,
    payload: Object.freeze({ ...payload }),
    before: Object.freeze({ ...before }),
    after: Object.freeze({ ...after }),
  });
};
