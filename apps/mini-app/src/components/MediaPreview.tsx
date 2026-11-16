import './item-card.css';

import { useEffect, useState } from 'react';

import type { Item } from '@tuckly/contracts';

import { fetchPreview } from '../api/client';

export function MediaPreview({ item, detail = false }: { item: Item; detail?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!item.previewUrl) {
      setPreview(null);
      return;
    }
    setPreview(null);
    const controller = new AbortController();
    let objectUrl: string | undefined;
    fetchPreview(item.previewUrl, controller.signal)
      .then(blob => {
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setPreview(objectUrl);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreview(null);
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.previewUrl]);
  if (preview) {
    return (
      <img
        className={detail ? 'detail-media' : undefined}
        src={preview}
        alt={item.title}
        loading={'lazy'}
        onError={() => setPreview(null)}
      />
    );
  }
  if (item.mediaUrl) {
    return item.type === 'video' ? (
      <video
        className={detail ? 'detail-media' : undefined}
        src={item.mediaUrl}
        controls={detail}
        preload={'metadata'}
      />
    ) : (
      <img
        className={detail ? 'detail-media' : undefined}
        src={item.mediaUrl}
        alt={item.title}
        loading={'lazy'}
      />
    );
  }
  return (
    <div className={detail ? 'media-placeholder detail-placeholder' : 'media-placeholder'}>
      <span className={'preview-symbol'}>
        {item.type === 'link'
          ? '↗'
          : item.type === 'video'
            ? '▷'
            : item.type === 'photo'
              ? '▧'
              : '“'}
      </span>
      <p>
        {item.storage === 'telegram'
          ? 'Оригинал в Telegram'
          : item.type === 'link'
            ? item.source
            : item.text.slice(0, 170) || item.title}
      </p>
    </div>
  );
}
