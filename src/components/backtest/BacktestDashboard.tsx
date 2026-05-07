import React, { useState, useEffect, useMemo } from 'react';
import { AssetData, SimulationParams, SimulationResult } from '../../core/backtest/types';
import { BacktestEngine } from '../../core/backtest/engine';
import { AssetChart } from './AssetChart';
import { KpiGrid } from './KpiGrid';
import { SimulationWarning } from './SimulationWarning';
import { Toast } from '../common/Toast';

export const BacktestDashboard: React.FC = () => {
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(['qqq', 'spy']);
  const [params, setParams] = useState<SimulationParams>({
    initialPrincipal: 10000000,
    monthlyInstallment: 1000000,
    startDate: '2020-01-01',
    endDate: '2020-12-01',
    reinvestDividends: true,
  });
  const [relativeMode, setRelativeMode] = useState(false);
  const [benchmarkAssetId, setBenchmarkAssetId] = useState<string>('qqq');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL;
        const paths = [
          `${baseUrl}data/indices/qqq.json`,
          `${baseUrl}data/indices/spy.json`,
          `${baseUrl}data/indices/gold.json`
        ];
        const loaded = await Promise.all(paths.map(path => fetch(path).then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })));
        
        // 기준금리 가상 데이터 추가
        const rateAsset: AssetData = {
          id: 'base-rate',
          name: '기준금리 (가상 3.5%)',
          type: 'rate',
          currency: 'KRW',
          data: loaded[0].data.map((p: any) => ({
            date: p.date,
            price: 100, // 기준 가격 (변하지 않음)
            dividendYield: 0.035 / 12 // 월간 수익률로 배당 처리
          }))
        };
        
        setAssets([...loaded, rateAsset]);
      } catch (error) {
        console.error('Failed to load asset data:', error);
        setToastMessage('데이터를 불러오는데 실패했습니다.');
      }
    };
    loadAssets();
  }, []);

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
              <label className="block text-caption font-bold text-muted mb-sm">비교 자산 선택</label>
              <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-sm custom-scrollbar">
                {assets.map(asset => (
                  <label key={asset.id} className="flex items-center gap-sm p-sm hover:bg-line rounded-sm cursor-pointer transition-colors">
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
                    <span className="text-body-md font-medium">{asset.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <hr className="border-line" />

            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">초기금 (만원)</label>
                <input 
                  type="number"
                  value={params.initialPrincipal / 10000}
                  onChange={(e) => setParams({ ...params, initialPrincipal: Number(e.target.value) * 10000 })}
                  className="w-full font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase mb-1">월 적립 (만원)</label>
                <input 
                  type="number"
                  value={params.monthlyInstallment / 10000}
                  onChange={(e) => setParams({ ...params, monthlyInstallment: Number(e.target.value) * 10000 })}
                  className="w-full font-bold"
                />
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
