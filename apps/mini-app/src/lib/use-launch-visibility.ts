import { useEffect, useState } from 'react';

export function useLaunchVisibility() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const telegram = window.Telegram?.WebApp;
    const update = () =>
      setActive(
        document.visibilityState === 'visible' &&
          (!telegram?.initData || telegram.isActive !== false),
      );
    document.addEventListener('visibilitychange', update);
    telegram?.onEvent?.('activated', update);
    telegram?.onEvent?.('deactivated', update);
    update();
    return () => {
      document.removeEventListener('visibilitychange', update);
      telegram?.offEvent?.('activated', update);
      telegram?.offEvent?.('deactivated', update);
    };
  }, []);
  return { active };
}
