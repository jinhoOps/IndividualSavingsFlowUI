import React from 'react';
import { AssetData, SimulationResult } from '../../core/backtest/types';

import { MoneyUtils } from '../../core/types/money';

interface Props {
  results: { asset: AssetData; result: SimulationResult }[];
  isLumpSum: boolean;
  exchangeRate: number;
}

export const KpiGrid: React.FC<Props> = ({ results, isLumpSum, exchangeRate }) => {
  if (results.length === 0) return null;

  const formatWithExchange = (val: number, currency: string, fractionDigits: number = 0) => {
    const safeVal = val || 0;
    if (currency === 'USD') {
      const usdText = `$${safeVal.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
      const krwText = MoneyUtils.formatMan(safeVal * exchangeRate);
      return (
        <div className="flex flex-col">
          <span className="text-lg font-black leading-tight">{usdText}</span>
          <span className="text-[10px] text-muted font-medium">약 {krwText}</span>
        </div>
      );
    }
    return <div className="text-lg font-black">{MoneyUtils.formatMan(safeVal)}</div>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
      {results.map(({ asset, result }) => (
        <div key={asset.id} className={`panel backdrop-blur-md transition-all hover:shadow-lg ${result.isLiquidated ? 'border-red-500/50 bg-red-50/10' : ''}`}>
          <div className="flex justify-between items-start mb-md">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 truncate">{asset.type} • {asset.currency}</div>
              <h3 className="text-sm font-bold text-ink truncate" title={asset.name}>{asset.name}</h3>
            </div>
            {result.isLiquidated ? (
              <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white animate-pulse shrink-0">
                LIQUIDATED
              </div>
            ) : (
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${result.totalReturn >= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                {(result.totalReturn * 100).toFixed(1)}%
              </div>
            )}
          </div>

          <div className="space-y-sm">
            <div className="grid grid-cols-2 gap-x-sm gap-y-3">
              <div className="col-span-2">
                <div className="text-[10px] text-muted font-medium mb-1">최종 평가 금액</div>
                <div className={result.isLiquidated ? 'text-lg font-black text-red-500' : 'text-ink'}>
                  {result.isLiquidated ? '0 원' : formatWithExchange(result.finalValue, asset.currency, 2)}
                </div>
              </div>

              <div className="col-span-1">
                <div className="text-[10px] text-muted font-medium mb-1">총 투자 원금</div>
                <div className="text-sm font-bold text-muted">
                  {asset.currency === 'USD' 
                    ? `$${(result.totalPrincipal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
                    : MoneyUtils.formatMan(result.totalPrincipal || 0)}
                </div>
              </div>

              <div className="col-span-1">
                <div className="text-[10px] text-muted font-medium mb-1">누적 수익금</div>
                <div className={`text-sm font-bold ${result.isLiquidated ? 'text-red-500' : result.totalReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {asset.currency === 'USD' 
                    ? `${result.totalReturn >= 0 ? '+' : ''}$${(result.finalValue - (result.totalPrincipal || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `${result.totalReturn >= 0 ? '+' : ''}${MoneyUtils.formatMan(result.finalValue - (result.totalPrincipal || 0))}`
                  }
                </div>
              </div>
              
              {!result.isLiquidated && result.finalAnnualDividend > 0 && (
                <div className="col-span-2 py-2 px-2 bg-green-50/50 rounded-sm border border-green-100/50">
                  <div className="text-[9px] text-green-700 font-bold uppercase tracking-tighter">예상 연 배당금 (최종 시점)</div>
                  <div className="text-sm font-black text-green-600">
                    {asset.currency === 'USD' 
                      ? (
                        <div className="flex flex-col">
                          <span className="leading-tight">${(result.finalAnnualDividend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-[10px] text-green-700/60 font-medium">약 {MoneyUtils.formatMan((result.finalAnnualDividend || 0) * exchangeRate)}</span>
                        </div>
                      )
                      : MoneyUtils.formatMan(result.finalAnnualDividend || 0)}
                    <span className="text-[10px] font-medium ml-1">/ year</span>
                  </div>
                </div>
              )}

              {result.isLiquidated && (
                <div className="col-span-2 text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded border border-red-100">
                  청산일: {result.liquidationDate}
                </div>
              )}

              <div className="pt-sm border-t border-line">
                <div className="text-[9px] text-muted font-medium mb-1">누적 수익률</div>
                <div className={`text-sm font-bold ${result.isLiquidated ? 'text-red-500' : result.totalReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {(result.totalReturn * 100).toFixed(1)}%
                </div>
              </div>

              <div className="pt-sm border-t border-line">
                <div className="text-[9px] text-muted font-medium mb-1">
                  {isLumpSum ? 'CAGR (연평균)' : 'IRR (연환산)'}
                </div>
                <div className={`text-sm font-bold ${result.isLiquidated ? 'text-red-500' : (isLumpSum ? result.cagr : result.irr) >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {result.isLiquidated ? '-100%' : `${((isLumpSum ? result.cagr : result.irr) * 100).toFixed(2)}%`}
                </div>
              </div>

              <div className="col-span-2 pt-sm border-t border-line">
                <div className="text-[9px] text-muted font-medium mb-1">MDD (최대낙폭)</div>
                <div className="text-sm font-bold text-ink">
                  {(result.mdd * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
