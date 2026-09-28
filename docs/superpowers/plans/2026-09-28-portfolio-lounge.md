# Portfolio Lounge 구현 계획

설계: [승인 범위](../specs/2026-09-28-portfolio-lounge-design.md)

1. [x] 별도 공유 모델·엄격한 parser·Portfolio 초안 변환과 계약 테스트.
2. [x] 신규 테이블·RLS·조회/게시/삭제 RPC, 로컬 DB의 두 계정·anon·충돌·용량 검증.
3. [x] 새 앱 경로·인증·런처, 카드·상세·게시/삭제 UI와 공통 모달.
4. [x] Portfolio 진입·가져오기 미리보기, 명시적 초안 교체, 기존 저장 경계 보존.
5. [x] PRD·DESIGN·README 반영, 390/768/1280 직접 화면 검토, 타입·focused unit·전체 E2E.
6. [x] 운영 migration·검증, PR·CI·배포, 브랜치/Orca 정리, 증거 인계.

[검증·운영 기록](../evidence/2026-09-28-portfolio-lounge.md): 타입·단위 1,206개·전체 E2E 271개·DB·빌드 통과, 운영 migration 적용 완료. PR #25 병합 후 main CI·Pages 배포와 실제 배포 화면의 로그인 요구를 확인했다. 작업 브랜치를 로컬/원격에서 정리하고 Orca를 완료 처리했다.
