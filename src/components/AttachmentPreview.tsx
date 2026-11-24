import { File as FileIcon } from 'lucide-react';
import type { EmbeddedAttachment } from '../types';
import { attachmentText, isEditableText } from '../lib/attachments';

export function AttachmentPreview({ attachment, compact = false }: { attachment: EmbeddedAttachment; compact?: boolean }) {
  const mime = attachment.mimeType;
  if (mime.startsWith('image/')) return <img className="file-preview-image" src={attachment.dataUrl} alt={attachment.name} />;
  if (mime.startsWith('video/')) return <video className="file-preview-video nodrag" src={attachment.dataUrl} controls preload="metadata" onClick={(event) => event.stopPropagation()} />;
  if (mime.startsWith('audio/')) return <audio className="file-preview-audio nodrag" src={attachment.dataUrl} controls preload="metadata" onClick={(event) => event.stopPropagation()} />;
  if (mime === 'application/pdf') return <iframe className="file-preview-pdf nodrag" src={attachment.dataUrl} title={attachment.name} />;
  if (isEditableText(attachment)) return <pre className={`file-preview-text ${compact ? 'compact' : ''}`}>{attachmentText(attachment)}</pre>;
  return <div className="file-preview-unknown"><FileIcon size={22} /><span>{attachment.name}</span><small>Preview not available for this file type</small></div>;
}
