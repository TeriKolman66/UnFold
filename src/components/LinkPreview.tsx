import { ExternalLink, Link2 } from 'lucide-react';
import { previewLink, safeLink } from '../lib/attachments';

export function LinkPreview({ url, compact = false }: { url: string; compact?: boolean }) {
  const safe = safeLink(url);
  if (!safe) return <div className="link-preview-empty"><Link2 size={20} /> Enter an http or https link in the editor.</div>;
  const preview = previewLink(safe)!;
  const path = new URL(safe).pathname.toLowerCase();
  const image = /\.(?:png|jpe?g|gif|webp|avif|svg)$/.test(path);
  const video = /\.(?:mp4|webm|ogg)$/.test(path);
  const audio = /\.(?:mp3|wav|m4a|oga)$/.test(path);
  return <div className={`link-preview ${compact ? 'compact' : ''}`}>
    <div className="link-preview-frame">{image ? <img src={safe} alt="Linked content" referrerPolicy="no-referrer" /> : video ? <video src={safe} controls preload="metadata" onClick={(event) => event.stopPropagation()} /> : audio ? <audio src={safe} controls preload="metadata" onClick={(event) => event.stopPropagation()} /> : <iframe src={preview} title={`Preview of ${safe}`} loading="lazy" sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer" />}</div>
    <a className="nodrag" href={safe} target="_blank" rel="noopener noreferrer" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><span>{new URL(safe).hostname}</span> Open link <ExternalLink size={12} /></a>
    {!compact && <small>Some websites do not allow embedded previews. The original link always remains available.</small>}
  </div>;
}
