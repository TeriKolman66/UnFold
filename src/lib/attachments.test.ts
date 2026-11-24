import { describe, expect, it } from 'vitest';
import { attachmentText, isEditableText, isPython, newPythonAttachment, previewLink, safeLink, withAttachmentText } from './attachments';

describe('embedded files and links', () => {
  it('creates an editable Python file and keeps Unicode text portable', () => {
    const attachment = withAttachmentText(newPythonAttachment(), 'print("Привіт 🌍")\n');
    expect(isPython(attachment)).toBe(true);
    expect(isEditableText(attachment)).toBe(true);
    expect(attachmentText(attachment)).toBe('print("Привіт 🌍")\n');
    expect(attachment.size).toBe(new TextEncoder().encode('print("Привіт 🌍")\n').length);
  });

  it('recognizes source and document files without executing their contents', () => {
    const attachment = { name: 'notes.md', mimeType: 'application/octet-stream', size: 0, dataUrl: '' };
    expect(isEditableText(attachment)).toBe(true);
    expect(isEditableText({ ...attachment, name: 'archive.zip' })).toBe(false);
  });

  it('accepts only web links and embeds supported YouTube URLs', () => {
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('file:///C:/secret')).toBeNull();
    expect(previewLink('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(previewLink('https://example.com/page')).toBe('https://example.com/page');
  });
});
