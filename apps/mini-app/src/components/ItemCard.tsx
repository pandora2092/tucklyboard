import './item-card.css';

import type { Item } from '@tuckly/contracts';

import { useLongPress } from '../lib/use-long-press';

import { MediaPreview } from './MediaPreview';
import { Button } from './ui/Button';

export function ItemCard({
  item: i,
  onOpen,
  onTag,
  onCopyLink,
  measurementOnly = false,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onTag: (tag: string) => void;
  onCopyLink: (url: string) => void;
  measurementOnly?: boolean;
}) {
  const longPress = useLongPress(Boolean(i.url), () => {
    if (i.url) {
      onCopyLink(i.url);
    }
  });
  return (
    <article
      className={`item-${i.type}`}
      {...longPress.handlers}
      data-copy-ready={longPress.ready || undefined}
      onClick={() => {
        if (!longPress.consumeClick()) {
          onOpen(i);
        }
      }}
      tabIndex={0}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) {
          return;
        }
        if (i.url && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          onCopyLink(i.url);
        } else if (e.key === 'Enter') {
          onOpen(i);
        }
      }}
    >
      <div className={`preview ${i.type}`}>
        {!measurementOnly && <MediaPreview item={i} />}
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
        {i.tags.length > 0 && (
          <div className={'tags'}>
            {i.tags.map(t => (
              <Button
                key={t}
                onClick={e => {
                  e.stopPropagation();
                  onTag(t);
                }}
              >
                #{t}
              </Button>
            ))}
          </div>
        )}
        {i.statusInfo && (
          <span className={'status-label'}>
            <span
              className={'status-dot'}
              style={{ backgroundColor: i.statusInfo.color }}
              aria-hidden={'true'}
            />
            {i.statusInfo.name}
          </span>
        )}
        <footer>
          <span>{i.collections.map(c => c.name).join(' · ') || 'Входящие'}</span>
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
