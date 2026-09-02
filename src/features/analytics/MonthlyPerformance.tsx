import React from 'react';
import { Calendar } from 'lucide-react';
import { MOCK_MONTHLY_RETURNS } from './mockData';
import './MonthlyPerformance.css';

export const MonthlyPerformance: React.FC = () => {
  return (
    <div className="monthly-perf">
      <div className="monthly-perf__header">
        <Calendar size={18} className="monthly-perf__icon" />
        <h3 className="monthly-perf__title">Monthly Performance Breakdown</h3>
      </div>

      <div className="monthly-perf__table-wrap">
        <table className="monthly-perf__table">
          <thead>
            <tr>
              <th>Month / Year</th>
              <th>Trades Executed</th>
              <th>Win Rate</th>
              <th>Net PnL ($)</th>
              <th>Net Return (%)</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_MONTHLY_RETURNS.map((item, idx) => {
              const isPos = item.pnlDollar >= 0;
              return (
                <tr key={idx}>
                  <td className="monthly-perf__cell-month">
                    {item.month} {item.year}
                  </td>
                  <td>{item.tradesCount} Trades</td>
                  <td>{item.winRate.toFixed(1)}%</td>
                  <td className={isPos ? 'monthly-perf__cell--pos' : 'monthly-perf__cell--neg'}>
                    {isPos ? '+' : ''}${item.pnlDollar.toLocaleString('en-US')}
                  </td>
                  <td className={isPos ? 'monthly-perf__cell--pos' : 'monthly-perf__cell--neg'}>
                    {isPos ? '+' : ''}{item.pnlPercent.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
