import { useState, type FormEvent } from 'react';

import { COPY, SPACE_THEMES, type Space, type SpaceTheme } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { spaceThemeStyle } from '../../lib/space-theme';

export function SpaceThemeSettings({
  space,
  busy,
  onBusyChange,
  onThemeChanged,
}: {
  space: Space;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onThemeChanged: (theme: SpaceTheme) => void;
}) {
  const [theme, setTheme] = useState(space.theme);
  const [themeNotice, setThemeNotice] = useState('');
  const [error, setError] = useState('');
  const owner = space.role === 'owner';
  async function saveTheme(event: FormEvent) {
    event.preventDefault();
    if (!owner || busy) {
      return;
    }
    onBusyChange(true);
    setError('');
    setThemeNotice('');
    try {
      await catalogueApi.updateSpaceTheme(space.id, theme);
      onThemeChanged(theme);
      setThemeNotice(COPY.space.themeSaved);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <form className={'settings-block space-theme-settings'} onSubmit={saveTheme}>
      <h3 className={'settings-heading'}>Оформление</h3>
      <p className={'settings-description'}>{COPY.space.themeDescription}</p>
      <div className={'theme-options'} role={'group'} aria-label={COPY.space.themeHeading}>
        {(Object.keys(SPACE_THEMES) as SpaceTheme[]).map(key => (
          <Button
            key={key}
            type={'button'}
            className={'theme-option'}
            aria-pressed={theme === key}
            disabled={!owner || busy}
            style={spaceThemeStyle(key)}
            onClick={() => {
              setTheme(key);
              setThemeNotice('');
            }}
          >
            <span className={'theme-swatch'} aria-hidden={'true'}>
              {theme === key ? '✓' : ''}
            </span>
            {COPY.space.themes[key]}
          </Button>
        ))}
      </div>
      <div
        className={'theme-preview'}
        style={spaceThemeStyle(theme)}
        aria-label={COPY.space.themePreview}
      >
        <strong>
          <span className={'space-color-dot'} aria-hidden={'true'} />
          {space.name}
        </strong>
        <span>{COPY.space.previewCollection}</span>
        <span className={'theme-preview-action'}>{COPY.space.previewAction}</span>
      </div>
      {!owner && <p className={'settings-description'}>{COPY.space.themeOwnerOnly}</p>}
      {owner && (
        <Button type={'submit'} variant={'primary'} disabled={busy || theme === space.theme}>
          {busy ? COPY.actions.saving : COPY.space.themeSave}
        </Button>
      )}
      {error && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
      {themeNotice && (
        <p className={'success'} role={'status'}>
          {themeNotice}
        </p>
      )}
    </form>
  );
}
