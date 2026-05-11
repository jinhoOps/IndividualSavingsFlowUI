import { describe, it, expect } from 'vitest';
import { BacktestEngine } from './engine';
import { AssetData } from './types';

describe('BacktestEngine', () => {
  const sampleAsset: AssetData = {
    id: 'test',
    name: 'Test Asset',
    type: 'index',
    currency: 'KRW',
    data: [
      { date: '2023-01-01', price: 100, dividendYield: 0.01 }, // 1월 시작
      { date: '2023-02-01', price: 110, dividendYield: 0.01 }, // 10% 상승
      { date: '2023-03-01', price: 99, dividendYield: 0.01 },  // 전고점(110) 대비 10% 하락
      { date: '2023-04-01', price: 121, dividendYield: 0.01 }, // 저점(99) 대비 22.2% 상승
    ]
  };

  describe('LumpSum Simulation (거치식)', () => {
    it('배당 재투자 없이 정확한 수익률을 계산해야 한다', () => {
      const result = BacktestEngine.run(sampleAsset, {
        initialPrincipal: 1000000, // 100만원
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-04-01',
        reinvestDividends: false
      });

      // 최종가 121, 시작가 100 -> 수익률 21%
      expect(result.totalReturn).toBeCloseTo(0.21, 2);
      expect(result.finalValue).toBe(1210000);
      expect(result.totalPrincipal).toBe(1000000);
    });

    it('MDD(최대 낙폭)를 올바르게 계산해야 한다', () => {
      const result = BacktestEngine.run(sampleAsset, {
        initialPrincipal: 1000000,
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-04-01',
        reinvestDividends: false
      });

      // 최고점 110에서 99로 하락 -> (110-99)/110 = 0.1 (10%)
      expect(result.mdd).toBeCloseTo(0.1, 2);
    });

    it('배당 재투자(TR) 반영 시 수익률이 증가해야 한다', () => {
      const result = BacktestEngine.run(sampleAsset, {
        initialPrincipal: 1000000,
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-04-01',
        reinvestDividends: true
      });

      // 1월: 100만원 시작
      // 2월: 110만원 가치 + 1월 배당(1%) 1만원 재투자 -> 111만원
      // 3월: 111만원 * (99/110) + 2월 배당(1%) 1.11만원 재투자 -> 99.9 + 1.11 = 101.01
      // ... 복리 효과로 121만원보다 커야 함
      expect(result.finalValue).toBeGreaterThan(1210000);
    });

    it('최종 연 배당금을 올바르게 계산해야 한다', () => {
      const result = BacktestEngine.run(sampleAsset, {
        initialPrincipal: 1000000,
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-04-01',
        reinvestDividends: false
      });

      // 마지막 달(4월) 보유 가치: 121만원
      // 마지막 달 배당률: 0.01 (1%)
      // 연 배당금: 121만원 * 1% * 12 = 145,200원
      expect(result.finalAnnualDividend).toBe(145200);
    });
  });

  describe('Installment Simulation (적립식)', () => {
    it('매월 적립금이 정확히 반영되어야 한다', () => {
      const result = BacktestEngine.run(sampleAsset, {
        initialPrincipal: 0,
        monthlyInstallment: 1000000, // 매월 100만원
        startDate: '2023-01-01',
        endDate: '2023-04-01',
        reinvestDividends: false
      });

      // 1월: 100만원 (평단 100, 수량 10000)
      // 2월: 가치 110만원 + 신규 100만원 (평단 110, 수량 9090.9) -> 총 수량 19090.9
      // 3월: 가치 19090.9 * 99 + 신규 100만원 -> 총 수량 29191.9
      // 4월: 가치 29191.9 * 121 + 신규 100만원 -> 총 수량 37456.3
      // 총 원금 400만원
      expect(result.totalPrincipal).toBe(4000000);
      expect(result.history.length).toBe(4);
    });
  });

  describe('Edge Cases & Robustness', () => {
    it('자산 가치가 원금의 1% 미만일 때 청산되어야 한다', () => {
      const crashAsset: AssetData = {
        ...sampleAsset,
        data: [
          { date: '2023-01-01', price: 100 },
          { date: '2023-02-01', price: 0.5 }, // 99.5% 폭락
        ]
      };

      const result = BacktestEngine.run(crashAsset, {
        initialPrincipal: 1000000,
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-02-01',
        reinvestDividends: false
      });

      expect(result.isLiquidated).toBe(true);
      expect(result.finalValue).toBe(0);
      expect(result.liquidationDate).toBe('2023-02-01');
    });

    it('10년 이상의 장기 시뮬레이션에서 CAGR과 IRR이 합리적이어야 한다', () => {
      const longData = [];
      for (let i = 0; i < 120; i++) {
        const year = 2010 + Math.floor(i / 12);
        const month = (i % 12) + 1;
        longData.push({
          date: `${year}-${month.toString().padStart(2, '0')}-01`,
          price: 100 * Math.pow(1.008, i) // 월 0.8%씩 꾸준히 상승 (연 약 10%)
        });
      }
      
      const longAsset: AssetData = { ...sampleAsset, data: longData };
      const result = BacktestEngine.run(longAsset, {
        initialPrincipal: 1000000,
        monthlyInstallment: 0,
        startDate: '2010-01-01',
        endDate: '2019-12-01',
        reinvestDividends: false
      });

      // 연 10% 정도의 CAGR 기대
      expect(result.cagr).toBeGreaterThan(0.09);
      expect(result.cagr).toBeLessThan(0.11);
      // 거치식의 경우 CAGR과 IRR이 거의 일치해야 함
      expect(result.irr).toBeCloseTo(result.cagr, 2);
    });

    it('시뮬레이션 기간 내 데이터가 1개뿐이면 에러를 던져야 한다 (또는 적절히 처리)', () => {
      const singlePointAsset: AssetData = {
        ...sampleAsset,
        data: [{ date: '2023-01-01', price: 100 }]
      };

      // 현재 구현상 run()은 filteredData.length === 0일 때만 던지지만, 
      // 1개일 때의 수익률은 0이어야 함. 
      const result = BacktestEngine.run(singlePointAsset, {
        initialPrincipal: 1000000,
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-01-01',
        reinvestDividends: false
      });

      expect(result.totalReturn).toBe(0);
      expect(result.history.length).toBe(1);
    });

    it('투자금이 모두 0이면 결과도 0이어야 한다', () => {
      const result = BacktestEngine.run(sampleAsset, {
        initialPrincipal: 0,
        monthlyInstallment: 0,
        startDate: '2023-01-01',
        endDate: '2023-04-01',
        reinvestDividends: false
      });

      expect(result.finalValue).toBe(0);
      expect(result.totalPrincipal).toBe(0);
      expect(result.totalReturn).toBe(0);
      expect(result.irr).toBe(0);
    });
  });
});
