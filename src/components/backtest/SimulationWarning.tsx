import React from 'react';
import { SimulationParams, AssetData } from '../../core/backtest/types';

interface Props {
  params: SimulationParams;
  selectedAssets: AssetData[];
}

export const SimulationWarning: React.FC<Props> = ({ params, selectedAssets }) => {
  const warnings: string[] = [];

  // 1. 적금/금리형 자산인데 거치식으로 설정한 경우
  const hasRateAsset = selectedAssets.some(a => a.type === 'rate');
  if (hasRateAsset && params.monthlyInstallment === 0 && params.initialPrincipal > 0) {
    warnings.push('기준금리/적금형 자산의 경우, 거치식 시뮬레이션 시 실제 예금 금리보다 높게 계산될 수 있습니다 (실제로는 단리 적용 상품이 많음).');
  }

  // 2. 시뮬레이션 기간이 너무 짧은 경우
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  const monthDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (monthDiff < 12) {
    warnings.push('시뮬레이션 기간이 1년 미만입니다. 단기 성과는 통계적 유의성이 낮을 수 있습니다.');
  }

  if (warnings.length === 0) return null;

  return (
    <div className="bg-amber-50/50 border border-amber-200/50 p-md rounded-md space-y-2">
      {warnings.map((w, i) => (
        <div key={i} className="flex gap-2 text-[11px] text-amber-800 leading-relaxed">
          <span className="shrink-0">⚠️</span>
          <p>{w}</p>
        </div>
      ))}
    </div>
  );
};
