import type { HTMLAttributes, ReactNode, Ref } from 'react';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'aside';
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
};

export function Surface({ as = 'div', className = '', children, ref, ...props }: SurfaceProps) {
  const classes = `ui-surface ${className}`.trim();
  const assignRef = ref == null ? undefined : (element: HTMLElement | null) => {
    if (typeof ref === 'function') return ref(element);
    else ref.current = element;
  };

  if (as === 'section') return <section ref={assignRef} className={classes} {...props}>{children}</section>;
  if (as === 'aside') return <aside ref={assignRef} className={classes} {...props}>{children}</aside>;
  return <div ref={assignRef} className={classes} {...props}>{children}</div>;
}
