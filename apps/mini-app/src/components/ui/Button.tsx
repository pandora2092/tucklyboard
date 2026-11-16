import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'plain' | 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'plain', type = 'button', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['ui-button', variant === 'plain' ? '' : variant, className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
