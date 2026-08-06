import type { ReactNode } from 'react';
import type { JourneyApp } from '../../journey/routes';
import { AppLauncher } from '../../journey/ui/AppLauncher';

export interface AppShellProps {
  currentApp: JourneyApp;
  managementMenu?: ReactNode;
  showLauncher?: boolean;
  children: ReactNode;
}

export function AppShell({
  currentApp,
  managementMenu,
  showLauncher = true,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell" data-testid="app-shell">
      {showLauncher ? (
        <div className="app-shell__launcher-frame" data-testid="app-shell-launcher">
          <AppLauncher currentApp={currentApp} managementMenu={managementMenu} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
