export function isAdmin(telegramId: string): boolean {
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => /^[1-9]\d*$/.test(value))
    .includes(telegramId);
}
