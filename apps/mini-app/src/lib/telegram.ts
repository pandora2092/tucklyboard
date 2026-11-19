type TelegramWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  isActive?: boolean;
  isExpanded?: boolean;
  onEvent?(event: string, listener: (event?: { isStateStable?: boolean }) => void): void;
  offEvent?(event: string, listener: (event?: { isStateStable?: boolean }) => void): void;
};
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
export function telegramHeaders(): Record<string, string> {
  const data = window.Telegram?.WebApp?.initData;
  return data ? { Authorization: `tma ${data}` } : {};
}
export function initializeTelegram() {
  window.Telegram?.WebApp?.ready();
  window.Telegram?.WebApp?.expand();
}
