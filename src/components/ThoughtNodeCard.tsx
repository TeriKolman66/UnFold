import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, File, Image as ImageIcon, ListTodo, MapPin, Maximize2, StickyNote, Trash2 } from 'lucide-react';
import type { ThoughtNode } from '../types';
import { embeddedMapUrl, googleMapsUrl } from '../lib/location';

export type ThoughtFlowNode = Node<{ thought: ThoughtNode; childCount: number; onToggle: (id: string) => void; onFindMap?: (id: string) => void; onOpenMap?: (id: string) => void; onDeletePhoto?: (id: string, index: number) => void; findingMap?: boolean }, 'thought'>;

export const ThoughtNodeCard = memo(({ data, selected }: NodeProps<ThoughtFlowNode>) => {
  const { thought, childCount, onToggle, onFindMap, onOpenMap, onDeletePhoto, findingMap } = data;
  const [slideIndex, setSlideIndex] = useState(0);
  const photos = thought.location?.photos ?? [];
  const lastSlide = photos.length;
  const priorPhotoCount = useRef(lastSlide);
  useEffect(() => { if (slideIndex > lastSlide) setSlideIndex(lastSlide); }, [lastSlide, slideIndex]);
  useEffect(() => { if (lastSlide > priorPhotoCount.current) setSlideIndex(lastSlide); priorPhotoCount.current = lastSlide; }, [lastSlide]);
  useEffect(() => {
    if (!selected || thought.kind !== 'location') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]') || document.querySelector('[role="dialog"]')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); setSlideIndex((index) => Math.max(0, index - 1)); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setSlideIndex((index) => Math.min(lastSlide, index + 1)); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lastSlide, selected, thought.kind]);
  const mapUrl = thought.location ? embeddedMapUrl(thought.location) : null;
  const displayedPhoto = slideIndex > 0 ? photos[slideIndex - 1] : null;
  const colorStyle = thought.color ? { '--clue-color': thought.color } as CSSProperties : undefined;
  return <div style={colorStyle} className={`thought-node ${thought.kind} ${thought.color ? 'has-color' : ''} ${thought.completed ? 'completed' : ''} ${selected ? 'selected' : ''}`}>
    {thought.kind !== 'root' && <Handle type="target" position={Position.Left} />}
    <div className="node-kicker">{thought.kind === 'task' && <ListTodo size={11} />}{thought.kind === 'note' && <StickyNote size={11} />}{thought.kind === 'image' && <ImageIcon size={11} />}{thought.kind === 'file' && <File size={11} />}{thought.kind === 'location' && <MapPin size={11} />}{thought.kind === 'location' ? 'LOCATION' : 'CLUE'}</div>
    <div className="node-title" title={thought.question}>{thought.question || 'Untitled question'}</div>
    {thought.kind === 'image' && thought.attachment && <img className="node-image" src={thought.attachment.dataUrl} alt={thought.attachment.name} />}
    {thought.kind === 'location' && thought.location && <div className="location-card-content">
      <div className="location-slide">
        {displayedPhoto ? <><img src={displayedPhoto.dataUrl} alt={displayedPhoto.name} />{displayedPhoto.sourceUrl && <a className="location-photo-credit nodrag" href={displayedPhoto.sourceUrl} target="_blank" rel="noreferrer" title={`${displayedPhoto.attribution ?? 'Source'} · ${displayedPhoto.license ?? ''}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>{displayedPhoto.attribution || 'Wikimedia Commons'} · {displayedPhoto.license}</a>}{onDeletePhoto && <button className="location-photo-delete nodrag" title="Delete this photo" aria-label="Delete this photo" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDeletePhoto(thought.id, slideIndex - 1); }}><Trash2 size={14} /></button>}</> : <div className={`location-map-preview ${mapUrl ? 'has-map' : ''}`}>{mapUrl ? <iframe src={mapUrl} title={`Preview map of ${thought.question}`} loading="lazy" tabIndex={-1} referrerPolicy="no-referrer" /> : <div className="location-map-marker"><MapPin size={23} /><span>Map not loaded</span><button className="location-find-map nodrag" disabled={findingMap} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onFindMap?.(thought.id); }}>{findingMap ? 'Finding…' : 'Find map'}</button></div>}</div>}
        {slideIndex === 0 && mapUrl && onOpenMap && <button className="location-map-expand nodrag" title="Open interactive map" aria-label="Open interactive map" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpenMap(thought.id); }}><Maximize2 size={14} /></button>}
        {slideIndex > 0 && <button className="location-slide-arrow left nodrag" title="Previous" aria-label="Previous location image" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSlideIndex((index) => Math.max(0, index - 1)); }}><ChevronLeft size={17} /></button>}
        {slideIndex < lastSlide && <button className="location-slide-arrow right nodrag" title="Next" aria-label="Next location image" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSlideIndex((index) => Math.min(lastSlide, index + 1)); }}><ChevronRight size={17} /></button>}
        <span className="location-slide-count">{slideIndex === 0 ? 'MAP' : `${slideIndex} / ${lastSlide}`}</span>
      </div>
      <div className="location-card-footer"><a className="nodrag" href={googleMapsUrl(thought.location)} target="_blank" rel="noreferrer" title="Open location in Google Maps" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>Open in Maps <ExternalLink size={13} /></a></div>
    </div>}
    {thought.kind === 'file' && thought.attachment && <div className="node-file"><File size={16} /><span>{thought.attachment.name}</span></div>}
    {thought.answer && <p className="node-note">{thought.answer}</p>}
    {(thought.kind === 'question' || thought.kind === 'task') && <div className="node-meta">
      <span>{thought.answer.trim() ? 'Answered' : 'Unanswered'}</span>
      {thought.completed && <span className="node-done"><Check size={11} /> Complete</span>}
    </div>}
    {childCount > 0 && <button className="collapse-button nodrag" onClick={(e) => { e.stopPropagation(); onToggle(thought.id); }} title={thought.collapsed ? 'Expand descendants' : 'Collapse descendants'}><ChevronDown size={14} className={thought.collapsed ? 'rotated' : ''} /><span>{childCount}</span></button>}
    <Handle type="source" position={Position.Right} />
  </div>;
});
