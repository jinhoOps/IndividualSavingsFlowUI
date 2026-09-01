import { describe, expect, it, vi } from 'vitest';
import {
  createMainPlanActionNotifications,
} from '../../../src/main/ui/mainPlanActionNotifications';

describe('main plan action notifications', () => {
  it('notifies current subscribers only for explicit successful plan actions', () => {
    const notifications = createMainPlanActionNotifications();
    const listener = vi.fn();
    const unsubscribe = notifications.subscribe(listener);

    notifications.notify('apply');
    notifications.notify('cancel');
    unsubscribe();
    notifications.notify('apply');

    expect(listener.mock.calls).toEqual([['apply'], ['cancel']]);
  });
});
