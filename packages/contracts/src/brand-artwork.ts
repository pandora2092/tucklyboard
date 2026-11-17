// Shared vector geometry for the app, exported logos and Telegram avatar.
export const BRAND_ARTWORK = {
  markViewBox: '0 0 64 64',
  logoViewBox: '0 0 284 64',
  flower:
    'M31 6C38 3 39 15 38 22C43 15 52 11 55 17C59 23 48 29 42 31C50 32 60 37 56 43C53 49 43 43 38 39C40 47 39 59 32 58C25 58 27 46 27 40C22 46 12 52 9 45C6 39 16 34 23 32C15 30 5 25 9 19C13 13 22 20 27 24C25 17 25 7 31 6Z',
  // The hooked t and cupped u echo the idea of keeping a find in its own place.
  letters: [
    'M17 12V40Q17 49 27 46M7 25H29',
    'M43 25V37Q43 48 54 48Q65 48 65 37V25',
    'M103 28C88 17 77 27 77 37C77 49 93 52 104 44',
    'M119 12V48M141 25L121 37L143 48',
    'M158 12V39Q158 48 168 46',
    'M181 25L194 46M208 25L194 52Q190 60 181 57',
  ],
  logoMarkTransform: 'translate(225 4) scale(0.85)',
  strokeWidth: 6.5,
  avatarOrbitStrokeWidth: 12,
  avatarOrbitOpacity: 0.4,
  ink: '#30392f',
  accent: '#536c42',
  paper: '#f7f8f3',
} as const;
