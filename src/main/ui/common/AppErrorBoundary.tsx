import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';
import { Surface } from './Surface';

export interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Main UI render failed.', error, info);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MainErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary
      fallback={(
        <main className="grid min-h-dvh place-items-center px-5 py-10">
          <Surface as="section" className="w-full max-w-lg border-rose-200 p-8 shadow-xl" aria-labelledby="main-error-title">
            <p className="m-0 text-sm font-black text-rose-700">안전한 화면 복구</p>
            <h1 className="mt-3 text-3xl font-black text-slate-950" id="main-error-title">화면을 표시하지 못했습니다</h1>
            <p className="leading-7 text-slate-600">저장된 계획은 그대로입니다. 페이지를 다시 불러와 주세요.</p>
            <Button
              className="mt-4"
              variant="primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              페이지 다시 불러오기
            </Button>
          </Surface>
        </main>
      )}
    >
      {children}
    </AppErrorBoundary>
  );
}
