import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { COPY } from '@tuckly/contracts';

import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

import './item-actions.css';

export function ItemActions({
  onCopy,
  onDelete,
  disabled = false,
}: {
  onCopy: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!open || disabled) {
      return;
    }
    const anchor = trigger.current!.getBoundingClientRect();
    const bounds = menu.current!.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || window.innerWidth);
    const bottom = top + (viewport?.height || window.innerHeight);
    setPosition({
      left: Math.max(left + 8, Math.min(anchor.right - bounds.width, right - bounds.width - 8)),
      top: Math.max(
        top + 8,
        anchor.bottom + bounds.height + 6 <= bottom - 8
          ? anchor.bottom + 6
          : anchor.top - bounds.height - 6,
      ),
    });
    menu.current?.querySelector('button')?.focus();
  }, [open, disabled]);
  useEffect(() => {
    if (!open) {
      return;
    }
    function outside(event: Event) {
      if (
        !root.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.visualViewport?.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.visualViewport?.removeEventListener('resize', close);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className={'item-actions'}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        type={'button'}
        className={'item-actions-trigger'}
        aria-label={COPY.itemActions.label}
        aria-expanded={open && !disabled}
        disabled={disabled}
        onClick={() => setOpen(value => !value)}
      >
        <Icon name={'more'} size={16} />
      </Button>
      {open &&
        !disabled &&
        createPortal(
          <div ref={menu} className={'item-actions-popover'} style={position}>
            <Button
              type={'button'}
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onCopy();
              }}
            >
              {COPY.itemActions.copyToSpace}
            </Button>
            {onDelete && (
              <Button
                type={'button'}
                className={'item-actions-delete'}
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                {COPY.itemActions.delete}
              </Button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
