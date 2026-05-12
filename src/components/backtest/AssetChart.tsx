import React, { useMemo, useRef, useState } from 'react';
import { AssetData, SimulationResult } from '../../core/backtest/types';
import { CHART_COLORS } from './BacktestDashboard';
import { MoneyUtils } from '../../core/types/money';

interface Props {
  results: { asset: AssetData; result: SimulationResult }[];
  relativeMode: boolean;
  benchmarkId: string;
  exchangeRate: number;
}

export const AssetChart: React.FC<Props> = ({ results, relativeMode, benchmarkId, exchangeRate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; closest: any } | null>(null);

  const colors = CHART_COLORS;

  const formatValue = (val: number, currency: string, isRelative: boolean) => {
    if (isRelative) return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    const safeVal = val || 0;
    if (currency === 'USD') {
      const usdText = `$${safeVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      const krwText = MoneyUtils.formatMan(safeVal * exchangeRate);
      return `${usdText} (${krwText})`;
    }
    return MoneyUtils.formatMan(safeVal);
  };

  const chartData = useMemo(() => {
    if (results.length === 0) return null;

    // 모든 시계열 데이터를 날짜별로 통합
    const allDates = Array.from(new Set(results.flatMap(r => r.result.history.map(h => h.date)))).sort();
    
    // 벤치마크 데이터 및 자산 정보 추출
    const benchmarkItem = results.find(r => r.asset.id === benchmarkId);
    const benchmarkResult = benchmarkItem?.result;
    const benchmarkAsset = benchmarkItem?.asset;

    const data = allDates.map(date => {
      const point: Record<string, any> = { date, time: new Date(date).getTime() };
      
      let benchmarkValue = 1;
      if (relativeMode && benchmarkResult) {
        const h = benchmarkResult.history.find(h => h.date === date);
        if (h) benchmarkValue = h.value;
      }

      results.forEach(r => {
        const h = r.result.history.find(h => h.date === date);
        if (h) {
          if (relativeMode) {
            // 상대 수익률 계산 시 모든 가치를 KRW로 환산하여 비교 (투자 원금이 동일하므로 성과 비교 가능)
            const valInKrw = (r.asset.currency === 'USD') ? h.value * exchangeRate : h.value;
            const benchmarkValInKrw = (benchmarkAsset?.currency === 'USD') ? benchmarkValue * exchangeRate : benchmarkValue;
            point[r.asset.id] = benchmarkValInKrw > 0 ? (valInKrw / benchmarkValInKrw - 1) * 100 : 0;
          } else {
            // 환율 적용 전 달러/원화 절대값 유지
            point[r.asset.id] = h.value;
          }
          point[`${r.asset.id}_principal`] = h.principal;
          point[`${r.asset.id}_liquidated`] = h.isLiquidated;
        }
      });
      return point;
    });

    // 스케일 계산 (Y축 눈금용 - 상대모드가 아닐 때 통화가 섞여있으면 원화 환산 기준으로 스케일링 권장하지만, 여기서는 단순화)
    const allValuesForScale = data.flatMap(d => results.map(r => {
      const v = d[r.asset.id];
      if (v === undefined) return undefined;
      // 스케일링을 위해 USD 자산은 환율 적용한 원화 기준으로 변환
      return (!relativeMode && r.asset.currency === 'USD') ? v * exchangeRate : v;
    }).filter(v => v !== undefined) as number[]);

    const minVal = Math.min(...allValuesForScale, 0);
    const maxVal = Math.max(...allValuesForScale, 1);
    const minTime = data[0].time;
    const maxTime = data[data.length - 1].time;

    return { data, minVal, maxVal, minTime, maxTime, allDates };
  }, [results, relativeMode, benchmarkId, exchangeRate]);

  if (!chartData || chartData.data.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted border-2 border-dashed border-line rounded-md">
        비교할 데이터를 선택해주세요.
      </div>
    );
  }

  const padding = { top: 40, right: 30, bottom: 40, left: 70 };
  const width = 800; 
  const height = 400;

  const getX = (time: number) => padding.left + ((time - chartData.minTime) / (chartData.maxTime - chartData.minTime)) * (width - padding.left - padding.right);
  const getY = (val: number, asset?: AssetData) => {
    // 렌더링 시 USD 자산은 환율 적용된 원화 스케일에 맞춤
    const scaledVal = (!relativeMode && asset?.currency === 'USD') ? val * exchangeRate : val;
    return height - padding.bottom - ((scaledVal - chartData.minVal) / (chartData.maxVal - chartData.minVal)) * (height - padding.top - padding.bottom);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full group font-body select-none">
      {/* 범례 (Legend) */}
      <div className="absolute top-0 left-0 right-0 flex flex-wrap justify-center gap-x-md gap-y-1 mb-md z-10">
        {results.map((r, i) => (
          <div key={r.asset.id} className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="w-2.5 h-1 rounded-pill" style={{ backgroundColor: colors[i % colors.length] }}></span>
            <span className="text-muted">{r.asset.name}</span>
          </div>
        ))}
      </div>

      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full overflow-visible mt-4"
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const svgX = (e.clientX - rect.left) * (width / rect.width);
          
          if (svgX < padding.left || svgX > width - padding.right) {
            setTooltip(null);
            return;
          }

          // 가장 가까운 날짜 찾기
          const time = chartData.minTime + ((svgX - padding.left) / (width - padding.left - padding.right)) * (chartData.maxTime - chartData.minTime);
          const closest = chartData.data.reduce((prev, curr) => 
            Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
          );

          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            closest
          });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y축 그리드 & 라벨 (원화 환산 기준) */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const val = chartData.minVal + (chartData.maxVal - chartData.minVal) * p;
          const y = height - padding.bottom - ((val - chartData.minVal) / (chartData.maxVal - chartData.minVal)) * (height - padding.top - padding.bottom);
          
          let label = '';
          if (relativeMode) {
            label = `${val >= 0 ? '+' : ''}${val.toFixed(0)}%`;
          } else {
            // MoneyUtils.formatMan을 사용하여 억/만 단위 일관성 유지
            label = MoneyUtils.formatMan(val).replace(' 만원', '만').replace(' 억원', '억').replace(' 억 ', '억');
          }

          return (
            <g key={p}>
              <line 
                x1={padding.left} y1={y} x2={width - padding.right} y2={y} 
                stroke="var(--line)" strokeWidth="0.5" strokeDasharray={p === 0 ? "" : "4 4"} 
              />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)" className="font-mono">
                {label}
              </text>
            </g>
          );
        })}

        {/* 0선 (상대 모드용) */}
        {relativeMode && (
          <line 
            x1={padding.left} y1={height - padding.bottom - ((0 - chartData.minVal) / (chartData.maxVal - chartData.minVal)) * (height - padding.top - padding.bottom)} 
            x2={width - padding.right} y2={height - padding.bottom - ((0 - chartData.minVal) / (chartData.maxVal - chartData.minVal)) * (height - padding.top - padding.bottom)} 
            stroke="var(--ink)" strokeWidth="1" strokeOpacity="0.3"
          />
        )}

        {/* X축 날짜 라벨 */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const time = chartData.minTime + (chartData.maxTime - chartData.minTime) * p;
          const x = getX(time);
          return (
            <text key={p} x={x} y={height - padding.bottom + 24} textAnchor="middle" fontSize="10" fill="var(--muted)" className="font-mono">
              {new Date(time).toLocaleDateString('ko-KR', { year: 'numeric' }).slice(0, 4)}
            </text>
          );
        })}

        {/* 세로 안내선 (Crosshair) */}
        {tooltip && (
          <line 
            x1={getX(tooltip.closest.time)} y1={padding.top} 
            x2={getX(tooltip.closest.time)} y2={height - padding.bottom} 
            stroke="var(--primary)" strokeWidth="1" strokeDasharray="4 2"
          />
        )}

        {/* 선 렌더링 */}
        {results.map((r, i) => {
          const pathData = chartData.data
            .filter(d => d[r.asset.id] !== undefined)
            .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(d.time)} ${getY(d[r.asset.id], r.asset)}`)
            .join(' ');

          return (
            <g key={r.asset.id}>
              <path 
                d={pathData}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
              {/* 호버 시 해당 지점 강조 원 */}
              {tooltip && tooltip.closest[r.asset.id] !== undefined && (
                <circle 
                  cx={getX(tooltip.closest.time)} 
                  cy={getY(tooltip.closest[r.asset.id], r.asset)} 
                  r="4" 
                  fill={colors[i % colors.length]}
                  stroke="white"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* 툴팁 개선 */}
      {tooltip && (
        <div 
          className="absolute z-50 pointer-events-none transition-transform duration-75 shadow-float"
          style={{ 
            left: tooltip.x > containerRef.current!.offsetWidth / 2 ? tooltip.x - 220 : tooltip.x + 20,
            top: Math.min(tooltip.y, containerRef.current!.offsetHeight - 180)
          }}
        >
          <div className="p-3 bg-panel/90 backdrop-blur-md border border-line rounded-md text-[11px] min-w-[200px]">
            <div className="font-black border-b border-line mb-sm pb-sm text-ink flex justify-between items-center">
              <span>{new Date(tooltip.closest.time).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}</span>
              {relativeMode && <span className="text-[9px] px-1 bg-line-strong rounded text-muted">상대</span>}
            </div>
            <div className="space-y-2">
              {results.map((r, i) => {
                const val = tooltip.closest[r.asset.id];
                const principal = tooltip.closest[`${r.asset.id}_principal`];
                const profitRate = principal > 0 ? (val - principal) / principal * 100 : 0;

                return (
                  <div key={r.asset.id} className="border-l-2 pl-2" style={{ borderColor: colors[i % colors.length] }}>
                    <div className="flex justify-between gap-md items-center mb-0.5">
                      <span className="text-muted truncate max-w-[120px] font-bold">
                        {r.asset.name}
                      </span>
                      <span className={`font-mono font-black ${tooltip.closest[`${r.asset.id}_liquidated`] ? 'text-red-500' : 'text-ink'}`}>
                        {tooltip.closest[`${r.asset.id}_liquidated`] 
                          ? '청산'
                          : formatValue(val, r.asset.currency, relativeMode)
                        }
                      </span>
                    </div>
                    {!relativeMode && !tooltip.closest[`${r.asset.id}_liquidated`] && val !== undefined && (
                      <div className="flex justify-between text-[9px] text-muted">
                        <span>원금: {r.asset.currency === 'USD' ? `$${(principal || 0).toLocaleString()} (약 ${MoneyUtils.formatMan((principal || 0) * exchangeRate)})` : MoneyUtils.formatMan(principal || 0)}</span>
                        <span className={profitRate >= 0 ? 'text-red-500' : 'text-blue-500'}>
                          ({profitRate >= 0 ? '+' : ''}{profitRate.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
