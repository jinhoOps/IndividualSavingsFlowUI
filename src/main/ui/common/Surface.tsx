import type { HTMLAttributes, ReactNode } from 'react';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'aside';
  children?: ReactNode;
};

export function Surface({ as = 'div', className = '', children, ...props }: SurfaceProps) {
  const classes = `ui-surface ${className}`.trim();

  if (as === 'section') return <section className={classes} {...props}>{children}</section>;
  if (as === 'aside') return <aside className={classes} {...props}>{children}</aside>;
  return <div className={classes} {...props}>{children}</div>;
}
