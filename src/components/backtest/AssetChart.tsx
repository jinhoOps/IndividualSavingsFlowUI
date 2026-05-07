import React, { useMemo, useRef, useState } from 'react';
import { AssetData, SimulationResult } from '../../core/backtest/types';

interface Props {
  results: { asset: AssetData; result: SimulationResult }[];
  relativeMode: boolean;
  benchmarkId: string;
}

export const AssetChart: React.FC<Props> = ({ results, relativeMode, benchmarkId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const colors = ['#ea5b2a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const chartData = useMemo(() => {
    if (results.length === 0) return null;

    // 모든 시계열 데이터를 날짜별로 통합
    const allDates = Array.from(new Set(results.flatMap(r => r.result.history.map(h => h.date)))).sort();
    
    // 벤치마크 데이터 추출
    const benchmarkResult = results.find(r => r.asset.id === benchmarkId)?.result;

    const data = allDates.map(date => {
      const point: Record<string, number> = { time: new Date(date).getTime() };
      
      let benchmarkValue = 1;
      if (relativeMode && benchmarkResult) {
        const h = benchmarkResult.history.find(h => h.date === date);
        if (h) benchmarkValue = h.value;
      }

      results.forEach(r => {
        const h = r.result.history.find(h => h.date === date);
        if (h) {
          if (relativeMode) {
            // 상대 수익률: (내 가치 / 벤치마크 가치 - 1) * 100
            point[r.asset.id] = (h.value / benchmarkValue - 1) * 100;
          } else {
            point[r.asset.id] = h.value;
          }
        }
      });
      return point;
    });

    // 스케일 계산
    const allValues = data.flatMap(d => results.map(r => d[r.asset.id]).filter(v => v !== undefined));
    const minVal = Math.min(...allValues, 0);
    const maxVal = Math.max(...allValues, 1);
    const minTime = data[0].time;
    const maxTime = data[data.length - 1].time;

    return { data, minVal, maxVal, minTime, maxTime, allDates };
  }, [results, relativeMode, benchmarkId]);

  if (!chartData || chartData.data.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
        비교할 데이터를 선택해주세요.
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = 800; // 가상 너비 (viewBox 사용)
  const height = 400;

  const getX = (time: number) => padding.left + ((time - chartData.minTime) / (chartData.maxTime - chartData.minTime)) * (width - padding.left - padding.right);
  const getY = (val: number) => height - padding.bottom - ((val - chartData.minVal) / (chartData.maxVal - chartData.minVal)) * (height - padding.top - padding.bottom);

  return (
    <div ref={containerRef} className="relative w-full h-full group">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full overflow-visible"
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const svgX = (e.clientX - rect.left) * (width / rect.width);
          
          // 가장 가까운 날짜 찾기
          const time = chartData.minTime + ((svgX - padding.left) / (width - padding.left - padding.right)) * (chartData.maxTime - chartData.minTime);
          const closest = chartData.data.reduce((prev, curr) => 
            Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
          );

          setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            content: (
              <div className="p-2 bg-white shadow-xl border border-gray-100 rounded-lg text-xs pointer-events-none">
                <div className="font-bold border-b border-gray-50 mb-1 pb-1">
                  {new Date(closest.time).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}
                </div>
                {results.map((r, i) => (
                  <div key={r.asset.id} className="flex justify-between gap-4 py-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></span>
                      {r.asset.name}
                    </span>
                    <span className="font-mono font-bold">
                      {relativeMode 
                        ? `${closest[r.asset.id].toFixed(2)}%`
                        : `${(closest[r.asset.id] / 10000).toLocaleString()}만원`
                      }
                    </span>
                  </div>
                ))}
              </div>
            )
          });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* 그리드 라인 */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const val = chartData.minVal + (chartData.maxVal - chartData.minVal) * p;
          const y = getY(val);
          return (
            <g key={p}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {relativeMode ? `${val.toFixed(0)}%` : `${(val / 10000).toLocaleString()}`}
              </text>
            </g>
          );
        })}

        {/* 0선 (상대 모드용) */}
        {relativeMode && (
          <line 
            x1={padding.left} y1={getY(0)} x2={width - padding.right} y2={getY(0)} 
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" 
          />
        )}

        {/* 선 렌더링 */}
        {results.map((r, i) => {
          const path = chartData.data
            .filter(d => d[r.asset.id] !== undefined)
            .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(d.time)} ${getY(d[r.asset.id])}`)
            .join(' ');

          return (
            <path 
              key={r.asset.id}
              d={path}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          );
        })}

        {/* 날짜 축 */}
        {[0, 0.5, 1].map(p => {
          const time = chartData.minTime + (chartData.maxTime - chartData.minTime) * p;
          const x = getX(time);
          return (
            <text key={p} x={x} y={height - padding.bottom + 20} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {new Date(time).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' })}
            </text>
          );
        })}
      </svg>

      {/* 툴팁 */}
      {tooltip && (
        <div 
          className="absolute z-50 pointer-events-none transition-transform duration-75"
          style={{ transform: `translate(${tooltip.x + 10}px, ${tooltip.y + 10}px)` }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};
