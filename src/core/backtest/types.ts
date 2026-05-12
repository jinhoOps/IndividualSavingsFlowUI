/**
 * 백테스트 시스템의 기초 타입 정의
 */

/** 자산 유형 */
export type AssetType = 'index' | 'commodity' | 'rate' | 'leveraged' | 'custom';

/** 월별 시계열 데이터 포인트 */
export interface TimeSeriesPoint {
  /** YYYY-MM-DD 형식의 날짜 */
  date: string;
  /** 자산 가격 (원 또는 인덱스 포인트) */
  price: number;
  /** 배당률 (월간, 예: 0.0012) - 배당 재투자(TR) 계산용 */
  dividendYield?: number;
}

/** 자산 메타데이터 및 시계열 데이터 */
export interface AssetData {
  id: string;
  name: string;
  type: AssetType;
  currency: 'KRW' | 'USD';
  data: TimeSeriesPoint[];
  /** 데이터 해상도 (일간 또는 월간) */
  resolution?: 'daily' | 'monthly';
  /** 레버리지 배수 (기본 1.0) */
  leverage?: number;
  /** 기초 자산 ID (레버리지 자산인 경우) */
  baseAssetId?: string;
}

/** 시뮬레이션 설정 파라미터 */
export interface SimulationParams {
  /** 시작 금액 (원) */
  initialPrincipal: number;
  /** 월 적립 금액 (원) */
  monthlyInstallment: number;
  /** 시작 날짜 (YYYY-MM-DD) */
  startDate: string;
  /** 종료 날짜 (YYYY-MM-DD) */
  endDate: string;
  /** 배당 재투자 여부 */
  reinvestDividends: boolean;
}

/** 시뮬레이션 결과 데이터 */
export interface SimulationResult {
  /** 최종 평가 금액 (원) */
  finalValue: number;
  /** 총 투자 원금 (원) */
  totalPrincipal: number;
  /** 누적 수익률 (0.0 ~ ) */
  totalReturn: number;
  /** 연평균 성장률 (CAGR, 거치식용) */
  cagr: number;
  /** 내부 수익률 (IRR, 적립식용) */
  irr: number;
  /** 최대 낙폭 (MDD, 0.0 ~ 1.0) */
  mdd: number;
  /** 청산 여부 (자산 가치가 0에 수렴) */
  isLiquidated?: boolean;
  /** 청산 날짜 */
  liquidationDate?: string;
  /** 최종 예상 연 배당금 (원) */
  finalAnnualDividend: number;
  /** 시계열 결과 (그래프용) */
  history: {
    date: string;
    value: number;
    principal: number;
    isLiquidated?: boolean;
  }[];
}
