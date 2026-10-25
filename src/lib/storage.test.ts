// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createWorkspace, now } from './workspace';
import { duplicateWorkspace, loadIndex, loadWorkspace } from './storage';

beforeEach(() => localStorage.clear());

describe('workspace duplication', () => {
  it('keeps copied notes and connections together and makes the copy visible first', async () => {
    const original = createWorkspace('Investigation', '');
    const timestamp = now();
    original.nodes = ['first', 'second'].map((id) => ({
      id, parentId: null, kind: 'note' as const, question: id, answer: '',
      completed: false, collapsed: false, position: { x: id === 'first' ? 0 : 400, y: 0 },
      createdAt: timestamp, updatedAt: timestamp,
    }));
    original.connections = [{ id: 'link', source: 'first', target: 'second', kind: 'parent' }];

    const copy = await duplicateWorkspace(original);
    const entries = await loadIndex();
    const restored = await loadWorkspace(entries[0]);

    expect(entries[0].id).toBe(copy.id);
    expect(entries[0].snapshot).toBeUndefined();
    expect(restored?.nodes).toHaveLength(2);
    expect(restored?.nodes.map((node) => node.id)).not.toContain('first');
    expect(restored?.connections?.[0]).toMatchObject({
      source: restored?.nodes[0].id,
      target: restored?.nodes[1].id,
      kind: 'parent',
    });
    expect(restored?.connections?.[0].id).not.toBe('link');
  });
});
