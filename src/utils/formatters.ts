/**
 * Shared Currency Formatter
 * Formats numbers into standard currency format: $1,000.00, $100,060.68
 */
export function formatCurrency(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats signed currency output: +$60.68 or -$50.00
 */
export function formatSignedCurrency(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  return `${sign}${formatted}`;
}
