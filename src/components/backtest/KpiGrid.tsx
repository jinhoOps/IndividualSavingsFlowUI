import React from 'react';
import { AssetData, SimulationResult } from '../../core/backtest/types';

interface Props {
  results: { asset: AssetData; result: SimulationResult }[];
  isLumpSum: boolean;
}

export const KpiGrid: React.FC<Props> = ({ results, isLumpSum }) => {
  if (results.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {results.map(({ asset, result }) => (
        <div key={asset.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{asset.type}</div>
              <h3 className="text-sm font-bold text-gray-700">{asset.name}</h3>
            </div>
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${result.totalReturn >= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
              {(result.totalReturn * 100).toFixed(1)}%
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-gray-400 font-medium">최종 평가 금액</div>
              <div className="text-lg font-black text-gray-800">
                {(result.finalValue / 10000).toLocaleString()} <span className="text-xs font-normal text-gray-400">만원</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50">
              <div>
                <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                  {isLumpSum ? 'CAGR (연평균)' : '원금 대비 수익'}
                  <span className="cursor-help" title={isLumpSum ? '매년 일정한 수익률로 성장했다고 가정했을 때의 평균 수익률' : '투입된 총 원금 대비 최종 수익의 비율'}>ⓘ</span>
                </div>
                <div className="text-sm font-bold text-gray-700">
                  {isLumpSum ? `${(result.cagr * 100).toFixed(2)}%` : `${((result.finalValue - result.totalPrincipal) / 10000).toLocaleString()}만`}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-gray-400 font-medium flex items-center gap-1">
                  MDD (최대낙폭)
                  <span className="cursor-help" title="최고점 대비 발생한 최대 하락 비율. 투자 중 겪을 수 있는 가장 큰 손실폭">ⓘ</span>
                </div>
                <div className="text-sm font-bold text-gray-700">
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
