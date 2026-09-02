/**
 * interaction/InteractionStateMachine.ts
 *
 * Strict state machine. Only one state at a time. Valid transitions are
 * enumerated. Invalid transitions are no-ops (canTransition → false).
 *
 * Phase 3: adds `panning` and `cancelled` states. `cancelled` is a
 * transient terminal state that immediately allows a return to `idle`
 * (the controller calls transition('cancelled') then transition('idle')).
 */

export type InteractionState =
  | 'idle'
  | 'hover-object'
  | 'selected-object'
  | 'creating-drawing'
  | 'dragging-object'
  | 'resizing-anchor'
  | 'box-selecting'
  | 'panning'
  | 'context-menu'
  | 'cancelled'
  | 'disabled';

const TRANSITIONS: Readonly<Record<InteractionState, ReadonlyArray<InteractionState>>> = {
  'idle':              ['hover-object', 'selected-object', 'creating-drawing', 'dragging-object', 'resizing-anchor', 'box-selecting', 'panning', 'context-menu', 'disabled'],
  'hover-object':      ['idle', 'selected-object', 'dragging-object', 'resizing-anchor', 'context-menu', 'panning'],
  'selected-object':   ['idle', 'hover-object', 'dragging-object', 'resizing-anchor', 'creating-drawing', 'box-selecting', 'context-menu', 'panning', 'cancelled'],
  'creating-drawing':  ['idle', 'creating-drawing', 'cancelled', 'disabled'],
  'dragging-object':   ['selected-object', 'idle', 'cancelled', 'disabled'],
  'resizing-anchor':   ['selected-object', 'idle', 'cancelled', 'disabled'],
  'box-selecting':     ['selected-object', 'idle', 'cancelled'],
  'panning':           ['idle', 'hover-object', 'selected-object'],
  'context-menu':      ['idle', 'selected-object'],
  'cancelled':         ['idle'],
  'disabled':          ['idle'],
};

export type StateListener = (from: InteractionState, to: InteractionState) => void;

export class InteractionStateMachine {
  private state: InteractionState = 'idle';
  private listeners: StateListener[] = [];

  getState(): InteractionState { return this.state; }

  canTransition(to: InteractionState): boolean {
    return TRANSITIONS[this.state].includes(to);
  }

  transition(to: InteractionState): boolean {
    if (this.state === to) return true;
    if (!this.canTransition(to)) return false;
    const from = this.state;
    this.state = to;
    for (const l of this.listeners) l(from, to);
    return true;
  }

  onTransition(l: StateListener): () => void {
    this.listeners.push(l);
    return () => { this.listeners = this.listeners.filter((x) => x !== l); };
  }

  /** Force state without validation or listeners (test/reset only). */
  force(state: InteractionState): void {
    this.state = state;
  }

  /** Reset to idle, notifying listeners if state changed. */
  reset(): void {
    if (this.state === 'idle') return;
    const from = this.state;
    this.state = 'idle';
    for (const l of this.listeners) l(from, 'idle');
  }
}
