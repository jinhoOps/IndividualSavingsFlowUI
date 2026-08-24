import type { HTMLAttributes, JSX, ReactNode } from 'react';

export interface AppContentFrameProps extends HTMLAttributes<HTMLElement> {
  as?: 'main' | 'section' | 'div';
  children: ReactNode;
}

export function AppContentFrame({
  as = 'main',
  className = '',
  children,
  ...props
}: AppContentFrameProps): JSX.Element {
  const classes = `app-content-frame ${className}`.trim();

  if (as === 'section') return <section className={classes} {...props}>{children}</section>;
  if (as === 'div') return <div className={classes} {...props}>{children}</div>;
  return <main className={classes} {...props}>{children}</main>;
}
