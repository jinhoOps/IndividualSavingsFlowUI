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

  // 3. 레버리지 자산 위험 경고
  const hasLeveragedAsset = selectedAssets.some(a => a.type === 'leveraged');
  if (hasLeveragedAsset) {
    warnings.push('레버리지 자산은 변동성 잠식(Volatility Drag)으로 인해 장기 보유 시 기초 지수 수익률의 배수보다 성과가 낮을 수 있으며, 급락 시 원금 전액 손실(청산) 위험이 있습니다.');
  }

  // 4. 데이터 정밀도 경고 (MDD 관련)
  const dailyAssets = selectedAssets.filter(a => a.resolution === 'daily');
  const allDaily = selectedAssets.length > 0 && dailyAssets.length === selectedAssets.length;
  const someDaily = dailyAssets.length > 0 && !allDaily;

  if (allDaily) {
    // 모든 자산이 일간 데이터인 경우 경고 제거 또는 안내로 변경
    // warnings.push('선택한 자산은 일간 종가 데이터를 사용하여 MDD가 정밀하게 계산됩니다.');
  } else if (someDaily) {
    const dailyNames = dailyAssets.map(a => a.name.split(' (')[0]).join(', ');
    warnings.push(`${dailyNames} 등 고해상도 자산은 일간 데이터를 사용하여 MDD가 정밀합니다. 그 외 월간 기준 자산은 실제 MDD가 표시보다 클 수 있습니다.`);
  } else {
    warnings.push('본 시뮬레이션은 월간 종가 데이터를 사용합니다. 일간 변동폭이 반영되지 않아 실제 MDD(최대낙폭)는 표시된 값보다 클 수 있습니다.');
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
