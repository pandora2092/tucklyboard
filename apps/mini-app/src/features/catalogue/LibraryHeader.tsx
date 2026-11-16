import { COPY } from '@tuckly/contracts';

import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

import type { Catalogue } from './useCatalogue';

import '../../pages/library-header.css';

export function LibraryHeader({
  data,
  changeSpace,
  onAdd,
  onSettings,
  onMembers,
  onCreateSpace,
}: {
  data: Pick<Catalogue, 'spaces' | 'activeSpace' | 'canEdit' | 'loading' | 'statuses' | 'isAdmin'>;
  changeSpace: (id: string) => void;
  onAdd: () => void;
  onSettings: () => void;
  onMembers: () => void;
  onCreateSpace: () => void;
}) {
  const { spaces, activeSpace, canEdit, loading, statuses, isAdmin } = data;
  return (
    <header className={'library-header'}>
      <div className={'space-picker'}>
        <Select
          aria-label={COPY.space.label}
          value={activeSpace?.id || ''}
          onChange={e => {
            changeSpace(e.target.value);
          }}
        >
          {spaces.map(space => (
            <option key={space.id} value={space.id}>
              {space.name}
              {space.memberCount > 1 ? ' · совместное' : ''}
            </option>
          ))}
        </Select>
      </div>
      <Button
        variant={'primary'}
        disabled={!canEdit || loading || !statuses.length}
        onClick={() => onAdd()}
      >
        ＋ Добавить
      </Button>
      <nav className={'space-actions'} aria-label={'Управление пространством'}>
        {activeSpace && (
          <Button
            className={'space-settings-button'}
            aria-haspopup={'dialog'}
            onClick={() => onSettings()}
          >
            <Icon name={'settings'} size={18} />
            Настройки
          </Button>
        )}
        {activeSpace && (
          <Button
            type={'button'}
            className={'space-members-button'}
            aria-label={COPY.space.members}
            title={COPY.space.members}
            aria-haspopup={'dialog'}
            onClick={() => onMembers()}
          >
            <Icon name={'members'} />
          </Button>
        )}
        <Button onClick={() => onCreateSpace()}>＋ Пространство</Button>
        {isAdmin && <a href={'/admin'}>Админка</a>}
      </nav>
    </header>
  );
}
