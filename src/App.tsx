import { useCallback, useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Home } from './components/Home';
import { Modal } from './components/Modal';
import type { WorkspaceDocument, WorkspaceIndexEntry } from './types';
import { createWorkspace } from './lib/workspace';
import { buildChronology } from './lib/chronology';
import { duplicateWorkspace, importWorkspace, loadIndex, loadWorkspace, persistWorkspace, removeWorkspace } from './lib/storage';

export function App() {
  const [entries, setEntries] = useState<WorkspaceIndexEntry[]>([]);
  const [active, setActive] = useState<WorkspaceDocument | null>(null);
  const [activePath, setActivePath] = useState<string>();
  const [error, setError] = useState('');
  const [pendingImport, setPendingImport] = useState<WorkspaceDocument | null>(null);
  const [playChronology, setPlayChronology] = useState(false);
  const [activeSession, setActiveSession] = useState(0);

  const refresh = useCallback(async () => setEntries(await loadIndex()), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const openEntry = async (entry: WorkspaceIndexEntry) => {
    const doc = await loadWorkspace(entry);
    if (doc) { setPlayChronology(false); setActiveSession((value) => value + 1); setActive(doc); setActivePath(entry.filePath); }
    else setError('This workspace could not be loaded. Its recovery file may still be available in the Unfold app data folder.');
  };

  const importFile = async () => {
    try { const doc = await importWorkspace(); if (doc) setPendingImport(doc); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open that file.'); }
  };

  const openImported = async (chronology: boolean) => {
    if (!pendingImport) return;
    try {
      await persistWorkspace(pendingImport);
      setPlayChronology(chronology);
      setActiveSession((value) => value + 1);
      setActivePath(undefined);
      setActive(pendingImport);
      setPendingImport(null);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open that file.'); }
  };

  const importChoice = pendingImport && <Modal title="Open workspace" onClose={() => setPendingImport(null)}><p className="modal-intro">“{pendingImport.name}” · {pendingImport.nodes.length} items. How would you like to open it?</p><div className="import-choice-actions"><button className="button button-primary" onClick={() => void openImported(false)}>Open everything now</button><button className="button button-quiet" onClick={() => void openImported(true)} disabled={!buildChronology(pendingImport).length}>Play chronology <span className="beta-tag">Beta</span></button></div><p className="import-beta-note">Beta: replays additions still present in the file. Deleted items are not shown. Earlier files may have approximate connection timing; edits and movements are not replayed.</p></Modal>;

  useEffect(() => {
    if (active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        const name = prompt('Name your new space');
        if (name?.trim()) { const doc = createWorkspace(name.trim(), ''); void persistWorkspace(doc).then(() => { setPlayChronology(false); setActiveSession((value) => value + 1); setActive(doc); }); }
      } else if (event.ctrlKey && event.key.toLowerCase() === 'o') { event.preventDefault(); void importFile(); }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  if (active) return <><Editor key={`${active.id}-${activeSession}`} initial={active} filePath={activePath} playChronology={playChronology} onWorkspaceChange={setActive} onExit={async () => { setActive(null); setActivePath(undefined); setPlayChronology(false); await refresh(); }} onNew={() => {
    if (!confirm('Start a new workspace? Your current workspace is saved locally.')) return;
    const name = prompt('Name your new space');
    if (name?.trim()) { const doc = createWorkspace(name.trim(), ''); void persistWorkspace(doc).then(() => { setActivePath(undefined); setPlayChronology(false); setActiveSession((value) => value + 1); setActive(doc); }); }
  }} onOpenFile={() => { void importFile(); }} />{importChoice}</>;

  return <>
    <Home entries={entries} onCreate={async (name, objective) => { const doc = createWorkspace(name, objective); await persistWorkspace(doc); setPlayChronology(false); setActiveSession((value) => value + 1); setActive(doc); }} onOpen={openEntry} onImport={importFile}
      onDuplicate={async (entry) => {
        try {
          const doc = await loadWorkspace(entry);
          if (!doc) { setError('This workspace could not be loaded.'); return null; }
          const copy = await duplicateWorkspace(doc);
          await refresh();
          return copy.id;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Could not duplicate this workspace.');
          return null;
        }
      }}
      onDelete={async (entry) => { if (confirm(`Delete “${entry.name}” from Unfold? A desktop recovery file will be retained.`)) { await removeWorkspace(entry.id); await refresh(); } }}
      onRename={async (entry, name) => { const doc = await loadWorkspace(entry); if (doc) { await persistWorkspace({ ...doc, name }); await refresh(); } }} />
    {importChoice}
    {error && <div className="toast"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}
  </>;
}
