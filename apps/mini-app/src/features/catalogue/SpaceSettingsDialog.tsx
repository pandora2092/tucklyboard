import { useState } from 'react';

import type { Space, SpaceTheme } from '@tuckly/contracts';

import { Dialog } from '../../components/ui/Dialog';

import { SpaceThemeSettings } from './SpaceThemeSettings';
import { StatusManager } from './StatusManager';

import './status-settings.css';

export function SpaceSettingsDialog({
  space,
  onClose,
  onChanged,
  onThemeChanged,
}: {
  space: Space;
  onClose: () => void;
  onChanged: () => void;
  onThemeChanged: (theme: SpaceTheme) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={'Настройки'}
      closeLabel={'Закрыть настройки'}
      className={'status-settings'}
      busy={busy}
      onClose={onClose}
    >
      <p className={'settings-space'}>{space.name}</p>
      <SpaceThemeSettings
        space={space}
        busy={busy}
        onBusyChange={setBusy}
        onThemeChanged={onThemeChanged}
      />
      <StatusManager space={space} busy={busy} onBusyChange={setBusy} onChanged={onChanged} />
    </Dialog>
  );
}
