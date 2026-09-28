# 커뮤니티 대화·알림·밀도 검증

상태: 2026-09-28 로컬 구현 완료, 전체 E2E·운영 rollout 진행 중. 브랜치 `jinhoOps/community-expansion`.

## 구현과 확인

- 원댓글 20개/한 단계 답글 10개, 직접 댓글 context, 페이지 밖 답글 대상의 공개 ID·현재 닉네임.
- 선택한 사용자 최대 3명, codepoint 범위·IME·편집/붙여넣기, 닉네임 변경/재사용과 사용자 탈퇴 처리.
- 수신자 전용 알림, reply+mention 중복 제거, 본인 제외, 재시도 동일 UUID, 조회 시점 ID+cutoff로 모두 읽음.
- 30일/사용자 100개/전체 20,000개 알림 상한, 400MiB 신규 저장 guard. 금융 schema v5/protocol 5·Storage 이미지 정책 보존.
- v1 댓글/프로필/게시물 응답 유지. 타인 게시물 행 잠금의 UPDATE RLS 문제를 제거하고 동일 advisory lock·FK로 대화 쓰기/삭제를 직렬화했다.

## 검증

- `npm run check:ci`: 146개 파일, 1,316 unit 통과.
- `node scripts/test-workspace-db.mjs`: 전체 계약 통과. 원본 workspace digest, v1 호환·RLS·타인 접근·동시 답글/삭제·알림/재시도·닉네임/탈퇴·실제 용량 한도 fixture 포함.
- rich 댓글 20,000+알림 20,000의 테이블/인덱스 61,251,584B. 댓글 20,000+공감 100,000은 76,857,344B. 각 독립 fixture 측정이며 합산 DB 크기로 오인하지 않는다.
- `npx playwright test tests/account-workspace.spec.ts --project=cloud --grep 'Lounge compact conversation|Lounge conversation compact|Lounge notifications open exact'`: 7/7.
- 390×844에서 두 줄 댓글 5개, 768/1280 중앙 모달 확인. 44px 조작 영역과 16px 입력, 본문/입력 분리, 답글 초안 유지·dirty guard·성공 후 해제·알림 왕복 focus 확인.
- 390×520 및 1280×900의 200% zoom 상당 640×450에서 멘션 후보와 등록 버튼 containment 확인. 기존 inline 후보가 footer를 밀어 잘리는 실패를 재현하고 입력 위 제한 높이 후보 목록/짧은 화면 2줄 입력으로 수정, 같은 테스트 통과. drag 닫기·후보 키보드 선택·focus 복귀 확인.
- 실제 iOS/Android 키보드, 실제 스크린리더, 물리 기기 200% browser zoom은 미검증이다. viewport emulation과 접근성 이름/키보드 검증을 실기기 증거로 주장하지 않는다.
- 전체 E2E·production build 결과는 아래 운영 완료와 함께 추가한다.

## 운영

미적용. migration 007 및 매일 알림 정리 job은 원본 비교·권한 확인 후 적용한다. 운영에 테스트 댓글·공감을 생성하지 않는다.
