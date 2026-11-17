import './sidebar.css';

import { BRAND, type Collection } from '@tuckly/contracts';

import { BrandLogo } from './BrandLogo';
import { BrandMark } from './BrandMark';
import { CollectionCover } from './CollectionCover';
import { Button } from './ui/Button';

export function Sidebar({
  collections,
  spaceName,
  canEdit,
  collection,
  setCollection,
  addCollection,
}: {
  collections: Collection[];
  spaceName: string;
  canEdit: boolean;
  collection: string;
  setCollection: (id: string) => void;
  addCollection: () => void;
}) {
  return (
    <aside className={'library-sidebar'}>
      <a className={'brand'} href={'#'} aria-label={`${BRAND.name} — ${BRAND.tagline}`}>
        <BrandLogo />
      </a>
      <div className={'space'}>
        <span className={'avatar'}>{spaceName.slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{spaceName}</b>
          <small>Всё, что хочется сохранить</small>
        </div>
      </div>
      <p className={'eyebrow'}>БИБЛИОТЕКА</p>
      <Button className={!collection ? 'nav active' : 'nav'} onClick={() => setCollection('')}>
        <span>▦</span>Все сохранённое
      </Button>
      <Button
        className={collection === 'inbox' ? 'nav active' : 'nav'}
        onClick={() => setCollection('inbox')}
      >
        <span>⌑</span>Входящие
      </Button>
      <div className={'section-label'}>
        <p className={'eyebrow'}>КОЛЛЕКЦИИ</p>
        <Button disabled={!canEdit} aria-label={'Создать коллекцию'} onClick={addCollection}>
          +
        </Button>
      </div>
      {collections.map(c => (
        <Button
          key={c.id}
          className={collection === c.id ? 'nav active' : 'nav'}
          onClick={() => setCollection(c.id)}
        >
          <CollectionCover name={c.name} compact />
          {c.rules ? '✧ ' : ''}
          {c.name}
          <small>{c._count.items}</small>
        </Button>
      ))}
      {!collections.length && <p className={'hint'}>Соберите идеи в свою первую коллекцию.</p>}
      <div className={'aside-bottom'}>
        <BrandMark />
        <p>
          Хорошие находки
          <br />
          заслуживают своего места.
        </p>
      </div>
    </aside>
  );
}
