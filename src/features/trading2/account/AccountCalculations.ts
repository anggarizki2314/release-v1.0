/**
 * Trading Engine 2.0 — Account Calculations
 * Pure calculation functions for Account metrics.
 * Equity = Balance + FloatingPnL
 * Free Margin = Equity - Margin
 * Margin Level = (Equity / Margin) * 100 (Infinity when Margin = 0)
 * Pure, side-effect-free functions. Zero Replay, UI, or DOM dependencies.
 */

export class AccountCalculations {
  /**
   * Equity = Balance + FloatingPnL
   */
  public static calculateEquity(balance: number, floatingPnL: number): number {
    return balance + floatingPnL;
  }

  /**
   * Free Margin = Equity - Margin
   */
  public static calculateFreeMargin(equity: number, margin: number): number {
    return equity - margin;
  }

  /**
   * Margin Level = (Equity / Margin) * 100
   * When Margin === 0, returns Infinity.
   */
  public static calculateMarginLevel(equity: number, margin: number): number | typeof Infinity {
    if (margin <= 0) {
      return Infinity;
    }
    return (equity / margin) * 100;
  }

  /**
   * Total Floating PnL = sum of floating PnLs across all open positions
   */
  public static calculateFloatingPnL(floatingPnlList: ReadonlyArray<number>): number {
    return floatingPnlList.reduce((sum, pnl) => sum + pnl, 0);
  }

  /**
   * High Water Mark = Math.max(previousPeak, currentEquity)
   */
  public static calculateHighWaterMark(previousPeak: number, currentEquity: number): number {
    return Math.max(previousPeak, currentEquity);
  }
}
