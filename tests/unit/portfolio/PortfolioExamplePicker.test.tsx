import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioAction } from '../../../src/portfolio/application/portfolioReducer';
import { createCashOnlyDraft, setItemAmount } from '../../../src/portfolio/domain/allocation';
import { sampleForPreset } from '../../../src/portfolio/domain/samplePreset';
import { PortfolioExamplePicker, type PortfolioExampleNavigation } from '../../../src/portfolio/ui/PortfolioExamplePicker';

afterEach(cleanup);

describe('PortfolioExamplePicker', () => {
  it('allows sample browsing and restored ratios without a discard warning', () => {
    const navigationRef = createRef<PortfolioExampleNavigation>();
    render(<PortfolioExamplePicker draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000}
      now={() => 2} onAction={vi.fn()} onClose={vi.fn()} navigationRef={navigationRef} />);
    fireEvent.click(screen.getByRole('button', {name: 'VOO 70 · 금 30'}));
    expect(navigationRef.current?.hasChanges).toBe(false);
    fireEvent.click(screen.getByRole('button', {name: '주력 비율 5% 높이기'}));
    expect(navigationRef.current?.hasChanges).toBe(true);
    fireEvent.click(screen.getByRole('button', {name: '샘플 비율로 되돌리기'}));
    expect(navigationRef.current?.hasChanges).toBe(false);
  });

  it('preselects the 5% sample as SCHD 50 and gold 50 without marking the picker dirty', () => {
    const navigationRef = createRef<PortfolioExampleNavigation>();
    render(<PortfolioExamplePicker draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000}
      now={() => 2} onAction={vi.fn()} onClose={vi.fn()} navigationRef={navigationRef}
      initialSample={sampleForPreset(5)} />);

    expect(screen.getByRole('heading', { name: 'SCHD 50 · 금 50' })).toBeVisible();
    const preview = screen.getByRole('heading', { name: '구성 미리보기' }).closest('section')!;
    expect(preview).toHaveTextContent('SCHD50%');
    expect(preview).toHaveTextContent('금(GOLD)50%');
    expect(navigationRef.current?.hasChanges).toBe(false);
  });

  it('commits the adjusted preview rather than the original sample ratios', () => {
    const onAction = vi.fn();
    render(<PortfolioExamplePicker draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000}
      now={() => 2} onAction={onAction} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'VOO 70 · 금 30' }));
    fireEvent.click(screen.getByRole('button', { name: '주력 비율 5% 높이기' }));
    fireEvent.click(screen.getByRole('button', { name: '이 구성으로 초안 채우기' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'draft-replaced', draft: expect.objectContaining({ items: expect.arrayContaining([
        expect.objectContaining({ id: 'VOO', shareUnits: 750_000 }),
        expect.objectContaining({ id: 'GOLD', shareUnits: 250_000 }),
      ]) }),
    }));
  });

  it('preserves selected adjustments when returning to the sample list', () => {
    render(<PortfolioExamplePicker draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000}
      now={() => 2} onAction={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'VOO 70 · 금 30' }));
    fireEvent.click(screen.getByRole('button', { name: '주력 비율 5% 높이기' }));
    fireEvent.click(screen.getByRole('button', { name: '샘플 목록' }));
    expect(screen.queryByRole('button', { name: '이 구성으로 초안 채우기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'VOO 70 · 금 30' }));
    expect(screen.getByRole('slider', { name: '주력 자산 비율' })).toHaveValue('75');
  });
  it('requires explicit confirmation before replacing a non-empty draft', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    const onClose = vi.fn();
    const draft = setItemAmount(createCashOnlyDraft(200_000, 1), {
      id: 'index', name: '기존 인덱스', order: 0,
    }, 200_000);
    render(<PortfolioExamplePicker draft={draft} investmentWon={200_000} now={() => 2}
      onAction={onAction} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'VOO 70 · 금 30' }));
    fireEvent.click(screen.getByRole('button', { name: '이 구성으로 초안 채우기' }));
    expect(screen.getByRole('heading', { name: '현재 초안을 이 구성으로 바꿀까요?' })).toBeVisible();
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '초안 바꾸기' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'draft-replaced',
      draft: expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'VOO', classification: 'growth' }),
          expect.objectContaining({ id: 'GOLD', classification: 'stable' }),
        ]),
      }),
    }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('builds a direct main-and-assist composition from the same valid draft path', () => {
    const onAction = vi.fn<(action: PortfolioAction) => void>();
    render(<PortfolioExamplePicker draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000}
      now={() => 2} onAction={onAction} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '직접 조합' }));
    fireEvent.change(screen.getByLabelText('주 투자 대상'), { target: { value: 'VOO' } });
    fireEvent.change(screen.getByLabelText('보조 투자 대상 1'), { target: { value: 'GOLD' } });
    fireEvent.click(screen.getByRole('button', { name: '이 구성으로 초안 채우기' }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'draft-replaced',
      draft: expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'VOO' }),
          expect.objectContaining({ id: 'GOLD' }),
        ]),
      }),
    }));
  });

  it('keeps every adjusted sample and direct composition at 100 percent in 5 percent steps', () => {
    render(<PortfolioExamplePicker draft={createCashOnlyDraft(200_000, 1)} investmentWon={200_000}
      now={() => 2} onAction={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'QLD 50 · SCHD 30 · 금 20' }));
    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: '주력 비율 5% 높이기' }));
    }
    const samplePreview = screen.getByRole('heading', { name: '구성 미리보기' }).closest('section')!;
    expect(samplePreview).toHaveTextContent('QLD70%');
    expect(samplePreview).toHaveTextContent('SCHD20%');
    expect(samplePreview).toHaveTextContent('금(GOLD)10%');

    fireEvent.click(screen.getByRole('button', { name: '직접 조합' }));
    fireEvent.change(screen.getByLabelText('주 투자 대상'), { target: { value: 'VOO' } });
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: '주력 비율 5% 낮추기' }));
    }
    fireEvent.change(screen.getByLabelText('보조 투자 대상 1'), { target: { value: 'GOLD' } });
    fireEvent.click(screen.getByRole('button', { name: '보조 대상 하나 더 추가' }));
    fireEvent.change(screen.getByLabelText('보조 투자 대상 2'), { target: { value: 'BTC' } });
    const directPreview = screen.getByRole('heading', { name: '구성 미리보기' }).closest('section')!;
    expect(directPreview).toHaveTextContent('VOO55%');
    expect(directPreview).toHaveTextContent('금(GOLD)25%');
    expect(directPreview).toHaveTextContent('BTC20%');
  });
});
