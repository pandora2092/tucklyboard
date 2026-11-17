// Shared limits for uploads from the Mini App. Files sent directly to the bot
// follow Telegram's own limits and do not pass through this multipart endpoint.
export const UPLOAD_LIMIT_MB = 20;
export const UPLOAD_LIMIT = UPLOAD_LIMIT_MB * 1024 * 1024;
export const MEDIA_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

export const UPLOAD_FORM_LIMITS = {
  fileSize: UPLOAD_LIMIT,
  files: 1,
  fields: 1,
  fieldSize: 25_000,
} as const;
