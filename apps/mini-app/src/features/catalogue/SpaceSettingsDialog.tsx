import { useState } from 'react';

import type {
  BookmarkStatus,
  Collection,
  Space,
  SpaceBackground,
  SpaceTheme,
} from '@tuckly/contracts';

import { Dialog } from '../../components/ui/Dialog';

import { CollectionManager } from './CollectionManager';
import { SpaceDeleteSettings, SpaceNameSettings } from './SpaceManagement';
import { SpaceThemeSettings } from './SpaceThemeSettings';
import { StatusManager } from './StatusManager';

import './status-settings.css';

export function SpaceSettingsDialog({
  space,
  collections,
  statuses,
  onCollectionDeleted,
  onSpaceRenamed,
  onSpaceDeleted,
  onClose,
  onChanged,
  onThemeChanged,
}: {
  space: Space;
  collections: Collection[];
  statuses: BookmarkStatus[];
  onCollectionDeleted: (id: string) => void;
  onSpaceRenamed: (name: string) => void;
  onSpaceDeleted: () => Promise<void>;
  onClose: () => void;
  onChanged: () => void;
  onThemeChanged: (theme: SpaceTheme, background: SpaceBackground) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={'Настройки'}
      subtitle={space.name}
      scrollBody
      closeLabel={'Закрыть настройки'}
      className={'status-settings'}
      busy={busy}
      onClose={onClose}
    >
      <div className={'settings-blocks'}>
        <section className={'settings-block'} aria-label={'Управление пространством'}>
          <SpaceNameSettings
            space={space}
            busy={busy}
            onBusyChange={setBusy}
            onRenamed={onSpaceRenamed}
          />
          <SpaceDeleteSettings
            space={space}
            busy={busy}
            onBusyChange={setBusy}
            onDeleted={onSpaceDeleted}
          />
        </section>
        <SpaceThemeSettings
          space={space}
          busy={busy}
          onBusyChange={setBusy}
          onThemeChanged={onThemeChanged}
        />
        <CollectionManager
          space={space}
          collections={collections}
          statuses={statuses}
          busy={busy}
          onBusyChange={setBusy}
          onChanged={onChanged}
          onDeleted={onCollectionDeleted}
        />
        <StatusManager space={space} busy={busy} onBusyChange={setBusy} onChanged={onChanged} />
      </div>
    </Dialog>
  );
}
