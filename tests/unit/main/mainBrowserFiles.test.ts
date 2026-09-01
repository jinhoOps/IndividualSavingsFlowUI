import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadJson, readFileText } from '../../../src/main/ui/mainBrowserFiles';

describe('main browser files', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reads a selected file as text', async () => {
    const file = new File(['{"ok":true}'], 'backup.json', { type: 'application/json' });
    await expect(readFileText(file)).resolves.toBe('{"ok":true}');
  });

  it('removes the anchor and revokes the object URL after a successful download', () => {
    vi.useFakeTimers();
    const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const append = vi.spyOn(document.body, 'append');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    expect(downloadJson('{}', 'workspace.json')).toBe(true);
    expect(append).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download="workspace.json"]')).toBeNull();
    vi.runAllTimers();
    expect(url).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:backup');
  });

  it.each([
    ['creating an object URL', () => vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('no URLs'); })],
    ['clicking the temporary anchor', () => vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); })],
  ])('cleans up the temporary anchor when %s fails', (_label, arrange) => {
    vi.useFakeTimers();
    const append = vi.spyOn(document.body, 'append');
    arrange();

    expect(downloadJson('{}', 'workspace.json')).toBe(false);
    expect(append).toHaveBeenCalledTimes(_label === 'creating an object URL' ? 0 : 1);
    expect(document.querySelector('a[download="workspace.json"]')).toBeNull();
  });
});
