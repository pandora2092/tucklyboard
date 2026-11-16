import { useLayoutEffect, useRef, type ComponentProps } from 'react';

export function Checkbox({
  indeterminate = false,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'ref'> & { indeterminate?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (input.current) {
      input.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return <input {...props} ref={input} type={'checkbox'} />;
}
