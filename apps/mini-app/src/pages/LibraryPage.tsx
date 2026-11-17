import { useEffect, useState } from 'react';

import { COPY, type Item } from '@tuckly/contracts';

import { catalogueApi } from '../api/catalogue';
import { ActionDialog } from '../components/ActionDialog';
import { BrandMark } from '../components/BrandMark';
import { DeleteItemDialog } from '../components/DeleteItemDialog';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/Button';
import { UI_TIMING_MS } from '../constants/timing';
import {
  BulkActionsBar,
  CollectionDialog,
  CopyItemDialog,
  InvitePanel,
  ItemDialog,
  LibraryFilters,
  LibraryHeader,
  LibraryHeading,
  LibraryResults,
  SpacePanel,
  SpaceSettingsDialog,
  useBulkActions,
  useCatalogue,
} from '../features/catalogue';
import { copyText } from '../lib/clipboard';

import './space-theme.css';
import './album.css';

export function LibraryPage() {
  const catalogue = useCatalogue();
  const {
    activeSpace,
    canEdit,
    collections,
    collection,
    setCollection,
    spaceSwitchNotice,
    dismissSpaceSwitch,
    loadSpaces,
    refresh,
    statuses,
    spaces,
    telegramEnabled,
    changeSpace: changeCatalogueSpace,
    setQuery,
    setType,
    updateSpaceTheme,
    updateSpaceName,
    removeSpaceLocally,
  } = catalogue;
  const [saveNotice, setSaveNotice] = useState({ message: '', version: 0 });
  useEffect(() => {
    if (!saveNotice.message) {
      return;
    }
    const timer = setTimeout(
      () => setSaveNotice(value => ({ ...value, message: '' })),
      UI_TIMING_MS.saveNotice,
    );
    return () => clearTimeout(timer);
  }, [saveNotice]);
  const [grid, setGrid] = useState(true);
  const [selected, setSelected] = useState<Item | null | undefined>(undefined);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [copyItem, setCopyItem] = useState<Item | null>(null);
  const [collectionDialog, setCollectionDialog] = useState(false);
  const [settings, setSettings] = useState(false);
  const [managing, setManaging] = useState(false);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const selection = useBulkActions({
    items: catalogue.items,
    spaceId: catalogue.spaceId,
    onChanged: refresh,
  });
  const open = (item?: Item) => setSelected(item || null);
  function changeSpace(id: string) {
    changeCatalogueSpace(id);
    selection.clear();
  }
  return (
    <div className={'app'}>
      <Sidebar
        spaceName={activeSpace?.name || 'Моё пространство'}
        canEdit={canEdit}
        collections={collections}
        collection={collection}
        setCollection={setCollection}
        addCollection={() => setCollectionDialog(true)}
      />
      <main className={canEdit && selection.selectedIds.length ? 'has-bulk-selection' : undefined}>
        <LibraryHeader
          data={catalogue}
          changeSpace={changeSpace}
          onAdd={() => open()}
          onSettings={() => setSettings(true)}
          onMembers={() => setManaging(true)}
          onCreateSpace={() => setCreatingSpace(true)}
        />
        {spaceSwitchNotice && (
          <div className={'space-switch-notice'} role={'status'}>
            <span className={'space-color-dot'} aria-hidden={'true'} />
            <span>{spaceSwitchNotice}</span>
            <Button
              type={'button'}
              aria-label={COPY.space.dismissSwitch}
              onClick={dismissSpaceSwitch}
            >
              ×
            </Button>
          </div>
        )}
        <InvitePanel
          onJoined={id => {
            void loadSpaces();
            changeSpace(id);
          }}
        />
        <LibraryHeading data={catalogue} />
        <LibraryFilters
          data={catalogue}
          grid={grid}
          onToggleGrid={() => setGrid(value => !value)}
          onCreateCollection={() => setCollectionDialog(true)}
        />
        {catalogue.error && (
          <div role={'alert'} className={'error'}>
            {catalogue.error}
            <Button onClick={refresh}>Повторить</Button>
          </div>
        )}
        {canEdit && (
          <BulkActionsBar
            selection={selection}
            items={catalogue.items}
            collections={collections}
            statuses={statuses}
          />
        )}
        <LibraryResults
          data={catalogue}
          grid={grid}
          selection={selection}
          onAdd={() => open()}
          onOpen={open}
          onTag={catalogue.setTag}
          onCopy={setCopyItem}
          onDelete={setDeletingItem}
          onCopyLink={url => {
            void copyText(url).then(copied =>
              setSaveNotice(value => ({
                message: copied ? COPY.itemActions.linkCopied : COPY.itemActions.copyLinkFailed,
                version: value.version + 1,
              })),
            );
          }}
        />
      </main>
      {saveNotice.message && (
        <>
          <div className={'save-notice-backdrop'} aria-hidden={'true'} />
          <div key={saveNotice.version} className={'save-notice'} role={'status'}>
            <BrandMark />
            <span>{saveNotice.message}</span>
            <Button
              aria-label={'Скрыть уведомление'}
              onClick={() => setSaveNotice(value => ({ ...value, message: '' }))}
            >
              ×
            </Button>
          </div>
        </>
      )}
      {managing && activeSpace && (
        <SpacePanel
          space={activeSpace}
          onClose={() => setManaging(false)}
          onChanged={() => void loadSpaces()}
        />
      )}
      {settings && activeSpace && (
        <SpaceSettingsDialog
          key={activeSpace.id}
          space={activeSpace}
          collections={collections}
          statuses={statuses}
          onCollectionDeleted={id => {
            if (collection === id) {
              setCollection('');
              selection.clear();
            }
            refresh();
          }}
          onSpaceRenamed={name => updateSpaceName(activeSpace.id, name)}
          onSpaceDeleted={async () => {
            setSettings(false);
            selection.clear();
            removeSpaceLocally(activeSpace.id);
            await loadSpaces();
          }}
          onClose={() => setSettings(false)}
          onChanged={refresh}
          onThemeChanged={(theme, background) =>
            updateSpaceTheme(activeSpace.id, theme, background)
          }
        />
      )}
      {creatingSpace && (
        <ActionDialog
          title={'Новое пространство'}
          label={'Название'}
          submit={COPY.actions.save}
          onClose={() => setCreatingSpace(false)}
          onSubmit={async name => {
            const space = await catalogueApi.createSpace(name);
            await loadSpaces();
            changeSpace(space.id);
          }}
        />
      )}
      {collectionDialog && (
        <CollectionDialog
          spaceId={activeSpace?.id}
          statuses={statuses}
          onClose={() => setCollectionDialog(false)}
          onSaved={() => {
            setCollectionDialog(false);
            refresh();
          }}
        />
      )}
      {selected !== undefined && (
        <ItemDialog
          key={selected?.id || 'new'}
          item={selected}
          spaceId={activeSpace?.id}
          statuses={statuses}
          collections={collections}
          telegramEnabled={telegramEnabled}
          onClose={() => setSelected(undefined)}
          onSaved={result => {
            if (result !== 'deleted') {
              setSaveNotice(value => ({
                message: selected ? 'Изменения сохранены' : 'Находка в вашей коллекции',
                version: value.version + 1,
              }));
            }
            setSelected(undefined);
            refresh();
          }}
          onCopy={item => {
            setSelected(undefined);
            setCopyItem(item);
            refresh();
          }}
        />
      )}
      {deletingItem && (
        <DeleteItemDialog
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onDeleted={() => {
            selection.toggle(deletingItem.id, false);
            setDeletingItem(null);
            refresh();
          }}
        />
      )}
      {copyItem && (
        <CopyItemDialog
          item={copyItem}
          spaces={spaces}
          onClose={() => {
            setCopyItem(null);
            refresh();
          }}
          onOpen={item => {
            changeSpace(item.spaceId || '');
            setQuery('');
            setType('');
            selection.clear();
            setCopyItem(null);
            setSelected(item);
            refresh();
          }}
        />
      )}
    </div>
  );
}
