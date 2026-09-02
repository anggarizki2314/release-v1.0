/**
 * geometry/TextMetrics.ts
 *
 * Pure text-measurement interface. Implementations live in render/ (the only
 * module with canvas access). Geometry modules accept a provider, never
 * import canvas directly. This keeps the geometry layer headless & testable.
 */

export interface TextMetrics {
  readonly width: number;
  readonly height: number;
}

export interface TextMetricsProvider {
  measure(text: string, fontSize: number, fontFamily: string, lineWidth: number): TextMetrics;
}

/**
 * Default no-op provider returns zero metrics. Useful in headless tests.
 */
export const noopTextMetrics: TextMetricsProvider = {
  measure: () => ({ width: 0, height: 0 }),
};
