/**
 * trace.ts — Single-session trace recorder for one Trend Line lifecycle.
 *
 * Usage:
 *   import { trace } from './trace';
 *   trace('step-name', { fsm, tool, engine, drawingsCount, tempPoints, isDrawingMode });
 *
 * Session window:
 *   begin() called once on tool selection → records one session until
 *   dump() is invoked or max steps reached. Only ONE active session
 *   at a time; subsequent begin() resets.
 *
 * Output:
 *   dump() prints a single, readable timeline to console.groupCollapsed.
 *   Each step shows: idx | label | file | FSM | tool | tempPoints | drawingsCount | delta.
 */

export interface TraceStep {
  idx: number;
  label: string;
  file: string;
  fsm: string;
  tool: string;
  tempPointsLength: number;
  tempPointsSummary: string;
  drawingsCount: number;
  selectedDrawingId: string | null;
  isDrawingMode: boolean;
  note?: string;
}

export interface TraceSession {
  toolName: string;
  startedAt: number;
  steps: TraceStep[];
  finished: boolean;
}

let active: TraceSession | null = null;
let stepCounter = 0;
const MAX_STEPS = 64;

export function begin(toolName: string): void {
  active = {
    toolName,
    startedAt: Date.now(),
    steps: [],
    finished: false,
  };
  stepCounter = 0;
  // eslint-disable-next-line no-console
  console.log(`[trace] begin session: tool=${toolName}`);
}

export function isActive(): boolean {
  return active !== null && !active.finished;
}

export function trace(
  label: string,
  file: string,
  snapshot: {
    fsm: string;
    tool: string;
    tempPoints: Array<{ time: number; price: number }>;
    drawingsCount: number;
    selectedDrawingId: string | null;
    isDrawingMode: boolean;
    note?: string;
  }
): void {
  if (!active || active.finished) return;
  if (active.steps.length >= MAX_STEPS) {
    active.finished = true;
    // eslint-disable-next-line no-console
    console.warn(`[trace] max steps (${MAX_STEPS}) reached, auto-finalizing`);
    return;
  }

  const step: TraceStep = {
    idx: stepCounter++,
    label,
    file,
    fsm: snapshot.fsm,
    tool: snapshot.tool,
    tempPointsLength: snapshot.tempPoints.length,
    tempPointsSummary: snapshot.tempPoints
      .map((p, i) => `[${i}]t=${p.time},p=${p.price}`)
      .join(' '),
    drawingsCount: snapshot.drawingsCount,
    selectedDrawingId: snapshot.selectedDrawingId,
    isDrawingMode: snapshot.isDrawingMode,
    note: snapshot.note,
  };
  active.steps.push(step);
}

export function finish(note?: string): void {
  if (!active || active.finished) return;
  active.finished = true;
  if (note) {
    active.steps.push({
      idx: stepCounter++,
      label: 'finish',
      file: 'trace.ts',
      fsm: '-',
      tool: '-',
      tempPointsLength: -1,
      tempPointsSummary: '-',
      drawingsCount: -1,
      selectedDrawingId: null,
      isDrawingMode: false,
      note,
    });
  }
}

export function dump(): void {
  if (!active) {
    // eslint-disable-next-line no-console
    console.log('[trace] no active session');
    return;
  }
  const s = active;
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `[trace] session tool=${s.toolName} steps=${s.steps.length} duration=${Date.now() - s.startedAt}ms`
  );
  // eslint-disable-next-line no-console
  console.log('idx | label                              | fsm               | tool           | temp | drawings | sel   | mode | note');
  // eslint-disable-next-line no-console
  console.log('----+-------------------------------------+-------------------+----------------+------|----------+-------+------+-----');
  for (const step of s.steps) {
    // eslint-disable-next-line no-console
    console.log(
      [
        String(step.idx).padStart(3, ' '),
        '|',
        step.label.padEnd(35, ' '),
        '|',
        step.fsm.padEnd(17, ' '),
        '|',
        step.tool.padEnd(14, ' '),
        '|',
        String(step.tempPointsLength).padStart(4, ' '),
        '|',
        String(step.drawingsCount).padStart(8, ' '),
        '|',
        (step.selectedDrawingId ?? '-').padEnd(5, ' '),
        '|',
        String(step.isDrawingMode).padStart(4, ' '),
        '|',
        step.note ?? '',
      ].join(' ')
    );
    if (step.tempPointsSummary !== '-') {
      // eslint-disable-next-line no-console
      console.log('     tempPoints:', step.tempPointsSummary);
    }
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
  // Detach so further traces don't auto-print
  active = null;
  stepCounter = 0;
}
