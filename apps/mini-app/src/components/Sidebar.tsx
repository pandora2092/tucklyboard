import { BRAND, type Collection } from '@tuckly/contracts';

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
    <aside>
      <a className={'brand'} href={'#'}>
        {BRAND.name}
        <span>✳</span>
      </a>
      <div className={'space'}>
        <span className={'avatar'}>М</span>
        <div>
          <b>{spaceName}</b>
          <small>Всё, что хочется сохранить</small>
        </div>
      </div>
      <p className={'eyebrow'}>БИБЛИОТЕКА</p>
      <button className={!collection ? 'nav active' : 'nav'} onClick={() => setCollection('')}>
        <span>▦</span>Все сохранённое
      </button>
      <button
        className={collection === 'inbox' ? 'nav active' : 'nav'}
        onClick={() => setCollection('inbox')}
      >
        <span>⌑</span>Входящие
      </button>
      <div className={'section-label'}>
        <p className={'eyebrow'}>КОЛЛЕКЦИИ</p>
        <button disabled={!canEdit} aria-label={'Создать коллекцию'} onClick={addCollection}>
          +
        </button>
      </div>
      {collections.map(c => (
        <button
          key={c.id}
          className={collection === c.id ? 'nav active' : 'nav'}
          onClick={() => setCollection(c.id)}
        >
          <span>▱</span>
          {c.rules ? '✧ ' : ''}
          {c.name}
          <small>{c._count.items}</small>
        </button>
      ))}
      {!collections.length && <p className={'hint'}>Соберите идеи в свою первую коллекцию.</p>}
      <div className={'aside-bottom'}>
        <span>✳</span>
        <p>
          Хорошие находки
          <br />
          заслуживают своего места.
        </p>
      </div>
    </aside>
  );
}
