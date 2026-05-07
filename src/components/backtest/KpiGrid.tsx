import React from 'react';
import { AssetData, SimulationResult } from '../../core/backtest/types';

interface Props {
  results: { asset: AssetData; result: SimulationResult }[];
  isLumpSum: boolean;
}

export const KpiGrid: React.FC<Props> = ({ results, isLumpSum }) => {
  if (results.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
      {results.map(({ asset, result }) => (
        <div key={asset.id} className={`panel backdrop-blur-md transition-all hover:shadow-lg ${result.isLiquidated ? 'border-red-500/50 bg-red-50/10' : ''}`}>
          <div className="flex justify-between items-start mb-md">
            <div>
              <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{asset.type}</div>
              <h3 className="text-sm font-bold text-ink">{asset.name}</h3>
            </div>
            {result.isLiquidated ? (
              <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white animate-pulse">
                LIQUIDATED
              </div>
            ) : (
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${result.totalReturn >= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                {(result.totalReturn * 100).toFixed(1)}%
              </div>
            )}
          </div>

          <div className="space-y-sm">
            <div>
              <div className="text-[10px] text-muted font-medium">최종 평가 금액</div>
              <div className={`text-lg font-black ${result.isLiquidated ? 'text-red-500' : 'text-ink'}`}>
                {result.isLiquidated ? '0' : (result.finalValue / 10000).toLocaleString()} <span className="text-xs font-normal text-muted">만원</span>
              </div>
              {result.isLiquidated && (
                <div className="text-[10px] text-red-500 font-bold mt-1">
                  청산일: {result.liquidationDate}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-sm pt-sm border-t border-line">
              <div>
                <div className="text-[9px] text-muted font-medium flex items-center gap-1">
                  {isLumpSum ? 'CAGR (연평균)' : '원금 대비 수익'}
                </div>
                <div className={`text-sm font-bold ${result.isLiquidated ? 'text-red-500' : 'text-ink'}`}>
                  {result.isLiquidated ? '-100%' : (isLumpSum ? `${(result.cagr * 100).toFixed(2)}%` : `${((result.finalValue - result.totalPrincipal) / 10000).toLocaleString()}만`)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-muted font-medium flex items-center gap-1">
                  MDD (최대낙폭)
                </div>
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
