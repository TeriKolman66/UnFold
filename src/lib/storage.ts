import { BaseDirectory, exists, mkdir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { WorkspaceDocument, WorkspaceIndexEntry } from '../types';
import { getProgress, isWorkspaceDocument, now, uid } from './workspace';

const INDEX_KEY = 'unfold:index:v1';
const DOC_PREFIX = 'unfold:workspace:';
const browserDatabaseName = 'unfold-browser-v1';
const browserDocumentStore = 'documents';
const appFolder = 'Unfold';
const workspaceFolder = `${appFolder}/workspaces`;

export const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function entryFrom(doc: WorkspaceDocument, filePath?: string): WorkspaceIndexEntry {
  const progress = getProgress(doc.nodes);
  return { id: doc.id, name: doc.name, objective: doc.objective, updatedAt: doc.updatedAt, filePath, total: progress.total, completed: progress.completed, snapshot: doc };
}

function readBrowserIndex(): WorkspaceIndexEntry[] {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as WorkspaceIndexEntry[]; }
  catch { return []; }
}

function writeBrowserIndex(entries: WorkspaceIndexEntry[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

function openBrowserDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(browserDatabaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(browserDocumentStore);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeBrowserDocument(doc: WorkspaceDocument) {
  if (!('indexedDB' in window)) { localStorage.setItem(DOC_PREFIX + doc.id, JSON.stringify(doc)); return; }
  const database = await openBrowserDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(browserDocumentStore, 'readwrite');
      transaction.objectStore(browserDocumentStore).put(doc, doc.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    localStorage.removeItem(DOC_PREFIX + doc.id);
  } finally { database.close(); }
}

async function readBrowserDocument(id: string): Promise<WorkspaceDocument | null> {
  if (!('indexedDB' in window)) return null;
  const database = await openBrowserDatabase();
  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction(browserDocumentStore, 'readonly').objectStore(browserDocumentStore).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return isWorkspaceDocument(result) ? result : null;
  } finally { database.close(); }
}

async function removeBrowserDocument(id: string) {
  if (!('indexedDB' in window)) return;
  const database = await openBrowserDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(browserDocumentStore, 'readwrite');
      transaction.objectStore(browserDocumentStore).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

async function ensureDesktopFolders() {
  if (!(await exists(workspaceFolder, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(workspaceFolder, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

async function atomicAppDataWrite(path: string, content: string) {
  await ensureDesktopFolders();
  const temp = `${path}.tmp`;
  await writeTextFile(temp, content, { baseDir: BaseDirectory.AppData });
  if (await exists(path, { baseDir: BaseDirectory.AppData })) {
    const backup = `${path}.backup`;
    if (await exists(backup, { baseDir: BaseDirectory.AppData })) await remove(backup, { baseDir: BaseDirectory.AppData });
    await rename(path, backup, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  }
  await rename(temp, path, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
}

export async function loadIndex(): Promise<WorkspaceIndexEntry[]> {
  const fallback = readBrowserIndex();
  if (!isDesktop()) return fallback;
  try {
    const path = `${appFolder}/index.json`;
    if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return fallback;
    return JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppData })) as WorkspaceIndexEntry[];
  } catch { return fallback; }
}

async function saveIndex(entries: WorkspaceIndexEntry[]) {
  const lean = entries.map(({ snapshot: _snapshot, ...entry }) => entry);
  if (!isDesktop()) writeBrowserIndex(lean);
  else {
    await atomicAppDataWrite(`${appFolder}/index.json`, JSON.stringify(lean, null, 2));
  }
}

export async function persistWorkspace(doc: WorkspaceDocument, filePath?: string): Promise<WorkspaceIndexEntry> {
  const updated = { ...doc, updatedAt: now() };
  if (isDesktop()) await atomicAppDataWrite(`${workspaceFolder}/${updated.id}.unfold`, JSON.stringify(updated, null, 2));
  else await writeBrowserDocument(updated);
  const entries = await loadIndex();
  const prior = entries.find((item) => item.id === updated.id);
  const entry = entryFrom(updated, filePath ?? prior?.filePath);
  await saveIndex([entry, ...entries.filter((item) => item.id !== updated.id)]);
  return entry;
}

export async function loadWorkspace(entry: WorkspaceIndexEntry): Promise<WorkspaceDocument | null> {
  if (entry.snapshot && isWorkspaceDocument(entry.snapshot)) return entry.snapshot;
  if (isDesktop()) {
    try {
      const text = await readTextFile(`${workspaceFolder}/${entry.id}.unfold`, { baseDir: BaseDirectory.AppData });
      const parsed: unknown = JSON.parse(text);
      if (isWorkspaceDocument(parsed)) return parsed;
    } catch { /* fall through to local snapshot */ }
  }
  try {
    const browserDocument = await readBrowserDocument(entry.id);
    if (browserDocument) return browserDocument;
  } catch { /* fall through to an older browser save */ }
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DOC_PREFIX + entry.id) ?? 'null');
    return isWorkspaceDocument(parsed) ? parsed : null;
  } catch { return null; }
}

export async function removeWorkspace(id: string) {
  if (!isDesktop()) await removeBrowserDocument(id);
  localStorage.removeItem(DOC_PREFIX + id);
  const entries = (await loadIndex()).filter((item) => item.id !== id);
  await saveIndex(entries);
  // Desktop autosave is deliberately retained as a recovery file.
}

export async function duplicateWorkspace(doc: WorkspaceDocument) {
  const timestamp = now();
  const idMap = new Map(doc.nodes.map((node) => [node.id, uid()]));
  const copy: WorkspaceDocument = {
    ...doc, id: uid(), name: `${doc.name} — Copy`, createdAt: timestamp, updatedAt: timestamp,
    nodes: doc.nodes.map((node) => ({ ...node, id: idMap.get(node.id)!, parentId: node.parentId ? idMap.get(node.parentId)! : null, createdAt: timestamp, updatedAt: timestamp })),
    connections: (doc.connections ?? []).map((connection) => ({
      ...connection,
      id: uid(),
      source: idMap.get(connection.source)!,
      target: idMap.get(connection.target)!,
    })),
  };
  await persistWorkspace(copy);
  return copy;
}

export async function saveWorkspaceAs(doc: WorkspaceDocument): Promise<string | null> {
  const content = JSON.stringify(doc, null, 2);
  if (isDesktop()) {
    const path = await save({ title: 'Save Unfold workspace', defaultPath: `${doc.name.replace(/[<>:"/\\|?*]/g, '-')}.unfold`, filters: [{ name: 'Unfold workspace', extensions: ['unfold'] }] });
    if (!path) return null;
    await writeTextFile(path, content);
    await persistWorkspace(doc, path);
    return path;
  }
  download(content, `${doc.name}.unfold`, 'application/json');
  await persistWorkspace(doc);
  return 'download';
}

export async function saveToKnownPath(doc: WorkspaceDocument, path?: string) {
  if (isDesktop() && path) await writeTextFile(path, JSON.stringify(doc, null, 2));
  await persistWorkspace(doc, path);
}

export async function importWorkspace(): Promise<WorkspaceDocument | null> {
  let text: string | null = null;
  if (isDesktop()) {
    const path = await open({ title: 'Open Unfold workspace', multiple: false, filters: [{ name: 'Unfold workspace', extensions: ['unfold', 'json'] }] });
    if (!path || Array.isArray(path)) return null;
    text = await readTextFile(path);
  } else {
    text = await new Promise<string | null>((resolve) => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.unfold,.json';
      input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
      input.click();
    });
  }
  if (!text) return null;
  const parsed: unknown = JSON.parse(text);
  if (!isWorkspaceDocument(parsed)) throw new Error('This file is not a valid Unfold workspace.');
  return parsed;
}

export function download(content: string, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
