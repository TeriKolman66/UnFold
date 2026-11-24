// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttachmentPreview } from './AttachmentPreview';
import { LinkPreview } from './LinkPreview';
import { withAttachmentText } from '../lib/attachments';

describe('clue previews', () => {
  it('shows imported Python source as text, not executable HTML', () => {
    const attachment = withAttachmentText({ name: 'script.py', mimeType: 'text/x-python', size: 0, dataUrl: '' }, 'print("ready")');
    render(<AttachmentPreview attachment={attachment} compact />);
    expect(screen.getByText('print("ready")')).toBeTruthy();
  });

  it('renders video files with playback controls inside the clue', () => {
    const attachment = { name: 'clip.mp4', mimeType: 'video/mp4', size: 1, dataUrl: 'data:video/mp4;base64,AA==' };
    const { container } = render(<AttachmentPreview attachment={attachment} />);
    expect(container.querySelector('video[controls]')).toBeTruthy();
  });

  it('keeps an external open action for embedded links', () => {
    const { container } = render(<LinkPreview url="https://example.com/page" compact />);
    expect(container.querySelector('iframe[sandbox]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open link/i }).getAttribute('href')).toBe('https://example.com/page');
  });
});
