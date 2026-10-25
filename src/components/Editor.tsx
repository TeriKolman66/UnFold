import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, getViewportForBounds, useNodesState, type Connection, type EdgeMouseHandler, type NodeMouseHandler, type OnNodeDrag, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import { ArrowLeft, ExternalLink, File as FileIcon, FileUp, ImagePlus, Keyboard, LayoutTemplate, MapPin, Pause, Pin, PinOff, Play, Save, SkipForward, StickyNote, Trash2, X } from 'lucide-react';
import type { ConnectionKind, EmbeddedAttachment, LocationDetails, NodeKind, ThoughtNode, WorkspaceDocument } from '../types';
import { connectionKind, validateConnection } from '../lib/connections';
import { now, uid } from '../lib/workspace';
import { layoutThoughtTree, nodeHeight } from '../lib/layout';
import { saveToKnownPath, saveWorkspaceAs } from '../lib/storage';
import { embeddedMapUrl, findPlaceCoordinates, googleMapsUrl, parseCoordinates, parseLocationInput } from '../lib/location';
import { embedPlacePhoto, searchPlacePhotos, type PlacePhoto } from '../lib/placePhotos';
import { buildChronology } from '../lib/chronology';
import { Modal } from './Modal';
import { ThoughtNodeCard, type ThoughtFlowNode } from './ThoughtNodeCard';
import { ConnectionEdge, type ConnectionFlowEdge } from './ConnectionEdge';

const nodeTypes = { thought: ThoughtNodeCard };
const edgeTypes = { connection: ConnectionEdge };
const shortPhotoName = (name: string) => name.length > 34 ? `${name.slice(0, 31)}…` : name;
const clueColors = ['#7f8c8d', '#d65a5a', '#d88b3d', '#c7ad4f', '#5d9b68', '#4f8fc7', '#7667c7', '#a65da1'];
const placementSlots: Array<readonly [number, number]> = [[0, 0]];
for (let radius = 1; radius <= 12; radius += 1) {
  placementSlots.push([radius, 0], [-radius, 0], [0, radius], [0, -radius]);
  for (let row = -radius; row <= radius; row += 1) {
    for (let column = -radius; column <= radius; column += 1) {
      const isCardinal = (row === 0 && Math.abs(column) === radius) || (column === 0 && Math.abs(row) === radius);
      if (!isCardinal && Math.max(Math.abs(column), Math.abs(row)) === radius) placementSlots.push([column, row]);
    }
  }
}
interface EditorProps {
  initial: WorkspaceDocument;
  filePath?: string;
  onExit: () => void;
  onOpenFile: () => void;
  onNew: () => void;
  onWorkspaceChange: (workspace: WorkspaceDocument) => void;
  playChronology?: boolean;
}

export function Editor({ initial, filePath: initialPath, onExit, onOpenFile, onNew, onWorkspaceChange, playChronology = false }: EditorProps) {
  const [workspace, setWorkspace] = useState(initial);
  const [chronology] = useState(() => buildChronology(initial));
  const [playbackActive, setPlaybackActive] = useState(playChronology && chronology.length > 0);
  const [playbackPlaying, setPlaybackPlaying] = useState(playChronology && chronology.length > 0);
  const [playbackStep, setPlaybackStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelPinned, setPanelPinned] = useState(() => localStorage.getItem('unfold:panel-pinned') !== 'false');
  const [panelOpen, setPanelOpen] = useState(false);
  const [instance, setInstance] = useState<ReactFlowInstance<ThoughtFlowNode, ConnectionFlowEdge> | null>(null);
  const [filePath, setFilePath] = useState(initialPath);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [confirmDelete, setConfirmDelete] = useState<ThoughtNode | null>(null);
  const [confirmPhotoDelete, setConfirmPhotoDelete] = useState<{ nodeId: string; index: number; name: string } | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<ConnectionKind>('parent');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [lastColor, setLastColor] = useState(() => localStorage.getItem('unfold:last-clue-color') ?? clueColors[0]);
  const [toast, setToast] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [mapOpenId, setMapOpenId] = useState<string | null>(null);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [photoSearchNodeId, setPhotoSearchNodeId] = useState<string | null>(null);
  const [photoResults, setPhotoResults] = useState<PlacePhoto[]>([]);
  const [photoSearchState, setPhotoSearchState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [importingPhotoUrl, setImportingPhotoUrl] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const firstRender = useRef(true);
  const replayWasActive = useRef(playChronology);
  const previousNodeCount = useRef(initial.nodes.length);
  const selected = workspace.nodes.find((node) => node.id === selectedId) ?? null;
  const editing = workspace.nodes.find((node) => node.id === editingId) ?? null;
  const panelVisible = panelPinned || panelOpen;
  const revealedEvents = useMemo(() => chronology.slice(0, playbackStep), [chronology, playbackStep]);
  const revealedNodes = useMemo(() => new Set(revealedEvents.filter((event) => event.kind === 'node').map((event) => event.id)), [revealedEvents]);
  const revealedConnections = useMemo(() => new Set(revealedEvents.filter((event) => event.kind === 'connection').map((event) => event.id)), [revealedEvents]);
  const revealedPhotos = useMemo(() => new Set(revealedEvents.filter((event) => event.kind === 'photo').map((event) => event.id)), [revealedEvents]);
  const displayNodes = useMemo(() => !playbackActive ? workspace.nodes : workspace.nodes.filter((node) => revealedNodes.has(node.id)).map((node) => node.kind === 'location' && node.location ? { ...node, location: { ...node.location, photos: node.location.photos.filter((_, index) => revealedPhotos.has(`${node.id}:photo:${index}`)) } } : node), [playbackActive, revealedNodes, revealedPhotos, workspace.nodes]);

  useEffect(() => {
    if (!playbackActive || !playbackPlaying || playbackStep >= chronology.length) return;
    const timer = window.setTimeout(() => setPlaybackStep((step) => Math.min(chronology.length, step + 1)), 650);
    return () => window.clearTimeout(timer);
  }, [chronology.length, playbackActive, playbackPlaying, playbackStep]);

  useEffect(() => { if (playbackStep >= chronology.length) setPlaybackPlaying(false); }, [chronology.length, playbackStep]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    localStorage.setItem('unfold:panel-pinned', String(panelPinned));
  }, [panelPinned]);

  useEffect(() => {
    onWorkspaceChange(workspace);
  }, [onWorkspaceChange, workspace]);

  const toggleCollapse = useCallback((id: string) => {
    setWorkspace((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, collapsed: !node.collapsed, updatedAt: now() } : node) }));
  }, []);
  const locatePlace = useCallback(async (id: string, storedQuery: string, searchQuery = storedQuery) => {
    if (!searchQuery.trim() || /^https?:\/\//i.test(searchQuery)) { setToast('Enter a place name to find the map'); return; }
    setLocatingId(id);
    try {
      const coordinates = parseCoordinates(searchQuery) ?? await findPlaceCoordinates(searchQuery);
      if (coordinates) {
        setWorkspace((current) => ({ ...current, updatedAt: now(), nodes: current.nodes.map((node) => node.id === id && node.location?.query === storedQuery
          ? { ...node, updatedAt: now(), location: { ...node.location, query: /^https?:\/\//i.test(storedQuery) ? searchQuery : storedQuery, sourceUrl: node.location.sourceUrl || parseLocationInput(storedQuery).sourceUrl, ...coordinates } } : node) }));
        setToast('Place found on map');
      } else setToast('Place not found; try a more specific address');
    } catch { setToast('Map lookup unavailable; location saved'); }
    finally { setLocatingId((current) => current === id ? null : current); }
  }, []);
  const flow = useMemo(() => layoutThoughtTree(displayNodes, toggleCollapse), [displayNodes, toggleCollapse]);
  const flowNodes = useMemo(() => flow.nodes.map((node) => ({ ...node, data: { ...node.data, findingMap: locatingId === node.id, onOpenMap: (id: string) => setMapOpenId(id), onDeletePhoto: playbackActive ? undefined : (id: string, index: number) => {
    const name = workspace.nodes.find((item) => item.id === id)?.location?.photos[index]?.name;
    if (name) setConfirmPhotoDelete({ nodeId: id, index, name });
  }, onFindMap: (id: string) => {
    const location = workspace.nodes.find((item) => item.id === id);
    if (!location?.location) return;
    const storedQuery = location.location.query;
    setToast('Finding map…');
    void locatePlace(id, storedQuery, /^https?:\/\//i.test(storedQuery) ? location.question : storedQuery);
  } }, selected: node.id === selectedId, className: node.id === linkSourceId ? 'link-source' : undefined })), [flow.nodes, linkSourceId, locatePlace, locatingId, playbackActive, selectedId, workspace.nodes]);
  const [renderNodes, setRenderNodes, onNodesChange] = useNodesState<ThoughtFlowNode>(flowNodes);

  useEffect(() => {
    setRenderNodes(flowNodes);
  }, [flowNodes, setRenderNodes]);

  const updateNode = useCallback((id: string, patch: Partial<ThoughtNode>) => {
    setWorkspace((current) => {
      const nodes = current.nodes.map((node) => node.id === id ? { ...node, ...patch, updatedAt: now() } : node);
      const changed = nodes.find((node) => node.id === id);
      return { ...current, objective: changed?.kind === 'root' ? changed.question : current.objective, nodes, updatedAt: now() };
    });
  }, []);

  const addItem = useCallback((question = '', kind: Exclude<NodeKind, 'root'> = 'note', attachment?: EmbeddedAttachment, placementOffset = 0, location?: LocationDetails) => {
    const timestamp = now();
    const fallback = kind === 'note' ? 'New note' : kind === 'image' ? 'Image' : kind === 'file' ? 'File' : 'Item';
    const canvas = document.querySelector<HTMLElement>('.canvas-wrap')?.getBoundingClientRect();
    const usableWidth = Math.max(320, (canvas?.width ?? window.innerWidth) - (panelVisible ? 378 : 0));
    const screenCenter = { x: (canvas?.left ?? 0) + usableWidth / 2, y: (canvas?.top ?? 0) + (canvas?.height ?? window.innerHeight) / 2 };
    const center = instance?.screenToFlowPosition(screenCenter) ?? { x: 263, y: 186 };
    const occupied = flow.nodes.map((item) => ({ x: item.position.x, y: item.position.y, width: 286, height: nodeHeight(item.data.thought) }));
    const orderedSlots = [...placementSlots.slice(placementOffset), ...placementSlots.slice(0, placementOffset)];
    const itemHeight = kind === 'image' || kind === 'location' ? 318 : 154;
    let position = { x: center.x - 143, y: center.y - itemHeight / 2 };
    for (const [column, row] of orderedSlots) {
      const candidate = { x: center.x - 143 + column * 326, y: center.y - 77 + row * 230 };
      const overlaps = occupied.some((item) => candidate.x < item.x + item.width + 24 && candidate.x + 286 + 24 > item.x && candidate.y < item.y + item.height + 24 && candidate.y + 154 + 24 > item.y);
      if (!overlaps) { position = candidate; break; }
    }
    const node: ThoughtNode = { id: uid(), parentId: null, kind, question: question || fallback, answer: '', attachment, location, completed: false, collapsed: false, position, createdAt: timestamp, updatedAt: timestamp };
    const positions = new Map(flow.nodes.map((item) => [item.id, item.position]));
    setWorkspace((current) => ({ ...current, updatedAt: timestamp, nodes: [...current.nodes.map((item) => ({ ...item, position: positions.get(item.id) ?? item.position })), node] }));
    setSelectedId(node.id);
    return node.id;
  }, [flow.nodes, instance, panelVisible]);

  const addNote = useCallback(() => {
    addItem('New note', 'note');
  }, [addItem]);

  const createLocation = () => {
    const name = locationName.trim();
    if (!name) return;
    if (/^https?:\/\//i.test(name)) {
      setToast('Enter a place name or address, not a link');
      return;
    }
    const coordinates = parseCoordinates(name);
    const id = addItem(name, 'location', undefined, 0, { query: name, ...(coordinates ?? {}), photos: [] });
    if (!coordinates) void locatePlace(id, name);
    setLocationName(''); setLocationOpen(false);
  };

  const updateLocation = (node: ThoughtNode, patch: Partial<LocationDetails>) => {
    updateNode(node.id, { location: { query: '', photos: [], ...node.location, ...patch } });
  };

  const deleteLocationPhoto = () => {
    if (!confirmPhotoDelete) return;
    const { nodeId, index } = confirmPhotoDelete;
    setWorkspace((current) => ({ ...current, updatedAt: now(), nodes: current.nodes.map((node) => node.id === nodeId && node.location
      ? { ...node, updatedAt: now(), location: { ...node.location, photos: node.location.photos.filter((_, photoIndex) => photoIndex !== index) } } : node) }));
    setConfirmPhotoDelete(null);
    setToast('Photo removed');
  };

  const addLocationPhotos = (node: ThoughtNode) => {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.avif,.tif,.tiff';
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      const photos = await Promise.all(files.map(async (file) => ({
        name: file.name, mimeType: file.type || 'image/*', size: file.size, createdAt: now(),
        dataUrl: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }),
      })));
      setWorkspace((current) => ({ ...current, updatedAt: now(), nodes: current.nodes.map((item) => item.id === node.id ? { ...item, updatedAt: now(), location: { query: item.location?.query ?? '', ...item.location, photos: [...(item.location?.photos ?? []), ...photos] } } : item) }));
      if (photos.length) setToast(`${photos.length} photo${photos.length === 1 ? '' : 's'} added`);
    };
    input.click();
  };

  const openPhotoSearch = async (node: ThoughtNode) => {
    setPhotoSearchNodeId(node.id);
    setPhotoResults([]);
    setPhotoSearchState('loading');
    try {
      const latitude = node.location?.latitude;
      const longitude = node.location?.longitude;
      const coordinates = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
      setPhotoResults(await searchPlacePhotos(node.question, coordinates));
      setPhotoSearchState('ready');
    } catch { setPhotoSearchState('error'); }
  };

  const addFoundPhoto = async (nodeId: string, photo: PlacePhoto) => {
    setImportingPhotoUrl(photo.sourceUrl);
    try {
      const attachment = await embedPlacePhoto(photo);
      setWorkspace((current) => ({ ...current, updatedAt: now(), nodes: current.nodes.map((node) => node.id === nodeId && node.location && !node.location.photos.some((item) => item.sourceUrl === photo.sourceUrl)
        ? { ...node, updatedAt: now(), location: { ...node.location, photos: [...node.location.photos, attachment] } } : node) }));
      setToast('Photo added to this location');
    } catch { setToast('Could not download photo; try another'); }
    finally { setImportingPhotoUrl(null); }
  };

  const addAttachments = useCallback((kind: 'image' | 'file') => {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = kind === 'image' ? 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.avif,.tif,.tiff' : '*/*';
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      if (!files.length) return;
      for (const [index, file] of files.entries()) {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
        addItem(file.name, kind, { name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataUrl }, index);
      }
      setToast(files.length === 1 ? `${files[0].name} added` : `${files.length} files added`);
    };
    input.click();
  }, [addItem]);

  const onNodeDragStop: OnNodeDrag<ThoughtFlowNode> = (_event, draggedNode) => {
    setWorkspace((current) => ({
      ...current,
      updatedAt: now(),
      nodes: current.nodes.map((node) => node.id === draggedNode.id ? { ...node, position: draggedNode.position, updatedAt: now() } : node),
    }));
  };

  const connectNodes = useCallback((source: string, target: string, kind: ConnectionKind = 'relation') => {
    const error = validateConnection(workspace.connections ?? [], source, target, kind);
    if (error) { setToast(error); return false; }
    setWorkspace((current) => ({ ...current, updatedAt: now(), connections: [...(current.connections ?? []), { id: uid(), source, target, kind, createdAt: now() }] }));
    setToast(kind === 'parent' ? 'Parent connection created' : 'Relationship created');
    return true;
  }, [workspace.connections]);

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) connectNodes(connection.source, connection.target, 'parent');
  }, [connectNodes]);

  const disconnect = useCallback((id: string) => {
    setWorkspace((current) => ({ ...current, updatedAt: now(), connections: (current.connections ?? []).filter((edge) => edge.id !== id) }));
    setSelectedConnectionId(null);
    setToast('Connection removed');
  }, []);

  const fitAll = useCallback(() => {
    if (!instance || !flowNodes.length) return;
    const canvas = document.querySelector<HTMLElement>('.canvas-wrap')?.getBoundingClientRect();
    if (!canvas) return;
    const availableWidth = Math.max(320, canvas.width - (panelVisible && !playbackActive ? 378 : 0));
    const bounds = instance.getNodesBounds(flowNodes);
    const viewport = getViewportForBounds(bounds, availableWidth, canvas.height, 0.18, 1.35, 0.16);
    void instance.setViewport(viewport, { duration: 200 });
  }, [flowNodes, instance, panelVisible, playbackActive]);

  useEffect(() => {
    if (!playbackActive || !playbackStep) return;
    const timer = window.setTimeout(fitAll, 40);
    return () => window.clearTimeout(timer);
  }, [fitAll, playbackActive, playbackStep]);

  useEffect(() => {
    if (playbackActive || !replayWasActive.current) return;
    replayWasActive.current = false;
    const timer = window.setTimeout(fitAll, 50);
    return () => window.clearTimeout(timer);
  }, [fitAll, playbackActive]);

  const applyColor = useCallback((nodeId: string, color: string) => {
    setLastColor(color);
    localStorage.setItem('unfold:last-clue-color', color);
    updateNode(nodeId, { color });
  }, [updateNode]);

  useEffect(() => {
    const prior = previousNodeCount.current;
    previousNodeCount.current = workspace.nodes.length;
    if (workspace.nodes.length <= prior) return;
    const timer = setTimeout(fitAll, 80);
    return () => clearTimeout(timer);
  }, [fitAll, workspace.nodes.length]);

  const deleteNode = useCallback((node: ThoughtNode) => {
    setWorkspace((current) => ({ ...current, updatedAt: now(), nodes: current.nodes.filter((item) => item.id !== node.id), connections: (current.connections ?? []).filter((edge) => edge.source !== node.id && edge.target !== node.id) }));
    setSelectedId(null);
    setSelectedConnectionId(null);
    setEditingId((current) => current === node.id ? null : current);
    setConfirmDelete(null);
  }, []);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try { await saveToKnownPath(workspace, filePath); setSaveState('saved'); }
      catch { setSaveState('error'); }
    }, 550);
    return () => clearTimeout(timer);
  }, [workspace, filePath]);

  const saveNow = useCallback(async (as = false) => {
    try {
      setSaveState('saving');
      if (as || !filePath) {
        const path = await saveWorkspaceAs(workspace);
        if (path && path !== 'download') setFilePath(path);
      } else await saveToKnownPath(workspace, filePath);
      setSaveState('saved'); setToast(as ? 'Workspace exported' : 'Workspace saved');
    } catch { setSaveState('error'); setToast('Could not save the workspace'); }
  }, [filePath, workspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) { if (event.key === 'Escape') (target as HTMLInputElement).blur(); return; }
      if (playbackActive) {
        if (event.key === 'Escape') { event.preventDefault(); setPlaybackActive(false); setPlaybackPlaying(false); }
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); void saveNow(event.shiftKey); }
      else if (event.ctrlKey && event.key.toLowerCase() === 'n') { event.preventDefault(); onNew(); }
      else if (event.ctrlKey && event.key.toLowerCase() === 'o') { event.preventDefault(); onOpenFile(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); void instance?.zoomIn({ duration: 180 }); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); void instance?.zoomOut({ duration: 180 }); }
      else if (event.key.toLowerCase() === 'c' && selected) { event.preventDefault(); updateNode(selected.id, { color: lastColor }); setToast('Last color applied'); }
      else if (event.key === 'Backspace' && selectedConnectionId) { event.preventDefault(); disconnect(selectedConnectionId); }
      else if (event.key === 'Backspace' && selected) { event.preventDefault(); deleteNode(selected); }
      else if (event.key === 'Enter' && selected) {
        event.preventDefault();
        setEditingId(selected.id);
        setPanelOpen(true);
        setTimeout(() => document.querySelector<HTMLTextAreaElement>('[data-clue-note]')?.focus(), 0);
      }
      else if (event.code === 'Space' && selected) {
        event.preventDefault();
        const kind = event.shiftKey ? 'relation' : 'parent';
        setLinkSourceId(selected.id);
        setLinkKind(kind);
        setToast(kind === 'parent' ? 'Choose the child clue' : 'Choose another clue to relate');
      }
      else if (event.key === 'Delete' && selectedConnectionId) disconnect(selectedConnectionId);
      else if (event.key === 'Delete' && selected) setConfirmDelete(selected);
      else if (event.key === 'Escape') { setSelectedId(null); setSelectedConnectionId(null); setLinkSourceId(null); setPanelOpen(false); setMapOpenId(null); setLocationOpen(false); setShortcutsOpen(false); }
      else if (event.key.toLowerCase() === 'f') fitAll();
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteNode, disconnect, fitAll, instance, lastColor, onNew, onOpenFile, playbackActive, saveNow, selected, selectedConnectionId, updateNode]);

  const onNodeClick: NodeMouseHandler<ThoughtFlowNode> = (_event, node) => {
    if (linkSourceId && linkSourceId !== node.id) {
      if (connectNodes(linkSourceId, node.id, linkKind)) setLinkSourceId(null);
      setSelectedId(node.id);
      setSelectedConnectionId(null);
      return;
    }
    setSelectedConnectionId(null);
    setSelectedId((current) => current === node.id ? null : node.id);
  };
  const onEdgeClick: EdgeMouseHandler<ConnectionFlowEdge> = (_event, edge) => {
    setSelectedId(null);
    setLinkSourceId(null);
    setSelectedConnectionId((current) => current === edge.id ? null : edge.id);
  };
  const togglePanelPin = () => {
    setPanelPinned((current) => {
      if (current) setPanelOpen(false);
      return !current;
    });
  };
  const connectionEdges = useMemo<ConnectionFlowEdge[]>(() => (workspace.connections ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'connection',
    data: { kind: connectionKind(edge) },
    selected: edge.id === selectedConnectionId,
  })), [selectedConnectionId, workspace.connections]);
  const visibleEdges = playbackActive ? connectionEdges.filter((edge) => revealedConnections.has(edge.id) && revealedNodes.has(edge.source) && revealedNodes.has(edge.target)) : connectionEdges;

  return <main className="editor-shell">
    <header className="editor-topbar">
      <button className="icon-button back-button" onClick={onExit} aria-label="Back to workspaces"><ArrowLeft size={18} /></button>
      <div className="editor-title"><input value={workspace.name} onChange={(e) => setWorkspace((current) => ({ ...current, name: e.target.value, updatedAt: now() }))} aria-label="Workspace name" /><span className={`save-state ${saveState}`}>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved locally'}</span></div>
      <div className="editor-actions">
        <button className={`icon-button ${panelPinned ? 'active' : ''}`} onClick={togglePanelPin} title={panelPinned ? 'Unpin editor panel' : 'Pin editor panel'} aria-label={panelPinned ? 'Unpin editor panel' : 'Pin editor panel'}>{panelPinned ? <PinOff size={17} /> : <Pin size={17} />}</button>
        <button className="icon-button" onClick={() => void saveNow(false)} title="Save"><Save size={17} /></button>
        <button className="icon-button" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts" aria-label="Keyboard shortcuts"><Keyboard size={18} /></button>
      </div>
    </header>
    <div className="canvas-wrap">
      <ReactFlow<ThoughtFlowNode, ConnectionFlowEdge> nodes={renderNodes} edges={visibleEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={onNodesChange} onInit={setInstance} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onNodeClick={playbackActive ? undefined : onNodeClick} onEdgeClick={playbackActive ? undefined : onEdgeClick} onPaneClick={() => { setSelectedId(null); setSelectedConnectionId(null); }} minZoom={0.18} maxZoom={1.8} defaultViewport={workspace.viewport} fitViewOptions={{ padding: 0.18 }} nodesDraggable={!playbackActive} nodesConnectable={!playbackActive} proOptions={{ hideAttribution: true }} onMoveEnd={(_event: MouseEvent | TouchEvent | null, viewport: Viewport) => { if (!playbackActive) setWorkspace((current) => ({ ...current, viewport })); }}>
        <Background color="#1b1b1b" gap={28} size={1} variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} showFitView={false} position="bottom-left" />
      </ReactFlow>
      {playbackActive && <div className="chronology-controls"><div><span>CHRONOLOGY <i>Beta</i></span><strong>{playbackStep} / {chronology.length}</strong></div><p>{playbackStep ? revealedEvents.at(-1)?.label : 'Starting from an empty space…'}</p><div className="chronology-buttons"><button onClick={() => setPlaybackPlaying((playing) => !playing)} disabled={playbackStep >= chronology.length}>{playbackPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}</button><button onClick={() => { setPlaybackPlaying(false); setPlaybackStep((step) => Math.min(chronology.length, step + 1)); }} disabled={playbackStep >= chronology.length}><SkipForward size={14} /> Next</button><button onClick={() => { setPlaybackPlaying(false); setPlaybackActive(false); }}>Show all</button></div></div>}
      {!playbackActive && <div className={`canvas-bottom-center ${panelVisible ? 'panel-open' : ''}`}>
        <button onClick={fitAll} title="Fit everything (F)"><LayoutTemplate size={16} /> Fit all</button>
      </div>}
      {!playbackActive && <div className={`quick-capture ${panelVisible ? 'panel-open' : ''}`}>
        <button onClick={addNote} title="Add note"><StickyNote size={16} /> Note</button>
        <button onClick={() => addAttachments('image')} title="Add photos"><ImagePlus size={16} /> Photo</button>
        <button onClick={() => addAttachments('file')} title="Attach files"><FileUp size={16} /> File</button>
        <button onClick={() => setLocationOpen(true)} title="Add location"><MapPin size={16} /> Location</button>
      </div>}
      {!playbackActive && panelVisible && <aside className="node-panel">
        <div className="panel-head">
          <span>{editing ? `Clue · ${editing.kind === 'image' ? 'Photo' : editing.kind === 'file' ? 'File' : editing.kind === 'location' ? 'Location' : 'Note'}` : 'Clue editor'}</span>
          <div className="panel-head-actions">
            <button className={`icon-button ${panelPinned ? 'active' : ''}`} onClick={togglePanelPin} title={panelPinned ? 'Unpin panel' : 'Pin panel'} aria-label={panelPinned ? 'Unpin panel' : 'Pin panel'}>{panelPinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
            <button className="icon-button" onClick={() => { setPanelPinned(false); setPanelOpen(false); }} title="Close editor" aria-label="Close editor"><X size={17} /></button>
          </div>
        </div>
        {editing ? <div className="panel-scroll">
          <label>Title<textarea className="question-input" value={editing.question} onChange={(e) => updateNode(editing.id, { question: e.target.value })} rows={2} /></label>
          <div className="color-editor"><span>Card color</span><div className="color-swatches">
            <button className={!editing.color ? 'selected' : ''} onClick={() => updateNode(editing.id, { color: undefined })} title="No color" aria-label="No color"><i /></button>
            {clueColors.map((color) => <button key={color} className={editing.color === color ? 'selected' : ''} style={{ '--swatch': color } as CSSProperties} onClick={() => applyColor(editing.id, color)} title={`Use ${color}`} aria-label={`Use color ${color}`}><i /></button>)}
          </div><small>Select another clue and press C to reuse the last color.</small></div>
          <label>Note<textarea data-clue-note value={editing.answer} onChange={(e) => updateNode(editing.id, { answer: e.target.value })} placeholder="Add a note to this clue…" rows={8} /></label>
          {editing.kind === 'location' && <div className="location-editor">
            <label>Address or coordinates<input value={editing.location?.query ?? ''} onChange={(e) => updateLocation(editing, { query: e.target.value, latitude: parseCoordinates(e.target.value)?.latitude, longitude: parseCoordinates(e.target.value)?.longitude })} placeholder="Place name, address, or 48.8584, 2.2945" /></label>
            <div className="location-coordinate-row"><label>Latitude<input type="number" step="any" value={editing.location?.latitude ?? ''} onChange={(e) => updateLocation(editing, { latitude: e.target.value === '' ? undefined : Number(e.target.value) })} /></label><label>Longitude<input type="number" step="any" value={editing.location?.longitude ?? ''} onChange={(e) => updateLocation(editing, { longitude: e.target.value === '' ? undefined : Number(e.target.value) })} /></label></div>
            <div className="location-editor-actions"><button className="button button-quiet compact" disabled={locatingId === editing.id || !editing.location?.query.trim()} onClick={() => void locatePlace(editing.id, editing.location?.query ?? '', /^https?:\/\//i.test(editing.location?.query ?? '') ? editing.question : editing.location?.query ?? '')}><MapPin size={15} /> {locatingId === editing.id ? 'Finding…' : 'Find on map'}</button><button className="button button-quiet compact" onClick={() => void openPhotoSearch(editing)}><ImagePlus size={15} /> Find photos</button><button className="button button-quiet compact" onClick={() => addLocationPhotos(editing)}><ImagePlus size={15} /> Add your own</button><button className="button button-quiet compact" onClick={() => setMapOpenId(editing.id)}><ExternalLink size={14} /> View map</button></div>
            {!!editing.location?.photos?.length && <div className="location-photo-list">{editing.location.photos.map((photo, index) => <div key={`${photo.name}-${index}`}><img src={photo.dataUrl} alt={photo.name} /><span title={photo.name}>{shortPhotoName(photo.name)}</span><button title="Delete photo" aria-label={`Delete ${photo.name}`} onClick={() => setConfirmPhotoDelete({ nodeId: editing.id, index, name: photo.name })}><Trash2 size={14} /></button></div>)}</div>}
          </div>}
          {editing.kind === 'image' && editing.attachment && <div className="attachment-preview"><img src={editing.attachment.dataUrl} alt={editing.attachment.name} /><small>{editing.attachment.mimeType} · {(editing.attachment.size / 1024 / 1024).toFixed(2)} MB</small></div>}
          {editing.kind === 'file' && editing.attachment && <div className="attachment-file"><FileIcon size={22} /><div><strong>{editing.attachment.name}</strong><small>{editing.attachment.mimeType} · {(editing.attachment.size / 1024).toFixed(1)} KB</small></div><a href={editing.attachment.dataUrl} download={editing.attachment.name}>Download</a></div>}
          <button className="delete-action" onClick={() => setConfirmDelete(editing)}><Trash2 size={15} /> Delete item</button>
        </div> : <div className="panel-empty"><StickyNote size={24} /><span>No clue is open</span><small>Select a clue and press Enter to edit it.</small></div>}
      </aside>}
    </div>

    {shortcutsOpen && <Modal title="Keyboard shortcuts" onClose={() => setShortcutsOpen(false)}><div className="shortcuts-list">
      <div><kbd>↑</kbd><span>Zoom in</span></div><div><kbd>↓</kbd><span>Zoom out</span></div>
      <div><kbd>← / →</kbd><span>Move through map and photos in the selected Location</span></div>
      <div><kbd>Enter</kbd><span>Open the selected item in the editor</span></div>
      <div><kbd>Space</kbd><span>Start a white parent connection; then select another item</span></div>
      <div><kbd>Shift + Space</kbd><span>Start a red relationship connection</span></div>
      <div><kbd>C</kbd><span>Apply the last selected color</span></div>
      <div><kbd>Backspace</kbd><span>Remove the selected item or connection immediately</span></div>
      <div><kbd>Delete</kbd><span>Remove the selected item with confirmation</span></div>
      <div><kbd>Esc</kbd><span>Deselect, cancel linking, or close a window</span></div>
      <div><kbd>F</kbd><span>Fit all items on screen</span></div>
      <div><kbd>Ctrl + S</kbd><span>Save</span></div><div><kbd>Ctrl + Shift + S</kbd><span>Save As</span></div>
      <div><kbd>Ctrl + O</kbd><span>Open a .unfold file</span></div><div><kbd>Ctrl + N</kbd><span>New space</span></div>
      <p>Shortcuts do not interrupt typing in text fields.</p>
    </div></Modal>}
    {locationOpen && <Modal title="Add location" onClose={() => setLocationOpen(false)}><div className="form-stack"><label>Place name or address<input autoFocus value={locationName} onChange={(e) => setLocationName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createLocation(); }} placeholder="e.g. New York, USA" /></label><small className="location-help">Enter a place name or address. UnFold finds it and shows a live map in the card. Looking up a new place needs internet; the workspace stays local.</small><div className="modal-actions"><button className="button button-quiet" onClick={() => setLocationOpen(false)}>Cancel</button><button className="button button-primary" disabled={!locationName.trim()} onClick={createLocation}>Add location</button></div></div></Modal>}
    {mapOpenId && (() => { const node = workspace.nodes.find((item) => item.id === mapOpenId); if (!node?.location) return null; const mapUrl = embeddedMapUrl(node.location); return <Modal title={node.question} onClose={() => setMapOpenId(null)} wide><div className="location-map-modal">{mapUrl ? <iframe title={`Map of ${node.question}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" /> : <div className="location-map-fallback"><MapPin size={27} /><span>Coordinates are not available for this location.</span><small>You can add them in the editor, or open the original link.</small></div>}<a href={googleMapsUrl(node.location)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open in Google Maps</a><small>Interactive map by {node.location.embedUrl ? 'Google Maps' : 'OpenStreetMap'} · requires internet</small></div></Modal>; })()}
    {photoSearchNodeId && (() => { const node = workspace.nodes.find((item) => item.id === photoSearchNodeId); if (!node?.location) return null; return <Modal title={`Photos near ${node.question}`} onClose={() => setPhotoSearchNodeId(null)} wide><div className="place-photo-search"><p>Wikimedia Commons photos near this point. Check each image before adding it—nearby does not always mean the exact place.</p>{photoSearchState === 'loading' && <div className="place-photo-message">Searching photos…</div>}{photoSearchState === 'error' && <div className="place-photo-message">Photo search is unavailable. You can still add your own photos.</div>}{photoSearchState === 'ready' && photoResults.length === 0 && <div className="place-photo-message">No nearby photos found. Try adding your own.</div>}{photoSearchState === 'ready' && <div className="place-photo-grid">{photoResults.map((photo) => { const added = node.location!.photos.some((item) => item.sourceUrl === photo.sourceUrl); return <div className="place-photo-result" key={photo.sourceUrl}><img src={photo.thumbnailUrl} alt={photo.title} loading="lazy" /><strong title={photo.title}>{shortPhotoName(photo.title)}</strong><small title={`${photo.attribution} · ${photo.license}`}>{photo.attribution} · {photo.license}</small><div><a href={photo.sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a><button disabled={added || importingPhotoUrl !== null} onClick={() => void addFoundPhoto(node.id, photo)}>{added ? 'Added' : importingPhotoUrl === photo.sourceUrl ? 'Adding…' : 'Add photo'}</button></div></div>; })}</div>}</div></Modal>; })()}
    {confirmPhotoDelete && <Modal title="Delete this photo?" onClose={() => setConfirmPhotoDelete(null)}><p className="modal-intro">“{shortPhotoName(confirmPhotoDelete.name)}” will be removed from this location. This cannot be undone after autosave.</p><div className="modal-actions"><button className="button button-quiet" onClick={() => setConfirmPhotoDelete(null)}>Cancel</button><button className="button button-danger" onClick={deleteLocationPhoto}>Delete photo</button></div></Modal>}
    {confirmDelete && <Modal title="Delete this item?" onClose={() => setConfirmDelete(null)}><p className="modal-intro">“{confirmDelete.question}” and its connections will be removed. This cannot be undone after autosave.</p><div className="modal-actions"><button className="button button-quiet" onClick={() => setConfirmDelete(null)}>Cancel</button><button className="button button-danger" onClick={() => deleteNode(confirmDelete)}>Delete item</button></div></Modal>}
    {toast && <div className="toast editor-toast" role="status">{toast}</div>}
  </main>;
}
