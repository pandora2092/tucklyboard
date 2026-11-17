import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { UI_TIMING_MS } from '../constants/timing';

import { Button } from './ui/Button';

import './select.css';

type OptionProps = { value: string; children: ReactNode; disabled?: boolean };

function text(node: ReactNode): string {
  return Children.toArray(node)
    .map(child =>
      isValidElement<{ children?: ReactNode }>(child)
        ? text(child.props.children)
        : typeof child === 'string' || typeof child === 'number'
          ? String(child)
          : '',
    )
    .join('');
}

export function Select({
  children,
  value,
  onChange,
  disabled = false,
  'aria-label': label,
  id,
}: {
  children: ReactNode;
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
}) {
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map(child => ({ ...child.props, label: text(child.props.children) }));
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const selected = options.findIndex(option => option.value === value);

  function show() {
    if (disabled || !options.length) {
      return;
    }
    setActive(selected >= 0 ? selected : options.findIndex(option => !option.disabled));
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) {
      return;
    }
    onChange({ target: { value: option.value } });
    setOpen(false);
    trigger.current?.focus();
  }
  function move(direction: number) {
    for (let step = 1; step <= options.length; step++) {
      const index = (active + direction * step + options.length) % options.length;
      if (!options[index].disabled) {
        setActive(index);
        break;
      }
    }
  }
  useEffect(() => {
    if (!open || disabled) {
      return;
    }
    function place() {
      const rect = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const upward = below < 180 && rect.top > below;
      const maxHeight = Math.max(60, Math.min(280, (upward ? rect.top : below) - 16));
      const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
      const height = Math.min(menu.current?.scrollHeight || maxHeight, maxHeight);
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: upward ? Math.max(8, rect.top - height - 6) : rect.bottom + 6,
        width,
        maxHeight,
      });
    }
    function outside(event: Event) {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) {
        setOpen(false);
      }
    }
    place();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, disabled]);
  useEffect(() => {
    if (open) {
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, open, listId]);

  return (
    <>
      <Button
        ref={trigger}
        id={id}
        type={'button'}
        className={'select-trigger'}
        role={'combobox'}
        aria-label={label}
        aria-haspopup={'listbox'}
        aria-expanded={open && !disabled}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'Tab') {
            setOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              show();
            } else {
              move(event.key === 'ArrowDown' ? 1 : -1);
            }
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            show();
            const indexes = options
              .map((_, index) => index)
              .filter(index => !options[index].disabled);
            setActive(event.key === 'Home' ? indexes[0] : indexes[indexes.length - 1]);
          } else if ((event.key === 'Enter' || event.key === ' ') && open) {
            event.preventDefault();
            choose(active);
          } else if (
            event.key.length === 1 &&
            event.key !== ' ' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const now = Date.now();
            search.current = {
              text:
                (now - search.current.time < UI_TIMING_MS.selectTypeaheadReset
                  ? search.current.text
                  : '') + event.key.toLocaleLowerCase(),
              time: now,
            };
            const index = options.findIndex(
              option =>
                !option.disabled &&
                option.label.toLocaleLowerCase().startsWith(search.current.text),
            );
            if (index >= 0) {
              if (!open) {
                show();
              }
              setActive(index);
            }
          }
        }}
      >
        <span className={'select-value'}>{options[selected]?.label || '\u00a0'}</span>
        <span className={'select-arrow'} aria-hidden={'true'}>
          ▾
        </span>
      </Button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            className={'select-menu'}
            role={'listbox'}
            aria-label={label}
            style={position}
            onMouseDown={event => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                className={`select-option${active === index ? ' highlighted' : ''}`}
                role={'option'}
                aria-selected={value === option.value}
                aria-disabled={option.disabled || undefined}
                onPointerMove={() => !option.disabled && setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.label}</span>
                {value === option.value && <span aria-hidden={'true'}>✓</span>}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
