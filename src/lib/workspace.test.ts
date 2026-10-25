import { describe, expect, it } from 'vitest';
import { createWorkspace, isWorkspaceDocument, now } from './workspace';
import { layoutThoughtTree, nodeHeight, NODE_WIDTH } from './layout';
import { buildSummary } from './summary';
import { connectionKind, validateConnection } from './connections';
import type { ThoughtNode } from '../types';

const makeNote = (id: string, position?: { x: number; y: number }): ThoughtNode => ({
  id, parentId: null, kind: 'note', question: `Note ${id}`, answer: `Text ${id}`,
  completed: false, collapsed: false, position, createdAt: now(), updatedAt: now(),
});

describe('freeform workspace model', () => {
  it('creates a valid empty space', () => {
    const doc = createWorkspace('Moodboard', '');
    expect(isWorkspaceDocument(doc)).toBe(true);
    expect(doc.nodes).toEqual([]);
    expect(doc.connections).toEqual([]);
  });

  it('keeps embedded files portable', () => {
    const doc = createWorkspace('Files', '');
    doc.nodes.push({ ...makeNote('file'), kind: 'file', question: 'brief.pdf', answer: '', attachment: { name: 'brief.pdf', mimeType: 'application/pdf', size: 12, dataUrl: 'data:application/pdf;base64,AAAA' } });
    const restored: unknown = JSON.parse(JSON.stringify(doc));
    expect(isWorkspaceDocument(restored)).toBe(true);
    if (isWorkspaceDocument(restored)) expect(restored.nodes[0].attachment?.dataUrl).toContain('base64');
  });

  it('preserves manual positions and connections', () => {
    const doc = createWorkspace('Map', '');
    doc.nodes.push(makeNote('a', { x: 15, y: 40 }), makeNote('b', { x: 420, y: 180 }));
    doc.connections = [{ id: 'edge', source: 'a', target: 'b' }];
    const layout = layoutThoughtTree(doc.nodes, () => undefined);
    expect(layout.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 15, y: 40 });
    expect(doc.connections[0]).toEqual({ id: 'edge', source: 'a', target: 'b' });
  });

  it('includes notes and attachment names in exports without embedding data', () => {
    const doc = createWorkspace('Research', '');
    doc.nodes.push(makeNote('idea'), { ...makeNote('photo'), kind: 'image', question: 'Reference', answer: '', attachment: { name: 'reference.png', mimeType: 'image/png', size: 42, dataUrl: 'data:image/png;base64,SECRET' } });
    const summary = buildSummary(doc);
    expect(summary).toContain('Text idea');
    expect(summary).toContain('reference.png');
    expect(summary).not.toContain('SECRET');
  });
});

describe('large freeform spaces', () => {
  it('lays out 200 unpositioned cards without overlaps', () => {
    const nodes = Array.from({ length: 200 }, (_, index) => makeNote(`node-${index}`));
    const laidOut = layoutThoughtTree(nodes, () => undefined);
    expect(laidOut.nodes).toHaveLength(200);
    const boxes = laidOut.nodes.map((node) => ({ left: node.position.x, top: node.position.y, right: node.position.x + NODE_WIDTH, bottom: node.position.y + nodeHeight(node.data.thought) }));
    for (let first = 0; first < boxes.length; first++) for (let second = first + 1; second < boxes.length; second++) {
      const a = boxes[first]; const b = boxes[second];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  });
});

describe('connection rules', () => {
  it('treats old links as relationships', () => {
    expect(connectionKind({ id: 'old', source: 'a', target: 'b' })).toBe('relation');
  });

  it('allows multiple parent links and a relationship between the same clues', () => {
    const links = [{ id: 'one', source: 'a', target: 'child', kind: 'parent' as const }];
    expect(validateConnection(links, 'b', 'child', 'parent')).toBeNull();
    expect(validateConnection(links, 'a', 'child', 'relation')).toBeNull();
  });

  it('blocks only self-links and duplicate links of the same kind', () => {
    const links = [{ id: 'one', source: 'a', target: 'b', kind: 'relation' as const }];
    expect(validateConnection(links, 'a', 'a', 'parent')).toBeTruthy();
    expect(validateConnection(links, 'b', 'a', 'relation')).toBeTruthy();
  });
});
