import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoneyField } from '../../../src/main/ui/common/MoneyField';

afterEach(cleanup);

describe('MoneyField', () => {
  it.each([
    ['unsafe integer', '9007199254740992'],
    ['decimal', '1.5'],
    ['negative', '-1'],
  ])('uses the domain parser for %s input', (_label, input) => {
    const onChange = vi.fn();
    render(<MoneyField id="amount" label="금액" valueWon={0} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('금액'), { target: { value: input } });

    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
