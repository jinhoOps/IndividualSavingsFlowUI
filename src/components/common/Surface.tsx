import type { HTMLAttributes, ReactNode, Ref } from 'react';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'aside';
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
};

export function Surface({ as = 'div', className = '', children, ref, ...props }: SurfaceProps) {
  const classes = `ui-surface ${className}`.trim();

  if (as === 'section') return <section ref={ref} className={classes} {...props}>{children}</section>;
  if (as === 'aside') return <aside ref={ref} className={classes} {...props}>{children}</aside>;
  return <div ref={ref as Ref<HTMLDivElement>} className={classes} {...props}>{children}</div>;
}
