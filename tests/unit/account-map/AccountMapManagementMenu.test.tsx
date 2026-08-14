import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapManagementMenu } from '../../../src/account-map/ui/AccountMapManagementMenu';

afterEach(cleanup);

describe('AccountMapManagementMenu', () => {
  it('confirms a map-only reset and reports compatibility data', async () => {
    const onReset = vi.fn(async () => true);
    render(<AccountMapManagementMenu hasMap hasLegacy onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByText('이전 형식 데이터가 호환용으로 보존되어 있습니다')).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: '월 연결 다시 만들기' }));
    expect(screen.getByRole('dialog', { name: '월 연결을 다시 만들까요?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다시 만들기' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('does not offer reset before a map or draft exists', () => {
    render(<AccountMapManagementMenu hasMap={false} hasLegacy={false} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.queryByRole('menuitem', { name: '월 연결 다시 만들기' })).not.toBeInTheDocument();
  });

  it('lists archived custom purposes with count, parent, and target', () => {
    const onRestorePurpose = vi.fn();
    render(<AccountMapManagementMenu
      hasMap
      archivedPurposes={[
        { id: 'custom:telecom', name: '통신비', parentName: '생활비', targetMonthlyWon: 200_000 },
        { id: 'custom:rent', name: '월세', parentName: '주거', targetMonthlyWon: 500_000 },
      ]}
      onRestorePurpose={onRestorePurpose}
    />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByText('보관된 목적 2개')).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: /통신비 · 생활비 · 200,000원/ }));
    expect(onRestorePurpose).toHaveBeenCalledWith('custom:telecom');
  });

  it('locks archived-purpose restore while recovery is active', () => {
    render(<AccountMapManagementMenu
      hasMap
      mutationsDisabled
      archivedPurposes={[{ id: 'custom:telecom', name: '통신비', parentName: '생활비', targetMonthlyWon: 200_000 }]}
    />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('menuitem', { name: /통신비/ })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: '월 연결 다시 만들기' })).toBeDisabled();
  });
});
