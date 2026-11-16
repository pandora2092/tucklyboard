import type { ComponentProps, ReactNode } from 'react';

export function Field({
  label,
  children,
  className,
  ...props
}: ComponentProps<'label'> & { label: ReactNode }) {
  return (
    <label {...props} className={['ui-field', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={['ui-input', className].filter(Boolean).join(' ')} />;
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={['ui-input', className].filter(Boolean).join(' ')} />;
}
