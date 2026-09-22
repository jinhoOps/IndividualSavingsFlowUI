import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadResultCard, renderResultCardPng } from '../../../src/journey/result-card/files';

describe('result card files', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads a PNG and releases its temporary object URL', () => {
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:result-card');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    expect(downloadResultCard(new Blob(['png'], { type: 'image/png' }), 'ISF-plan-2026-09-21.png')).toBe(true);
    expect(document.querySelector('a[download="ISF-plan-2026-09-21.png"]')).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:result-card');
  });

  it('rejects an invalid SVG before it reports a PNG ready for saving', async () => {
    await expect(renderResultCardPng('<svg>')).rejects.toThrow('이미지를 만들지 못했습니다.');
  });
});
