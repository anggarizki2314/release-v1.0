/**
 * InteractionStateMachine — Finite State Machine for drawing interactions.
 *
 * Ensures only ONE state is active at a time.
 * Validates transitions to prevent invalid states.
 */

import type { InteractionState, InteractionEvent, StateTransitionHandler } from './types';

// Valid transitions: from → [allowed states]
const TRANSITIONS: Record<InteractionState, InteractionState[]> = {
  'idle':              ['hover-object', 'creating-drawing', 'box-selecting', 'disabled'],
  'hover-object':      ['idle', 'selected-object', 'dragging-object', 'resizing-anchor', 'disabled'],
  'selected-object':   ['idle', 'hover-object', 'dragging-object', 'resizing-anchor', 'creating-drawing', 'box-selecting', 'disabled'],
  'dragging-object':   ['selected-object', 'idle', 'disabled'],
  'resizing-anchor':   ['selected-object', 'idle', 'disabled'],
  'creating-drawing':  ['idle', 'creating-drawing', 'disabled'], // can stay in creating for multi-click tools
  'box-selecting':     ['selected-object', 'idle', 'disabled'],
  'context-menu':      ['idle', 'selected-object', 'disabled'],
  'disabled':          ['idle'],
};

export class InteractionStateMachine {
  private state: InteractionState = 'idle';
  private handlers: StateTransitionHandler[] = [];

  getState(): InteractionState { return this.state; }

  canTransition(to: InteractionState): boolean {
    if (this.state === to) return true;
    return TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: InteractionState, event: InteractionEvent): boolean {
    if (this.state === to) {
      return true;
    }

    if (!this.canTransition(to)) {
      return false;
    }

    const from = this.state;
    this.state = to;

    for (const handler of this.handlers) {
      handler(from, to, event);
    }
    return true;
  }

  onTransition(handler: StateTransitionHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  force(state: InteractionState): void {
    this.state = state;
  }
}
