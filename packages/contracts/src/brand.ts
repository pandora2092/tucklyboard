// Shared product dictionary for the Mini App, API and bot.
// Package names and existing storage identifiers are configured separately.
export const BRAND = {
  name: 'tuckly',
  domain: 'tucklyboard.ru',
} as const;

export const COPY = {
  pageTitle: `${BRAND.name} · своё место`,
  adminHeading: `Управление ${BRAND.name}`,
  backToApp: `Вернуться в ${BRAND.name}`,
  adminOnly: `Доступ разрешён только администраторам ${BRAND.name}`,
  adminLogin: `Войти в админку ${BRAND.name} через Telegram`,
  openApp: `Открыть ${BRAND.name}`,
  openBot: `Откройте бота ${BRAND.name}, отправьте`,
  welcome: `Присылайте ссылки, текст, фото и видео. Файлы останутся в Telegram, а коллекции и теги — в ${BRAND.name}.`,
  previewUserAgent: `${BRAND.name}-LinkPreview/1.0`,
} as const;
