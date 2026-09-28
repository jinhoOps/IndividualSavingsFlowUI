# 공유 이미지 KPI와 Portfolio 자산군 비중 검증

날짜: 2026-09-28

## 변경

- 공유 이미지의 작은 미래 그래프를 예상 자산, 납입원금, 예상 수익, 전부 저축 시 금액, 전부 저축 대비 차이로 교체했다. 원화 금액은 기존 Simulation formatter를 사용한다.
- 실질 모드에서는 원금도 같은 물가 기준으로 맞춘다. 금액 제외 시 원금 대비 배수, 누적 수익률, 전부 저축 대비 배수, 연 기대수익률, 저축 기준금리만 출력 모델에 남긴다.
- Portfolio 결과·초안 요약·최초 설정 검토·적용 확인·공유 이미지에서 같은 자산군 집계를 쓴다. 주식, 현물(BTC·금), 채권, 현금 및 기타를 표시한다.
- 기존 성장/안정 태그나 Main·Simulation·Portfolio 원본 저장 계약을 변경하지 않는다. 미배분 초안을 100%로 정규화하지 않는다.

## 검증

- `npm run check:ci`: 종료 코드 0, harness와 두 TypeScript 검사 통과.
- 최종 `npm run check`: 통과.
- `npm run test:unit -- --maxWorkers=2 --reporter=json --outputFile=/tmp/isf-asset-vitest-final.json`: 1,177개 통과, 실패 0.
- Playwright 집중 검증: 결과 화면 390·768·1280px, 저장/공유 320·390·768·1280px, 실제 PNG 렌더. 최대 10개 대상+현금에서 SVG text bounding box를 비교하며 모든 글자의 겹침·잘림과 PNG 1MB 상한을 검사한다. 최초 56px 행간에서 발견한 원화/다음 행 비율 겹침은 60px 행간으로 수정하고 같은 두 테스트를 통과했다.
- 모바일 고정 요약의 늘어난 높이로 발견한 추가 버튼 잘림 2건은 편집 요약을 compact inline 비중으로 바꾸고 중복 여백을 제거해 수정했다. `ISF_E2E_PORT=6520 npx playwright test tests/portfolio.spec.ts --grep 'final mobile editor|nested editor focus|scrolls ten editor|summary-first ratio list' --retries=1`: 9개 모두 첫 실행 통과.
- 최종 이미지 렌더 2개 통과. 금액 포함 PNG 212,922 bytes, 금액 제외 PNG 162,481 bytes. 모두 1MB 이하.
- 변경 Markdown 상대 링크와 `git diff --check`: 통과.

전체 E2E 실행 결과와 재시도 내역은 이 변경의 PR 본문에 기록한다. 최초 실행 중 발견한 변경 범위의 모바일 배치 실패는 위 9개 재검증에서 해결을 확인했다.

## 화면

합성 fixture를 사용한 Chromium 화면과 실제 PNG 출력이다.

- [모바일 자산 구성](2026-09-28-share-kpis-and-asset-classes/asset-classes-390.png)
- [태블릿 자산 구성](2026-09-28-share-kpis-and-asset-classes/asset-classes-768.png)
- [데스크톱 자산 구성](2026-09-28-share-kpis-and-asset-classes/asset-classes-1280.png)

- [모바일 편집 요약](2026-09-28-share-kpis-and-asset-classes/editor-390.png)
- [금액 포함 PNG](2026-09-28-share-kpis-and-asset-classes/card-amounts.png)
- [금액 제외 PNG](2026-09-28-share-kpis-and-asset-classes/card-ratios.png)

## 제한

- 자산군은 샘플·빠른 이름·명시적인 자산 이름에서 계산하는 표시용 분류다. 임의 티커를 조회하는 상품 DB가 없으므로 식별되지 않은 이름, 복수 자산이 섞인 이름, 선물·인버스 등은 기타로 남긴다. 사용자가 지정한 성장/안정 태그를 자산군으로 추정하지 않는다.
- 실제 iOS 기기와 스크린리더는 검증하지 않았다. 운영 Supabase에 테스트 이미지를 올리지 않았으며 기존 파일당 1MB, 48시간 기본 보관, 예약 예산과 정기 삭제 설정은 변경하지 않았다.
