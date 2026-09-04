import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { MainPlanEditor } from '../../../src/main/ui/dashboard/MainPlanEditor';

afterEach(cleanup);

const plan: MainData = {
  schemaVersion: 2,
  updatedAt: 1,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('MainPlanEditor', () => {
  it('keeps the canonical Main fields, adjustments, validation message, and requested initial focus together', () => {
    render(
      <MainPlanEditor
        draft={plan}
        issues={[{ path: 'monthlyLivingWon', code: 'amount_negative' }]}
        saving={false}
        initialFocusPath="monthlyLivingWon"
        onChange={vi.fn()}
        onRequestClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('월 실수령액')).toHaveValue('3,200,000');
    expect(screen.getByLabelText('월 주거 고정비')).toHaveValue('800,000');
    expect(screen.getByLabelText('월평균 생활비')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('금액은 0원 이상으로 입력해주세요.');
    expect(screen.getAllByRole('button', { name: '+10만' })).toHaveLength(5);
    expect(screen.getByLabelText('월평균 생활비')).toHaveFocus();

    fireEvent.click(screen.getAllByRole('button', { name: '+10만' })[0]!);
  });
});
