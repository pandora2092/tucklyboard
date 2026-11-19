import { useCallback, useEffect, useState } from 'react';

import { COPY, type Item } from '@tuckly/contracts';

import { catalogueApi } from '../api/catalogue';
import { ActionDialog } from '../components/ActionDialog';
import { AppIntro } from '../components/AppIntro';
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
import { MediaUploads } from '../features/catalogue/MediaUploads';
import { useMediaUploads } from '../features/catalogue/useMediaUploads';
import { copyText } from '../lib/clipboard';

import './space-theme.css';
import './album.css';

export function LibraryPage() {
  const catalogue = useCatalogue();
  const [catalogueRendered, setCatalogueRendered] = useState(false);
  const markCatalogueReady = useCallback((ready: boolean) => setCatalogueRendered(ready), []);
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
  const uploads = useMediaUploads(refresh);
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
  const [transferMode, setTransferMode] = useState<'copy' | 'move'>('copy');
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
  const openCopy = (item: Item) => {
    setTransferMode('copy');
    setCopyItem(item);
  };
  const openMove = (item: Item) => {
    setTransferMode('move');
    setCopyItem(item);
  };
  const open = (item?: Item) => setSelected(item || null);
  function changeSpace(id: string) {
    changeCatalogueSpace(id);
    selection.clear();
  }
  return (
    <AppIntro
      ready={
        !catalogue.loading &&
        Boolean(activeSpace || catalogue.error) &&
        (catalogueRendered || Boolean(catalogue.error) || !catalogue.items.length)
      }
    >
      <div className={uploads.jobs.length ? 'app has-media-uploads' : 'app'}>
        <Sidebar
          spaceName={activeSpace?.name || 'Моё пространство'}
          canEdit={canEdit}
          collections={collections}
          collection={collection}
          setCollection={setCollection}
          addCollection={() => setCollectionDialog(true)}
        />
        <main
          className={canEdit && selection.selectedIds.length ? 'has-bulk-selection' : undefined}
        >
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
              spaces={spaces}
              spaceId={activeSpace?.id}
            />
          )}
          <LibraryResults
            onReady={markCatalogueReady}
            data={catalogue}
            grid={grid}
            selection={selection}
            onAdd={() => open()}
            onOpen={open}
            onTag={catalogue.setTag}
            onCopy={openCopy}
            onMove={openMove}
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
        <MediaUploads jobs={uploads.jobs} queue={uploads.queue} />
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
            onMove={item => {
              setSelected(undefined);
              openMove(item);
              refresh();
            }}
            onUpload={(file, details) => {
              uploads.queue.enqueue(file, details, activeSpace?.name || 'Моё пространство');
              setSelected(undefined);
            }}
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
              openCopy(item);
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
            mode={transferMode}
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
    </AppIntro>
  );
}
