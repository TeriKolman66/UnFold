import { useEffect, useRef, useState } from 'react';
import { Columns3, Copy, FileInput, Grid3X3, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import type { WorkspaceIndexEntry } from '../types';
import { Modal } from './Modal';
import { UnfoldMark } from './UnfoldMark';

interface HomeProps {
  entries: WorkspaceIndexEntry[];
  onCreate: (name: string, objective: string) => void;
  onOpen: (entry: WorkspaceIndexEntry) => void;
  onImport: () => void;
  onDuplicate: (entry: WorkspaceIndexEntry) => Promise<string | null>;
  onDelete: (entry: WorkspaceIndexEntry) => void;
  onRename: (entry: WorkspaceIndexEntry, name: string) => void;
}

const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export function Home({ entries, onCreate, onOpen, onImport, onDuplicate, onDelete, onRename }: HomeProps) {
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [renameEntry, setRenameEntry] = useState<WorkspaceIndexEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [gridColumns, setGridColumns] = useState<3 | 6>(() => localStorage.getItem('unfold:home-columns') === '6' ? 6 : 3);
  const [recentlyDuplicatedId, setRecentlyDuplicatedId] = useState<string | null>(null);
  const homeRef = useRef<HTMLElement>(null);
  const filtered = entries.filter((entry) => `${entry.name} ${entry.objective}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!recentlyDuplicatedId || !entries.some((entry) => entry.id === recentlyDuplicatedId)) return;
    const frame = requestAnimationFrame(() => {
      const card = homeRef.current?.querySelector<HTMLElement>(`[data-workspace-id="${recentlyDuplicatedId}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timer = window.setTimeout(() => setRecentlyDuplicatedId(null), 2400);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [entries, recentlyDuplicatedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (newOpen || renameEntry || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) return;
      const page = homeRef.current;
      if (!page) return;
      const step = event.key === 'PageDown' || event.key === 'PageUp' ? page.clientHeight * .85 : 120;
      if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); page.scrollBy({ top: step }); }
      else if (event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); page.scrollBy({ top: -step }); }
      else if (event.key === 'End') { event.preventDefault(); page.scrollTo({ top: page.scrollHeight }); }
      else if (event.key === 'Home') { event.preventDefault(); page.scrollTo({ top: 0 }); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [newOpen, renameEntry]);

  const changeGridColumns = (columns: 3 | 6) => {
    setGridColumns(columns);
    localStorage.setItem('unfold:home-columns', String(columns));
  };

  const duplicate = async (entry: WorkspaceIndexEntry) => {
    setMenu(null);
    setQuery('');
    const copyId = await onDuplicate(entry);
    if (copyId) setRecentlyDuplicatedId(copyId);
  };

  const create = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), '');
    setName(''); setNewOpen(false);
  };

  return <main className="home-shell" ref={homeRef}>
    <header className="home-header">
      <div className="brand"><UnfoldMark className="brand-mark" /><span>UNFOLD</span></div>
      <button className="button button-primary" onClick={() => setNewOpen(true)}><Plus size={17} /> New space</button>
    </header>
    <section className="home-content">
      <div className="home-heading"><p className="eyebrow">Your visual space</p><h1>Put everything in one place.</h1><p>Add notes, photos, and files. Arrange and connect them your way.</p></div>
      {entries.length > 0 && <div className="workspace-tools">
        <label className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a workspace" /></label>
        <div className="workspace-tool-actions">
          <div className="workspace-layout-switch" role="group" aria-label="Workspace layout">
            <button className={gridColumns === 3 ? 'active' : ''} onClick={() => changeGridColumns(3)} aria-label="Show three workspaces per row" aria-pressed={gridColumns === 3} title="Three per row"><Columns3 size={16} /><span>3</span></button>
            <button className={gridColumns === 6 ? 'active' : ''} onClick={() => changeGridColumns(6)} aria-label="Show six workspaces per row" aria-pressed={gridColumns === 6} title="Six per row"><Grid3X3 size={16} /><span>6</span></button>
          </div>
          <button className="button button-quiet" onClick={onImport}><FileInput size={16} /> Open file</button>
        </div>
      </div>}
      {filtered.length ? <div className={`workspace-grid columns-${gridColumns}`}>
        {filtered.map((entry) => {
          return <article className={`workspace-card ${recentlyDuplicatedId === entry.id ? 'just-duplicated' : ''}`} data-workspace-id={entry.id} key={entry.id} onDoubleClick={() => onOpen(entry)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(entry)}>
            <div className="card-top"><UnfoldMark monochrome className="workspace-mark" /><div className="card-menu-wrap">
              <button className="icon-button" aria-label="Workspace actions" onClick={() => setMenu(menu === entry.id ? null : entry.id)}><MoreHorizontal size={19} /></button>
              {menu === entry.id && <div className="card-menu">
                <button onClick={() => { setRenameEntry(entry); setRenameValue(entry.name); setMenu(null); }}>Rename</button>
                <button onClick={() => void duplicate(entry)}><Copy size={14} /> Duplicate</button>
                <button className="danger" onClick={() => { onDelete(entry); setMenu(null); }}><Trash2 size={14} /> Delete</button>
              </div>}
            </div></div>
            <button className="card-main" onClick={() => onOpen(entry)}>
              <h2>{entry.name}</h2><p>{entry.objective || 'Notes, photos, and files'}</p>
            </button>
            <footer><span>{formatDate(entry.updatedAt)}</span></footer>
          </article>;
        })}
      </div> : <div className="empty-state">
        <UnfoldMark className="empty-mark" />
        <h2>{entries.length ? 'No spaces found' : 'Create an empty space'}</h2>
        <p>{entries.length ? 'Try a different search.' : 'Add notes and files, then connect what belongs together.'}</p>
        {!entries.length && <div className="empty-actions"><button className="button button-primary" onClick={() => setNewOpen(true)}><Plus size={17} /> Create workspace</button><button className="button button-quiet" onClick={onImport}>Open .unfold file</button></div>}
      </div>}
    </section>
    <footer className="home-footer"><span>Project by Teri Kolman 66</span></footer>

    {newOpen && <Modal title="Create a new space" onClose={() => setNewOpen(false)}>
      <div className="form-stack"><label>Space name <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} placeholder="Project, moodboard, research…" /></label>
        <div className="modal-actions"><button className="button button-quiet" onClick={() => setNewOpen(false)}>Cancel</button><button className="button button-primary" disabled={!name.trim()} onClick={create}>Create space</button></div>
      </div>
    </Modal>}
    {renameEntry && <Modal title="Rename workspace" onClose={() => setRenameEntry(null)}><div className="form-stack"><label>Name <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && renameValue.trim() && (onRename(renameEntry, renameValue), setRenameEntry(null))} /></label><div className="modal-actions"><button className="button button-quiet" onClick={() => setRenameEntry(null)}>Cancel</button><button className="button button-primary" disabled={!renameValue.trim()} onClick={() => { onRename(renameEntry, renameValue); setRenameEntry(null); }}>Rename</button></div></div></Modal>}
  </main>;
}
