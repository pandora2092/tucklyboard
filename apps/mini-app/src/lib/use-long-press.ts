import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

import { LONG_PRESS_MOVE_TOLERANCE_PX } from '../constants/gestures';
import { UI_TIMING_MS } from '../constants/timing';

const INTERACTIVE_TARGET = 'button, a, input, textarea, select, label, video, [role="button"]';

export function useLongPress(enabled: boolean, onLongPress: () => void) {
  const [ready, setReady] = useState(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    ready: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(false);
  function cancel() {
    if (gesture.current) {
      clearTimeout(gesture.current.timer);
      gesture.current = null;
      suppressClick.current = true;
      setReady(false);
    }
  }
  useEffect(() => {
    window.addEventListener('scroll', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('scroll', cancel, true);
      window.removeEventListener('blur', cancel);
      if (gesture.current) {
        clearTimeout(gesture.current.timer);
        gesture.current = null;
      }
    };
  }, [enabled]);
  function onPointerDown(event: PointerEvent<HTMLElement>) {
    cancel();
    suppressClick.current = false;
    if (
      !enabled ||
      !event.isPrimary ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest(INTERACTIVE_TARGET)
    ) {
      return;
    }
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ready: false,
      timer: setTimeout(() => {
        if (gesture.current) {
          gesture.current.ready = true;
          setReady(true);
        }
      }, UI_TIMING_MS.longPress),
    };
  }
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (
      active &&
      Math.hypot(event.clientX - active.x, event.clientY - active.y) > LONG_PRESS_MOVE_TOLERANCE_PX
    ) {
      cancel();
    }
  }
  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) {
      return;
    }
    clearTimeout(active.timer);
    gesture.current = null;
    setReady(false);
    if (active.ready) {
      suppressClick.current = true;
      // Copy on release so WebKit receives the write during a user gesture.
      onLongPress();
    }
  }
  return {
    ready,
    consumeClick() {
      const consumed = suppressClick.current;
      suppressClick.current = false;
      return consumed;
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu(event: MouseEvent<HTMLElement>) {
        if (enabled && (gesture.current || suppressClick.current)) {
          event.preventDefault();
        }
      },
    },
  };
}
