# 지출 도우미 검증 범위

2026-09-10. 전체 UI 판단과 시안 비교는 [Design QA](../../../design-qa.md)에 기록한다. 이 파일은 저장과 운영 인계 증거의 진입점이다.

- Main owned expenseAssistant는 질문 ID별 원금액·기간·단계·마지막 완료 답변을 기억한다.
- 전용 draft RPC는 Main 적용값을 유지하고 completion RPC는 서버 합계로 두 지출 금액을 원자적으로 대체한다.
- v4→v5 원본 보존/strict 변환, backup format 1–4, cache v1–v3의 미전송 구 요청 격리, CAS와 같은 mutation 재시도, 최신 수입·저축·투자 보존을 검증했다.
- 운영 DB와 공개 사이트에는 이 migration/코드를 적용하지 않았다. 실제 계정 검증은 [운영 안내](../../supabase-account-setup.md#workspace-v5-지출-도우미-적용-대기)에서 별도로 시작한다.

검증 명령과 최종 결과는 [Design QA의 최신 절](../../../design-qa.md)에 단일 기록한다. 상세 원본 테스트는 [expense UI 흐름](../../../tests/account-workspace.spec.ts), [SQL 검증](../../../scripts/verify-expense-db.mjs), [v5 호환성](../../../tests/unit/workspace/workspaceV5Migration.test.ts), [도메인·저장](../../../tests/unit/main/expenseAssistant.test.ts)을 따른다.
