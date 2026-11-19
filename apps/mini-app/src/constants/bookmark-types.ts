import { COPY } from '@tuckly/contracts';

export const BOOKMARK_TYPES = [
  { value: '', label: COPY.bookmarkTypes.all, title: COPY.bookmarkTypes.allTitle, icon: 'library' },
  { value: 'link', label: COPY.bookmarkTypes.links, title: COPY.bookmarkTypes.links, icon: 'link' },
  {
    value: 'photo',
    label: COPY.bookmarkTypes.photos,
    title: COPY.bookmarkTypes.photos,
    icon: 'photo',
  },
  {
    value: 'video',
    label: COPY.bookmarkTypes.videos,
    title: COPY.bookmarkTypes.videos,
    icon: 'video',
  },
  { value: 'text', label: COPY.bookmarkTypes.notes, title: COPY.bookmarkTypes.notes, icon: 'note' },
] as const;
