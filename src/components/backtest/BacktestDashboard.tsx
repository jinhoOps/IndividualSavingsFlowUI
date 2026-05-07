import React, { useState, useEffect, useMemo } from 'react';
import { AssetData, SimulationParams, SimulationResult, TimeSeriesPoint } from '../../core/backtest/types';
import { BacktestEngine } from '../../core/backtest/engine';
import { AssetChart } from './AssetChart';
import { KpiGrid } from './KpiGrid';
import { SimulationWarning } from './SimulationWarning';
import { Toast } from '../common/Toast';

export const CHART_COLORS = ['#ea5b2a', '#1e8b7c', '#3175b6', '#5d4fb3', '#8c3d65', '#f59e0b', '#10b981', '#6366f1'];

export const BacktestDashboard: React.FC = () => {
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(['qqq', 'spy']);
  // ... rest of state
  const [params, setParams] = useState<SimulationParams>({
    initialPrincipal: 10000000,
    monthlyInstallment: 1000000,
    startDate: '2000-01-01',
    endDate: '2026-03-01',
    reinvestDividends: true,
  });
  const [relativeMode, setRelativeMode] = useState(false);
  const [benchmarkAssetId, setBenchmarkAssetId] = useState<string>('qqq');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 데이터 로드 및 가상 자산 합성
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL;
        const paths = [
          { id: 'qqq', path: `${baseUrl}data/indices/qqq.json` },
          { id: 'spy', path: `${baseUrl}data/indices/spy.json` },
          { id: 'gold', path: `${baseUrl}data/indices/gold.json` }
        ];
        
        const loadedIndices = await Promise.all(paths.map((p: { id: string; path: string }) => fetch(p.path).then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })));
        
        const qqq = loadedIndices.find(a => a.id === 'qqq')!;
        const spy = loadedIndices.find(a => a.id === 'spy')!;
        
        // 1. 레버리지 자산 합성 (QLD, TQQQ)
        const createLeveraged = (base: AssetData, id: string, name: string, leverage: number): AssetData => {
          const leveragedData = [...base.data];
          const resultData = [leveragedData[0]];
          
          for (let i = 1; i < leveragedData.length; i++) {
            const prevBase = leveragedData[i-1].price;
            const currBase = leveragedData[i].price;
            const baseReturn = (currBase - prevBase) / prevBase;
            
            const prevLev = resultData[i-1].price;
            // 레버리지 수익률 계산 (운용 보수 등 단순화)
            const levPrice = prevLev * (1 + (baseReturn * leverage));
            
            resultData.push({
              date: leveragedData[i].date,
              price: Math.max(0.01, levPrice), // 0 이하 방지
              dividendYield: (leveragedData[i].dividendYield || 0) * 0.5 // 레버리지 분배금은 적음
            });
          }
          
          return {
            id,
            name,
            type: 'leveraged',
            currency: base.currency,
            leverage,
            baseAssetId: base.id,
            data: resultData
          };
        };

        const qld = createLeveraged(qqq, 'qld', 'ProShares Ultra QQQ (QLD, 2x)', 2);
        const tqqq = createLeveraged(qqq, 'tqqq', 'ProShares UltraPro QQQ (TQQQ, 3x)', 3);

        // 2. 추가 지수 합성 (Mock: SCHD, 코스피)
        const schd: AssetData = {
          ...spy,
          id: 'schd',
          name: 'Schwab US Dividend Equity (SCHD)',
          data: spy.data.map((p: TimeSeriesPoint) => ({ ...p, price: p.price * 0.75, dividendYield: 0.035 / 12 })) // SCHD 특성 모사 (높은 배당)
        };

        const kospi: AssetData = {
          ...spy,
          id: 'kospi',
          name: 'KOSPI 200 (Mock)',
          currency: 'KRW',
          data: spy.data.map((p: TimeSeriesPoint) => ({ ...p, price: p.price * 1000 })) // 원화 단위 환산 모사
        };

        // 3. 금리 자산 합성 (US/KR 기준금리, 적금)
        const createRateAsset = (id: string, name: string, rate: number, isKRW: boolean = true): AssetData => ({
          id,
          name,
          type: 'rate',
          currency: isKRW ? 'KRW' : 'USD',
          data: qqq.data.map((p: any) => ({
            date: p.date,
            price: 100,
            dividendYield: rate / 12
          }))
        });

        const usRate = createRateAsset('us-rate', 'US Fed Funds Rate (5.25%)', 0.0525, false);
        const krRate = createRateAsset('kr-rate', '한국 기준금리 (3.5%)', 0.035, true);
        const savings = createRateAsset('savings', '정기적금 (금리+1%)', 0.045, true);

        const allAssets = [
          ...loadedIndices, 
          qld, tqqq, schd, kospi, 
          usRate, krRate, savings
        ];
        setAssets(allAssets);

        // 데이터 범위에 맞게 초기 기간 설정
        const qqqDates = qqq.data.map((d: TimeSeriesPoint) => d.date).sort();
        if (qqqDates.length > 0) {
          setParams(p => ({
            ...p,
            startDate: qqqDates[0],
            endDate: qqqDates[qqqDates.length - 1]
          }));
        }
      } catch (error) {
        console.error('Failed to load asset data:', error);
        setToastMessage('데이터를 불러오는데 실패했습니다.');
      }
    };
    loadAssets();
  }, []);

  // 유효한 날짜 범위 계산
  const dateRange = useMemo(() => {
    if (assets.length === 0) return { min: '2000-01', max: '2026-03' };
    const qqq = assets.find(a => a.id === 'qqq');
    if (!qqq) return { min: '2000-01', max: '2026-03' };
    const dates = qqq.data.map(d => d.date).sort();
    return {
      min: dates[0].slice(0, 7),
      max: dates[dates.length - 1].slice(0, 7)
    };
  }, [assets]);

  // 시뮬레이션 계산
  const results = useMemo(() => {
    return selectedAssetIds.map(id => {
      const asset = assets.find(a => a.id === id);
      if (!asset) return null;
      try {
        return {
          asset,
          result: BacktestEngine.run(asset, params)
        };
      } catch (e) {
        return null;
      }
    }).filter(r => r !== null) as { asset: AssetData; result: SimulationResult }[];
  }, [assets, selectedAssetIds, params]);

  const selectedAssets = useMemo(() => 
    assets.filter(a => selectedAssetIds.includes(a.id)),
    [assets, selectedAssetIds]
  );

  return (
    <div className="flex flex-col lg:flex-row gap-lg p-md lg:p-lg min-h-screen bg-canvas text-ink font-body">
      {/* 사이드바: 설정 영역 */}
      <aside className="w-full lg:w-80 flex flex-col gap-lg">
        <section className="panel backdrop-blur-md">
          <h2 className="text-title-md font-bold mb-md flex items-center gap-sm">
            <span className="w-1.5 h-6 bg-primary rounded-pill"></span>
            시뮬레이션 설정
          </h2>
          
          <div className="space-y-md">
            <div>
              <div className="flex justify-between items-center mb-sm">
                <label className="text-caption font-bold text-muted">비교 자산 선택</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedAssetIds(assets.map(a => a.id))}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    전체 선택
                  </button>
                  <button 
                    onClick={() => setSelectedAssetIds([])}
                    className="text-[10px] font-bold text-muted hover:underline"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-sm custom-scrollbar bg-line/10 p-sm rounded-sm">
                {assets.map(asset => (
                  <label key={asset.id} className={`flex items-center gap-sm p-sm hover:bg-line rounded-sm cursor-pointer transition-colors ${selectedAssetIds.includes(asset.id) ? 'bg-line/50' : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedAssetIds.includes(asset.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAssetIds([...selectedAssetIds, asset.id]);
                        } else {
                          setSelectedAssetIds(selectedAssetIds.filter(id => id !== asset.id));
                        }
                      }}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <div className="flex flex-col">
                      <span className="text-body-sm font-bold">{asset.name}</span>
                      <span className="text-[9px] text-muted uppercase font-mono">{asset.currency} • {asset.type}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-line" />

            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">시작 월</label>
                <input 
                  type="month"
                  value={params.startDate.slice(0, 7)}
                  min={dateRange.min}
                  max={params.endDate.slice(0, 7)}
                  onChange={(e) => setParams({ ...params, startDate: `${e.target.value}-01` })}
                  className="w-full font-bold text-xs p-sm bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">종료 월</label>
                <input 
                  type="month"
                  value={params.endDate.slice(0, 7)}
                  min={params.startDate.slice(0, 7)}
                  max={dateRange.max}
                  onChange={(e) => setParams({ ...params, endDate: `${e.target.value}-01` })}
                  className="w-full font-bold text-xs p-sm bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <hr className="border-line" />

            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">초기 투자금</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={params.initialPrincipal / 10000}
                    onChange={(e) => setParams({ ...params, initialPrincipal: Number(e.target.value) * 10000 })}
                    className="w-full font-black text-lg p-sm pr-8 bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">만원</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">월 적립액</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={params.monthlyInstallment / 10000}
                    onChange={(e) => setParams({ ...params, monthlyInstallment: Number(e.target.value) * 10000 })}
                    className="w-full font-black text-lg p-sm pr-8 bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">만원</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-sm bg-line/30 rounded-md">
              <span className="text-caption font-bold text-muted">배당 재투자 (TR)</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  checked={params.reinvestDividends}
                  onChange={(e) => {
                    setParams({ ...params, reinvestDividends: e.target.checked });
                    setToastMessage(e.target.checked ? '배당 재투자가 활성화되었습니다.' : '배당 재투자가 해제되었습니다.');
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-line-strong peer-focus:outline-none rounded-pill peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <hr className="border-line" />

            <div className="space-y-sm">
              <label className="flex items-center gap-sm cursor-pointer group">
                <input 
                  type="checkbox"
                  checked={relativeMode}
                  onChange={(e) => {
                    setRelativeMode(e.target.checked);
                    if (e.target.checked) setToastMessage('상대 비교 모드가 활성화되었습니다.');
                  }}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-caption font-bold text-muted group-hover:text-primary transition-colors">상대 비교 모드 (Relative)</span>
              </label>
              {relativeMode && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 ml-6">
                  <label className="block text-[10px] font-bold text-muted uppercase mb-1">기준 자산 설정</label>
                  <select 
                    value={benchmarkAssetId}
                    onChange={(e) => setBenchmarkAssetId(e.target.value)}
                    className="w-full font-medium"
                  >
                    {selectedAssets.map(asset => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <SimulationWarning params={params} selectedAssets={selectedAssets} />
          </div>
        </section>

        <section className="bg-gradient-to-br from-primary to-[#ff7e5f] p-lg rounded-md shadow-float text-white">
          <h3 className="text-caption font-bold opacity-80 mb-sm">💡 투자 팁</h3>
          <p className="text-[13px] leading-relaxed opacity-95">
            장기 투자 시 배당 재투자(TR) 옵션은 최종 성과에 지대한 영향을 미칩니다. 
            나스닥과 S&P 500의 TR 차이를 비교해보세요.
          </p>
        </section>
      </aside>

      {/* 메인 콘텐츠: 차트 및 결과 */}
      <main className="flex-1 flex flex-col gap-lg overflow-hidden">
        <section className="panel backdrop-blur-md flex-1 flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center mb-lg">
            <h2 className="text-title-md font-bold flex items-center gap-sm">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
              자산 수익률 추이
            </h2>
            <div className="flex gap-sm">
              <span className="px-sm py-1 bg-line rounded-pill text-[10px] font-bold text-muted">
                {params.startDate} ~ {params.endDate}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <AssetChart 
              results={results} 
              relativeMode={relativeMode} 
              benchmarkId={benchmarkAssetId} 
            />
          </div>
        </section>

        <KpiGrid results={results} isLumpSum={params.monthlyInstallment === 0} />
      </main>

      {toastMessage && (
        <Toast 
          message={toastMessage} 
          onClose={() => setToastMessage(null)} 
        />
      )}
    </div>
  );
};
