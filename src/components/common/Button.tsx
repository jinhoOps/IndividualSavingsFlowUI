import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'bare';

function buttonClassName(variant: ButtonVariant, className: string) {
  return `ui-button ui-button--${variant} ${className}`.trim();
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(function Button({
  variant = 'secondary',
  className = '',
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={buttonClassName(variant, className)}
      {...props}
    />
  );
});

export const ButtonLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant }>(function ButtonLink({
  variant = 'secondary',
  className = '',
  ...props
}, ref) {
  return (
    <a
      ref={ref}
      className={buttonClassName(variant, className)}
      {...props}
    />
  );
});
