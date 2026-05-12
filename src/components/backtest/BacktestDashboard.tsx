import React, { useState, useEffect, useMemo } from 'react';
import { AssetData, SimulationParams, SimulationResult, TimeSeriesPoint } from '../../core/backtest/types';
import { BacktestEngine } from '../../core/backtest/engine';
import { AssetChart } from './AssetChart';
import { KpiGrid } from './KpiGrid';
import { SimulationWarning } from './SimulationWarning';
import { CalculationGuideModal } from './CalculationGuideModal';
import { Toast } from '../common/Toast';
import { PendingChangesBar } from './PendingChangesBar';

export const CHART_COLORS = ['#ea5b2a', '#1e8b7c', '#3175b6', '#5d4fb3', '#8c3d65', '#f59e0b', '#10b981', '#6366f1'];


type InvestMode = 'lump-sum' | 'dca' | 'mixed';

export const BacktestDashboard: React.FC = () => {
  const [assets, setAssets] = useState<AssetData[]>([]);
  
  // [Applied State] - 실제 계산에 사용되는 상태
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(['qqq', 'spy']);
  const [mode, setMode] = useState<InvestMode>('mixed');
  const [exchangeRate, setExchangeRate] = useState<number>(1450);
  const [params, setParams] = useState<SimulationParams>({
    initialPrincipal: 10000000,
    monthlyInstallment: 1000000,
    startDate: '2000-01-01',
    endDate: '2026-05-01',
    reinvestDividends: true,
  });

  // [Draft State] - UI 조작 중인 임시 상태
  const [draftSelectedAssetIds, setDraftSelectedAssetIds] = useState<string[]>(['qqq', 'spy']);
  const [draftMode, setDraftMode] = useState<InvestMode>('mixed');
  const [draftExchangeRate, setDraftExchangeRate] = useState<number>(1450);
  const [draftParams, setDraftParams] = useState<SimulationParams>({
    initialPrincipal: 10000000,
    monthlyInstallment: 1000000,
    startDate: '2000-01-01',
    endDate: '2026-05-01',
    reinvestDividends: true,
  });

  const [relativeMode, setRelativeMode] = useState(false);
  const [benchmarkAssetId, setBenchmarkAssetId] = useState<string>('qqq');
  const [showGuide, setShowGuide] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 변경 사항 감지 (Dirty Check)
  const isDirty = useMemo(() => {
    if (!isLoaded) return false;

    const assetIdsMatch = 
      selectedAssetIds.length === draftSelectedAssetIds.length && 
      [...selectedAssetIds].sort().join(',') === [...draftSelectedAssetIds].sort().join(',');
    
    const paramsMatch = 
      params.initialPrincipal === draftParams.initialPrincipal &&
      params.monthlyInstallment === draftParams.monthlyInstallment &&
      params.startDate === draftParams.startDate &&
      params.endDate === draftParams.endDate &&
      params.reinvestDividends === draftParams.reinvestDividends;
      
    const modeMatch = mode === draftMode;
    const rateMatch = exchangeRate === draftExchangeRate;

    return !assetIdsMatch || !paramsMatch || !modeMatch || !rateMatch;
  }, [selectedAssetIds, draftSelectedAssetIds, params, draftParams, mode, draftMode, exchangeRate, draftExchangeRate, isLoaded]);

  // 데이터 로드 및 초기 설정
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL;
        const paths = [
          { id: 'qqq', path: `${baseUrl}data/indices/qqq.json` },
          { id: 'spy', path: `${baseUrl}data/indices/spy.json` },
          { id: 'gold', path: `${baseUrl}data/indices/gold.json` },
          { id: 'qld', path: `${baseUrl}data/indices/qld.json` },
          { id: 'tqqq', path: `${baseUrl}data/indices/tqqq.json` },
          { id: 'kospi', path: `${baseUrl}data/indices/kospi.json` },
          { id: 'kosdaq', path: `${baseUrl}data/indices/kosdaq.json` },
          { id: 'schd', path: `${baseUrl}data/indices/schd.json` }
        ];
        
        const loadedIndices = await Promise.all(paths.map((p: { id: string; path: string }) => fetch(p.path).then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })));
        
        const qqq = loadedIndices.find(a => a.id === 'qqq')!;

        // 금리 자산 합성
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

        const usRate = createRateAsset('us-rate', 'US Fed Funds Rate (3.65%)', 0.0365, false);
        const krRate = createRateAsset('kr-rate', '한국 기준금리 (2.5%)', 0.025, true);
        const savings = createRateAsset('savings', '정기적금 (금리+1.5%)', 0.040, true);

        const allAssets = [...loadedIndices, usRate, krRate, savings];
        setAssets(allAssets);

        // 초기 기간 설정 및 로컬 스토리지 복원
        if (!isLoaded) {
          const saved = localStorage.getItem('backtest_settings');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              setSelectedAssetIds(parsed.selectedAssetIds || ['qqq', 'spy']);
              setDraftSelectedAssetIds(parsed.selectedAssetIds || ['qqq', 'spy']);
              
              setMode(parsed.mode || 'mixed');
              setDraftMode(parsed.mode || 'mixed');

              setExchangeRate(parsed.exchangeRate || 1450);
              setDraftExchangeRate(parsed.exchangeRate || 1450);
              
              setParams(p => ({ ...p, ...parsed.params }));
              setDraftParams(p => ({ ...p, ...parsed.params }));
              
              setRelativeMode(parsed.relativeMode || false);
              setBenchmarkAssetId(parsed.benchmarkAssetId || 'qqq');
            } catch (e) {
              console.warn('Failed to parse saved backtest settings');
            }
          } else {
            const qqqDates = qqq.data.map((d: TimeSeriesPoint) => d.date).sort();
            if (qqqDates.length > 0) {
              const newParams = {
                ...params,
                startDate: qqqDates[0],
                endDate: qqqDates[qqqDates.length - 1]
              };
              setParams(newParams);
              setDraftParams(newParams);
            }
          }
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load asset data:', error);
        setToastMessage('데이터를 불러오는데 실패했습니다.');
      }
    };
    loadAssets();
  }, [isLoaded]);

  // 설정 자동 저장 (적용된 설정만 저장)
  useEffect(() => {
    if (!isLoaded) return;
    const settings = { selectedAssetIds, mode, exchangeRate, params, relativeMode, benchmarkAssetId };
    localStorage.setItem('backtest_settings', JSON.stringify(settings));
  }, [selectedAssetIds, mode, exchangeRate, params, relativeMode, benchmarkAssetId, isLoaded]);

  // 투자 모드 변경 시 드래프트 파라미터 자동 조정
  useEffect(() => {
    if (draftMode === 'lump-sum') {
      setDraftParams(p => ({ ...p, monthlyInstallment: 0 }));
    } else if (draftMode === 'dca') {
      setDraftParams(p => ({ ...p, initialPrincipal: 0 }));
    }
  }, [draftMode]);

  const handleApply = () => {
    setParams(draftParams);
    setSelectedAssetIds(draftSelectedAssetIds);
    setMode(draftMode);
    setExchangeRate(draftExchangeRate);
    setToastMessage('새로운 설정이 시뮬레이션에 적용되었습니다.');
  };

  const handleCancel = () => {
    setDraftParams(params);
    setDraftSelectedAssetIds(selectedAssetIds);
    setDraftMode(mode);
    setDraftExchangeRate(exchangeRate);
  };

  // 빠른 기간 설정 버튼 처리
  const handleQuickRange = (type: string) => {
    const end = new Date(draftParams.endDate);
    let start = new Date(draftParams.endDate);

    switch (type) {
      case 'YTD': start = new Date(end.getFullYear(), 0, 1); break;
      case '1m': start.setMonth(end.getMonth() - 1); break;
      case '1y': start.setFullYear(end.getFullYear() - 1); break;
      case '3y': start.setFullYear(end.getFullYear() - 3); break;
      case '5y': start.setFullYear(end.getFullYear() - 5); break;
      case '10y': start.setFullYear(end.getFullYear() - 10); break;
      case '15y': start.setFullYear(end.getFullYear() - 15); break;
      case '20y': start.setFullYear(end.getFullYear() - 20); break;
    }

    const startDateStr = start.toISOString().split('T')[0];
    const minDate = dateRange.min + '-01';
    setDraftParams({ ...draftParams, startDate: startDateStr < minDate ? minDate : startDateStr });
  };

  // 자산 카테고리화
  const categorizedAssets = useMemo(() => {
    return {
      '해외 주식/ETF': assets.filter(a => a.currency === 'USD' && (a.type === 'index' || a.type === 'leveraged')),
      '국내 주식/기타': assets.filter(a => a.currency === 'KRW' && a.id !== 'savings' && a.id !== 'gold'),
      '안전 자산/채권': assets.filter(a => a.id === 'savings' || a.id === 'gold' || a.type === 'rate')
    };
  }, [assets]);

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

  // 시뮬레이션 계산 (Applied State 사용)
  const results = useMemo(() => {
    return selectedAssetIds.map(id => {
      const asset = assets.find(a => a.id === id);
      if (!asset) return null;
      
      const adjustedParams = { ...params };
      if (asset.currency === 'USD') {
        adjustedParams.initialPrincipal = params.initialPrincipal / exchangeRate;
        adjustedParams.monthlyInstallment = params.monthlyInstallment / exchangeRate;
      }

      try {
        return {
          asset,
          result: BacktestEngine.run(asset, adjustedParams)
        };
      } catch (e) {
        return null;
      }
    }).filter(r => r !== null) as { asset: AssetData; result: SimulationResult }[];
  }, [assets, selectedAssetIds, params, exchangeRate]);

  // 벤치마크 자산 유효성 검사 및 자동 조정
  useEffect(() => {
    if (selectedAssetIds.length > 0 && !selectedAssetIds.includes(benchmarkAssetId)) {
      setBenchmarkAssetId(selectedAssetIds[0]);
    }
  }, [selectedAssetIds, benchmarkAssetId]);

  const selectedAssets = useMemo(() => 
    assets.filter(a => selectedAssetIds.includes(a.id)),
    [assets, selectedAssetIds]
  );

  const draftSelectedAssets = useMemo(() => 
    assets.filter(a => draftSelectedAssetIds.includes(a.id)),
    [assets, draftSelectedAssetIds]
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-canvas text-ink">
        <div className="flex flex-col items-center gap-md">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-body-sm font-bold animate-pulse">데이터를 분석 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-lg p-md lg:p-lg min-h-screen bg-canvas text-ink font-body">
      {/* 사이드바: 설정 영역 */}
      <aside className="w-full lg:w-80 flex flex-col gap-lg">
        <section className="panel backdrop-blur-md">
          <div className="flex justify-between items-center mb-md">
            <h2 className="text-title-md font-bold flex items-center gap-sm">
              <span className="w-1.5 h-6 bg-primary rounded-pill"></span>
              시뮬레이션 설정
            </h2>
            <button 
              onClick={() => setShowGuide(true)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-line/40 hover:bg-line text-muted transition-colors"
              title="계산식 설명"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-md">
            {/* 투자 모드 선택 */}
            <div>
              <label className="text-caption font-bold text-muted block mb-sm">투자 모드</label>
              <div className="flex bg-line/20 p-1 rounded-sm gap-1">
                {(['lump-sum', 'dca', 'mixed'] as InvestMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setDraftMode(m)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-sm transition-all ${draftMode === m ? 'bg-white shadow-sm text-primary' : 'text-muted hover:text-ink'}`}
                  >
                    {m === 'lump-sum' ? '거치식' : m === 'dca' ? '적립식' : '혼합'}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-muted leading-tight bg-line/10 p-2 rounded flex gap-2 items-start">
                <span className="text-primary mt-0.5">ℹ️</span>
                <span>
                  {draftMode === 'lump-sum' && '초기 자본을 한 번에 투자하고 추가 납입 없이 성과를 추적합니다. (CAGR 중심)'}
                  {draftMode === 'dca' && '초기 자본 없이 매월 일정 금액을 꾸준히 적립 투자합니다. (IRR 중심)'}
                  {draftMode === 'mixed' && '초기 자본 투자 후 매월 일정 금액을 추가로 적립하여 운용합니다.'}
                </span>
              </div>
            </div>

            <hr className="border-line" />

            <div>
              <div className="flex justify-between items-center mb-sm">
                <label className="text-caption font-bold text-muted">비교 자산 선택</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setDraftSelectedAssetIds(assets.map(a => a.id))}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    전체 선택
                  </button>
                  <button 
                    onClick={() => setDraftSelectedAssetIds([])}
                    className="text-[10px] font-bold text-muted hover:underline"
                  >
                    전체 해제
                  </button>
                </div>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-sm custom-scrollbar bg-line/10 p-sm rounded-sm">
                {Object.entries(categorizedAssets).map(([category, items]) => (
                  <div key={category}>
                    <div className="text-[10px] font-bold text-muted/60 mb-1 px-1 uppercase tracking-wider">{category}</div>
                    <div className="grid grid-cols-1 gap-0.5">
                      {items.map(asset => (
                        <label key={asset.id} className={`flex items-center gap-sm p-sm hover:bg-line rounded-sm cursor-pointer transition-colors ${draftSelectedAssetIds.includes(asset.id) ? 'bg-line/50' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={draftSelectedAssetIds.includes(asset.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDraftSelectedAssetIds([...draftSelectedAssetIds, asset.id]);
                              } else {
                                setDraftSelectedAssetIds(draftSelectedAssetIds.filter(id => id !== asset.id));
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
                ))}
              </div>
            </div>

            <hr className="border-line" />

            <div className="space-y-md">
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase mb-1">시작 월</label>
                  <input 
                    type="month"
                    value={draftParams.startDate.slice(0, 7)}
                    min={dateRange.min}
                    max={draftParams.endDate.slice(0, 7)}
                    onChange={(e) => setDraftParams({ ...draftParams, startDate: `${e.target.value}-01` })}
                    className="w-full font-bold text-xs p-sm bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase mb-1">종료 월</label>
                  <input 
                    type="month"
                    value={draftParams.endDate.slice(0, 7)}
                    min={draftParams.startDate.slice(0, 7)}
                    max={dateRange.max}
                    onChange={(e) => setDraftParams({ ...draftParams, endDate: `${e.target.value}-01` })}
                    className="w-full font-bold text-xs p-sm bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {['YTD', '1m', '1y', '3y', '5y', '10y', '15y', '20y'].map(range => (
                  <button
                    key={range}
                    onClick={() => handleQuickRange(range)}
                    className="px-2 py-1 bg-line/30 hover:bg-line text-[10px] font-bold rounded-pill text-muted transition-colors"
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-line" />

            <div className="grid grid-cols-2 gap-md">
              <div className={draftMode === 'dca' ? 'opacity-30 pointer-events-none' : ''}>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">초기 투자금</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={draftParams.initialPrincipal / 10000}
                    onChange={(e) => setDraftParams({ ...draftParams, initialPrincipal: Number(e.target.value) * 10000 })}
                    className="w-full font-black text-lg p-sm pr-8 bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">만원</span>
                </div>
              </div>
              <div className={draftMode === 'lump-sum' ? 'opacity-30 pointer-events-none' : ''}>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">월 적립액</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={draftParams.monthlyInstallment / 10000}
                    onChange={(e) => setDraftParams({ ...draftParams, monthlyInstallment: Number(e.target.value) * 10000 })}
                    className="w-full font-black text-lg p-sm pr-8 bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">만원</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div className="flex items-center justify-between p-sm bg-line/30 rounded-md col-span-2">
                <span className="text-caption font-bold text-muted">배당 재투자 (TR)</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={draftParams.reinvestDividends}
                    onChange={(e) => {
                      setDraftParams({ ...draftParams, reinvestDividends: e.target.checked });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-line-strong peer-focus:outline-none rounded-pill peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">적용 환율 (USD/KRW)</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={draftExchangeRate}
                    onChange={(e) => setDraftExchangeRate(Number(e.target.value))}
                    className="w-full font-black text-sm p-sm pr-8 bg-line/20 rounded-sm border-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted">원</span>
                </div>
              </div>
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

            {/* 경고 알림은 Draft 상태를 기준으로 실시간 피드백 제공 */}
            <SimulationWarning params={draftParams} selectedAssets={draftSelectedAssets} />
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
              exchangeRate={exchangeRate}
            />
          </div>
        </section>

        <KpiGrid 
          results={results} 
          isLumpSum={mode === 'lump-sum'} 
          exchangeRate={exchangeRate}
        />
      </main>

      {/* 변경 사항 감지 플로팅 바 */}
      <PendingChangesBar 
        isVisible={isDirty} 
        onApply={handleApply} 
        onCancel={handleCancel} 
      />

      {toastMessage && (
        <Toast 
          message={toastMessage} 
          onClose={() => setToastMessage(null)} 
        />
      )}

      <CalculationGuideModal 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
      />
    </div>
  );
};
