/**
 * Performance Profiler for Timeframe Change Pipeline.
 * Measures each stage accurately with performance.now().
 */

export interface ProfileMetrics {
  fromTimeframe: string;
  toTimeframe: string;
  startTime: number;
  dbMs: number;
  resampleMs: number;
  inputCandleCount: number;
  outputCandleCount: number;
  filterMs: number;
  filteredCandleCount: number;
  reactMs: number;
  setDataMs: number;
  chartCandleCount: number;
  viewportMs: number;
}

class TimeframeProfiler {
  private currentSession: ProfileMetrics = {
    fromTimeframe: 'M1',
    toTimeframe: 'M1',
    startTime: 0,
    dbMs: 0,
    resampleMs: 0,
    inputCandleCount: 0,
    outputCandleCount: 0,
    filterMs: 0,
    filteredCandleCount: 0,
    reactMs: 0,
    setDataMs: 0,
    chartCandleCount: 0,
    viewportMs: 0,
  };

  private active = false;

  public startSession(fromTf: string, toTf: string) {
    this.active = true;
    const now = performance.now();
    this.currentSession = {
      fromTimeframe: fromTf || 'M1',
      toTimeframe: toTf,
      startTime: now,
      dbMs: 0,
      resampleMs: 0,
      inputCandleCount: 0,
      outputCandleCount: 0,
      filterMs: 0,
      filteredCandleCount: 0,
      reactMs: 0,
      setDataMs: 0,
      chartCandleCount: 0,
      viewportMs: 0,
    };
    console.log(`\n====================================================`);
    console.log(`[PROFILE START] Timeframe switch: ${fromTf} → ${toTf}`);
  }

  public isProfiling(): boolean {
    return this.active;
  }

  public getStartTime(): number {
    return this.currentSession.startTime;
  }

  public recordDbQuery(ms: number) {
    this.currentSession.dbMs = ms;
  }

  public recordResample(ms: number, inputCount: number, outputCount: number) {
    this.currentSession.resampleMs = ms;
    this.currentSession.inputCandleCount = inputCount;
    this.currentSession.outputCandleCount = outputCount;
  }

  public recordFilter(ms: number, outputCount: number) {
    this.currentSession.filterMs = ms;
    this.currentSession.filteredCandleCount = outputCount;
  }

  public recordReactRender(ms: number) {
    this.currentSession.reactMs = ms;
  }

  public recordSetData(ms: number, candleCount: number) {
    this.currentSession.setDataMs = ms;
    this.currentSession.chartCandleCount = candleCount;
  }

  public recordViewport(ms: number) {
    this.currentSession.viewportMs = ms;
  }

  public printSummary() {
    if (!this.active) return;
    const totalMs = performance.now() - this.currentSession.startTime;
    const s = this.currentSession;

    console.log(`\n======================`);
    console.log(`DATABASE   : ${s.dbMs.toFixed(2)} ms`);
    console.log(`RESAMPLING : ${s.resampleMs.toFixed(2)} ms`);
    console.log(`FILTER     : ${s.filterMs.toFixed(2)} ms`);
    console.log(`SET DATA   : ${s.setDataMs.toFixed(2)} ms`);
    console.log(`VIEWPORT   : ${s.viewportMs.toFixed(2)} ms`);
    console.log(`TOTAL      : ${totalMs.toFixed(2)} ms`);
    console.log(`======================\n`);

    this.active = false;
  }
}

export const profiler = new TimeframeProfiler();
