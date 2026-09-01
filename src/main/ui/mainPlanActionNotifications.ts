export type SuccessfulMainPlanAction = 'apply' | 'cancel';

type MainPlanActionListener = (action: SuccessfulMainPlanAction) => void;

export interface MainPlanActionNotifications {
  notify(action: SuccessfulMainPlanAction): void;
  subscribe(listener: MainPlanActionListener): () => void;
}

export function createMainPlanActionNotifications(): MainPlanActionNotifications {
  const listeners = new Set<MainPlanActionListener>();

  return {
    notify: (action) => {
      for (const listener of listeners) listener(action);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
