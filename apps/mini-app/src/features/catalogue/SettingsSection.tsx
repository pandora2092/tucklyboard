import { useId, useRef, useState, type KeyboardEventHandler, type ReactNode } from 'react';

import { Button } from '../../components/ui/Button';

export function SettingsSection({
  title,
  count,
  label,
  disabled = false,
  onCollapse,
  onKeyDown,
  children,
}: {
  title: string;
  count: number | string;
  label: string;
  disabled?: boolean;
  onCollapse: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  function collapse() {
    setOpen(false);
    onCollapse();
    toggle.current?.focus({ preventScroll: true });
    toggle.current?.scrollIntoView({ block: 'nearest' });
  }
  return (
    <section className={'settings-block settings-section'} aria-label={label} onKeyDown={onKeyDown}>
      <h3 className={'settings-section-heading'}>
        <Button
          ref={toggle}
          className={'settings-section-toggle'}
          aria-expanded={open}
          aria-controls={contentId}
          disabled={disabled}
          onClick={() => (open ? collapse() : setOpen(true))}
        >
          <span>{title}</span>
          <span className={'settings-section-count'}>{count}</span>
          <span className={'settings-section-chevron'} aria-hidden={'true'}>
            {open ? '−' : '+'}
          </span>
        </Button>
      </h3>
      <div id={contentId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
