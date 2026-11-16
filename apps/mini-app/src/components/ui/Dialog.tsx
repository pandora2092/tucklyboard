import './dialog.css';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { COPY } from '@tuckly/contracts';

import { Button } from './Button';

export function Dialog({
  title,
  children,
  onClose,
  busy = false,
  className,
  headerActions,
  eyebrow,
  label,
  closeLabel = COPY.actions.close,
  closeOnBackdrop = false,
  onEscape,
}: {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  headerActions?: ReactNode;
  eyebrow?: ReactNode;
  label?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
  onEscape?: () => void;
}) {
  const titleId = useId();
  const root = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const previous = useRef(document.activeElement);
  useEffect(() => {
    if (!busy && !root.current?.contains(document.activeElement)) {
      close.current?.focus();
    }
  }, [title, busy]);
  useEffect(() => {
    const target = previous.current;
    return () => {
      if (target instanceof HTMLElement && target.isConnected) {
        target.focus();
      }
    };
  }, []);
  return (
    <div
      className={'overlay'}
      onClick={event => {
        if (event.target === event.currentTarget && closeOnBackdrop && !busy) {
          onClose();
        }
      }}
      onKeyDown={event => {
        if (event.defaultPrevented) {
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) {
            (onEscape || onClose)();
          }
        }
        if (event.key === 'Tab') {
          const controls = [
            ...root.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
            ),
          ].filter(control => control.getClientRects().length > 0);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        ref={root}
        className={['dialog', className].filter(Boolean).join(' ')}
        role={'dialog'}
        aria-modal={'true'}
        aria-label={label}
        aria-labelledby={label ? undefined : titleId}
      >
        <div className={'dialog-top'}>
          <div>
            {eyebrow}
            <h2 id={titleId}>{title}</h2>
          </div>
          <div className={'dialog-header-actions'}>
            {headerActions}
            <Button ref={close} disabled={busy} aria-label={closeLabel} onClick={onClose}>
              ×
            </Button>
          </div>
        </div>
        {children}
      </section>
    </div>
  );
}
