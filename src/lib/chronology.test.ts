import { describe, expect, it } from 'vitest';
import { buildChronology } from './chronology';
import { createWorkspace } from './workspace';

describe('workspace chronology', () => {
  it('includes only surviving objects, connections, and location photos', () => {
    const doc = createWorkspace('Test', '');
    doc.nodes = [
      { id: 'a', parentId: null, kind: 'note', question: 'First', answer: '', completed: false, collapsed: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'b', parentId: null, kind: 'location', question: 'Place', answer: '', completed: false, collapsed: false, createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', location: { query: 'Paris', photos: [{ name: 'view.png', mimeType: 'image/png', size: 1, dataUrl: 'data:image/png;base64,AA==', createdAt: '2026-01-04T00:00:00Z' }] } },
    ];
    doc.connections = [{ id: 'link', source: 'a', target: 'b', kind: 'relation', createdAt: '2026-01-03T00:00:00Z' }, { id: 'deleted-target', source: 'a', target: 'removed', kind: 'parent' }];
    expect(buildChronology(doc).map((event) => `${event.kind}:${event.id}`)).toEqual(['node:a', 'node:b', 'connection:link', 'photo:b:photo:0']);
  });
});
