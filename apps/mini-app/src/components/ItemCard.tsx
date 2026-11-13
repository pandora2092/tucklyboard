import type { Item } from '@tuckly/contracts';

import { MediaPreview } from './MediaPreview';

export function ItemCard({
  item: i,
  onOpen,
  onTag,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onTag: (tag: string) => void;
}) {
  return (
    <article
      onClick={() => onOpen(i)}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && e.target === e.currentTarget && onOpen(i)}
    >
      <div className={`preview ${i.type}`}>
        <MediaPreview item={i} />
        <span className={'type-badge'}>
          {
            (
              {
                link: 'Ссылка',
                photo: 'Фото',
                video: 'Видео',
                text: 'Заметка',
              } as Record<string, string>
            )[i.type]
          }
        </span>
      </div>
      <div className={'card-body'}>
        <small className={'source'}>{i.source || i.collection?.name || 'Сохранено вами'}</small>
        <h3>{i.title}</h3>
        {(i.tags.length > 0 || i.autoTags.length > 0) && (
          <div className={'tags'}>
            {[
              ...new Set([...i.tags, ...i.autoTags.filter(t => !i.dismissedAutoTags.includes(t))]),
            ].map(t => (
              <button
                key={t}
                onClick={e => {
                  e.stopPropagation();
                  onTag(t);
                }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        <footer>
          <span>
            {i.collections.map(c => c.name).join(' · ') || 'Входящие'}
            {i.status === 'done' ? ' · ✓' : ''}
          </span>
          <span>
            {new Date(i.createdAt).toLocaleDateString('ru', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </footer>
      </div>
    </article>
  );
}
