import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'bare';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }>(function Button({
  variant = 'secondary',
  className = '',
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={`ui-button ui-button--${variant} ${className}`.trim()}
      {...props}
    />
  );
});
