import { useState, type FormEvent } from 'react';

import {
  COPY,
  SPACE_BACKGROUND_PATTERNS,
  SPACE_THEMES,
  type Space,
  type SpaceBackground,
  type SpaceTheme,
} from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { spaceBackgroundStyle } from '../../lib/space-background';
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
  onThemeChanged: (theme: SpaceTheme, background: SpaceBackground) => void;
}) {
  const [theme, setTheme] = useState(space.theme);
  const [background, setBackground] = useState(space.background);
  const backgroundChanged = JSON.stringify(background) !== JSON.stringify(space.background);
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
      await catalogueApi.updateSpaceTheme(space.id, theme, background);
      onThemeChanged(theme, background);
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
      <fieldset className={'background-settings'} disabled={!owner || busy}>
        <legend>Рисунок фона</legend>
        <div className={'background-options'} role={'group'} aria-label={'Рисунок фона'}>
          {Object.entries(SPACE_BACKGROUND_PATTERNS).map(([pattern, name]) => (
            <Button
              key={pattern}
              className={'background-option'}
              aria-pressed={background.pattern === pattern}
              onClick={() => {
                setBackground(value => ({
                  ...value,
                  pattern: pattern as SpaceBackground['pattern'],
                }));
                setThemeNotice('');
              }}
            >
              <span
                className={'background-swatch'}
                aria-hidden={'true'}
                style={{
                  ...spaceThemeStyle(theme),
                  ...spaceBackgroundStyle(theme, {
                    ...background,
                    pattern: pattern as SpaceBackground['pattern'],
                  }),
                }}
              />
              <span>{name}</span>
            </Button>
          ))}
        </div>
        <Field label={`Контраст: ${background.contrast}%`}>
          <input
            type={'range'}
            min={10}
            max={80}
            step={1}
            aria-label={'Контраст рисунка'}
            value={background.contrast}
            disabled={background.pattern === 'none'}
            onChange={event => {
              setBackground(value => ({ ...value, contrast: Number(event.target.value) }));
              setThemeNotice('');
            }}
          />
        </Field>
        <Field label={'Масштаб рисунка'}>
          <Select
            value={background.scale}
            disabled={!owner || busy || background.pattern === 'none'}
            onChange={event => {
              setBackground(value => ({
                ...value,
                scale: event.target.value as SpaceBackground['scale'],
              }));
              setThemeNotice('');
            }}
          >
            <option value={'small'}>Мелкий</option>
            <option value={'medium'}>Средний</option>
            <option value={'large'}>Крупный</option>
          </Select>
        </Field>
      </fieldset>
      <div
        className={'theme-preview'}
        style={{ ...spaceThemeStyle(theme), ...spaceBackgroundStyle(theme, background) }}
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
        <Button
          type={'submit'}
          variant={'primary'}
          disabled={busy || (theme === space.theme && !backgroundChanged)}
        >
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
