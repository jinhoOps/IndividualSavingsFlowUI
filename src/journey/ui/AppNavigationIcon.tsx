import type { JourneyApp } from '../routes';

export function AppNavigationIcon({ app }: { app: JourneyApp }) {
  const common = {
    'aria-hidden': true,
    focusable: false,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (app === 'main') {
    return (
      <svg {...common}>
        <path d="M3.5 10.4 12 3.5l8.5 6.9" />
        <path d="M5.5 9.2V20h13V9.2M9.5 20v-6h5v6" />
      </svg>
    );
  }

  if (app === 'simulation') {
    return (
      <svg {...common}>
        <path d="M4 18.5 9.2 13l3.6 3.1L20 7.5" />
        <path d="M14.8 7.5H20v5.2" />
      </svg>
    );
  }

  if (app === 'lounge') return <svg {...common}><rect x="3.5" y="4" width="17" height="13" rx="3" /><path d="m8 17-3 4v-5M7.5 13V10M12 13V7M16.5 13V9" /></svg>;

  return (
    <svg {...common}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z" />
      <path d="M14 3.7a8.5 8.5 0 0 1 6.3 6.3H14Z" />
    </svg>
  );
}
