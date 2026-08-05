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

  if (app === 'portfolio') {
    return (
      <svg {...common}>
        <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z" />
        <path d="M14 3.7a8.5 8.5 0 0 1 6.3 6.3H14Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3.5 6.5c3.1-.9 5.9-.5 8.5 1.2v11c-2.6-1.7-5.4-2.1-8.5-1.2Z" />
      <path d="M20.5 6.5c-3.1-.9-5.9-.5-8.5 1.2v11c2.6-1.7 5.4-2.1 8.5-1.2Z" />
      <path d="M6.3 10h2.8M14.9 10h2.8M6.3 13h2.8M14.9 13h2.8" />
    </svg>
  );
}
