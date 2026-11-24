import type { EmbeddedAttachment } from '../types';

const textExtensions = /\.(?:py|txt|md|markdown|json|jsonl|csv|tsv|xml|html?|css|js|jsx|ts|tsx|sql|sh|ps1|bat|cmd|toml|ya?ml|ini|log|svg)$/i;

export function isPython(attachment: EmbeddedAttachment): boolean {
  return /\.py$/i.test(attachment.name) || attachment.mimeType === 'text/x-python';
}

export function isEditableText(attachment: EmbeddedAttachment): boolean {
  return isPython(attachment) || textExtensions.test(attachment.name) || attachment.mimeType.startsWith('text/') || /(?:json|xml|javascript)$/.test(attachment.mimeType);
}

export function attachmentText(attachment: EmbeddedAttachment): string {
  if (!isEditableText(attachment)) return '';
  const encoded = attachment.dataUrl.split(',')[1] ?? '';
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

export function withAttachmentText(attachment: EmbeddedAttachment, content: string): EmbeddedAttachment {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { ...attachment, size: bytes.length, dataUrl: `data:${attachment.mimeType || 'text/plain'};base64,${btoa(binary)}` };
}

export function newPythonAttachment(): EmbeddedAttachment {
  return withAttachmentText({ name: 'script.py', mimeType: 'text/x-python', size: 0, dataUrl: '' }, '# Write Python here\nprint("Hello from Unfold")\n');
}

export function safeLink(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

export function previewLink(raw: string): string | null {
  const link = safeLink(raw);
  if (!link) return null;
  const url = new URL(link);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch') {
    const video = url.searchParams.get('v');
    if (video && /^[\w-]{11}$/.test(video)) return `https://www.youtube-nocookie.com/embed/${video}`;
  }
  if (url.hostname === 'youtu.be' && /^[\w-]{11}$/.test(url.pathname.slice(1))) return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
  return link;
}
