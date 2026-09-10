export const EXPENSE_ITEMS = [
  { id: 'rent', label: '월세', question: '매달 월세로 얼마를 내나요?', hint: '월세가 없다면 없어요를 선택하세요.', group: 'fixed', target: 'housing' },
  { id: 'housingInterest', label: '주거 대출 이자', question: '주거 대출 이자는 얼마인가요?', hint: '전세·주택 대출의 이자만 입력해요.', group: 'fixed', target: 'housing' },
  { id: 'maintenance', label: '관리비', question: '관리비는 보통 얼마인가요?', hint: '관리비에 포함된 공과금은 뒤에서 다시 입력하지 않아요.', group: 'fixed', target: 'housing' },
  { id: 'insurance', label: '보험료', question: '보험료로 얼마가 나가나요?', hint: '직접 내는 보험료를 모두 합쳐주세요.', group: 'fixed', target: 'living' },
  { id: 'telecom', label: '통신비', question: '휴대폰·인터넷 요금은 얼마인가요?', hint: '휴대폰, 인터넷, TV 요금을 합쳐주세요.', group: 'fixed', target: 'living' },
  { id: 'subscriptions', label: '정기 구독', question: '정기 구독에 얼마를 쓰나요?', hint: '영상·음악 서비스, 멤버십 등 정기 결제를 떠올려보세요.', group: 'fixed', target: 'living' },
  { id: 'utilities', label: '공과금', question: '따로 내는 공과금은 얼마인가요?', hint: '관리비에 포함되지 않은 전기·가스·수도 요금의 평균이에요.', group: 'variable', target: 'housing' },
  { id: 'food', label: '식비', question: '식비는 한 달에 어느 정도인가요?', hint: '장보기, 외식, 배달, 카페 비용을 함께 생각해보세요.', group: 'variable', target: 'living' },
  { id: 'transport', label: '교통비', question: '이동하는 데 얼마가 드나요?', hint: '대중교통, 택시, 주유, 주차 비용 등을 합쳐주세요.', group: 'variable', target: 'living' },
  { id: 'occasions', label: '경조사비', question: '경조사비는 어느 정도인가요?', hint: '매달 다르다면 1년 동안의 총액으로 답해도 좋아요.', group: 'variable', target: 'living' },
  { id: 'leisure', label: '여가비', question: '여가·여행에 얼마를 쓰나요?', hint: '취미, 문화생활, 여행 비용의 평균을 생각해보세요.', group: 'variable', target: 'living' },
  { id: 'otherHousing', label: '그 밖의 주거비', question: '빠뜨린 주거비가 있나요?', hint: '앞에서 답한 항목과 겹치지 않는 주거비만 더해주세요.', group: 'variable', target: 'housing' },
  { id: 'otherLiving', label: '그 밖의 생활비', question: '그 밖의 생활비도 챙겨볼까요?', hint: '의료비, 의류, 교육, 미용 등 빠뜨린 비용을 합쳐주세요.', group: 'variable', target: 'living' },
] as const;

export type ExpenseItemId = typeof EXPENSE_ITEMS[number]['id'];
export type ExpenseAnswer = { amountWon: number; period: 'month' | 'year' };
export type ExpenseAnswers = Record<ExpenseItemId, ExpenseAnswer | null>;
export interface ExpenseAssistantDraft {
  answers: ExpenseAnswers;
  step: ExpenseItemId | 'review';
  updatedAt: number;
}
export interface ExpenseAssistant {
  schemaVersion: 1;
  draft: ExpenseAssistantDraft;
  lastApplied: { answers: ExpenseAnswers; appliedAt: number } | null;
}

export function createExpenseDraft(now = Date.now()): ExpenseAssistantDraft {
  return { answers: Object.fromEntries(EXPENSE_ITEMS.map(({ id }) => [id, null])) as ExpenseAnswers, step: 'rent', updatedAt: now };
}

export function expenseTotals(answers: ExpenseAnswers): { housingWon: number; livingWon: number; totalWon: number } | null {
  const annual = { housing: 0n, living: 0n };
  for (const item of EXPENSE_ITEMS) {
    const answer = answers[item.id];
    if (answer) annual[item.target] += BigInt(answer.amountWon) * (answer.period === 'month' ? 12n : 1n);
  }
  const housing = (annual.housing + 6n) / 12n;
  const living = (annual.living + 6n) / 12n;
  if (housing + living > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { housingWon: Number(housing), livingWon: Number(living), totalWon: Number(housing + living) };
}

export function expenseAnswersComplete(answers: ExpenseAnswers): boolean {
  return EXPENSE_ITEMS.every(({ id }) => answers[id] !== null);
}

export function parseExpenseAnswers(value: unknown): ExpenseAnswers | null {
  if (!exactKeys(value, EXPENSE_ITEMS.map(({ id }) => id))) return null;
  for (const answer of Object.values(value)) {
    if (answer !== null && (!exactKeys(answer, ['amountWon', 'period'])
      || !integer(answer.amountWon) || (answer.period !== 'month' && answer.period !== 'year'))) return null;
  }
  const answers = value as ExpenseAnswers;
  return expenseTotals(answers) === null ? null : structuredClone(answers);
}

export function parseExpenseDraft(value: unknown): ExpenseAssistantDraft | null {
  if (!exactKeys(value, ['answers', 'step', 'updatedAt']) || !timestamp(value.updatedAt)
    || (value.step !== 'review' && !EXPENSE_ITEMS.some(item => item.id === value.step))) return null;
  const answers = parseExpenseAnswers(value.answers);
  return answers === null ? null : { answers, step: value.step as ExpenseAssistantDraft['step'], updatedAt: value.updatedAt };
}

export function parseExpenseAssistant(value: unknown): ExpenseAssistant | null {
  if (!exactKeys(value, ['schemaVersion', 'draft', 'lastApplied']) || value.schemaVersion !== 1) return null;
  const draft = parseExpenseDraft(value.draft);
  if (draft === null) return null;
  if (value.lastApplied === null) return { schemaVersion: 1, draft, lastApplied: null };
  if (!exactKeys(value.lastApplied, ['answers', 'appliedAt']) || !timestamp(value.lastApplied.appliedAt)) return null;
  const answers = parseExpenseAnswers(value.lastApplied.answers);
  if (answers === null || !expenseAnswersComplete(answers)) return null;
  return { schemaVersion: 1, draft, lastApplied: { answers, appliedAt: value.lastApplied.appliedAt } };
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key));
}
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function timestamp(value: unknown): value is number { return integer(value) && value <= 8_640_000_000_000_000; }
